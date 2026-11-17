import { normaliseAngle, type Point, type Size } from "./transform";

// Objects drawn on top of a picture (step 23) or living in time (overlays, step 24): speech
// bubbles, text and shapes. Each kind has its own settings (`props`, objectKinds.ts), set in the
// Objects tab; the box (position, size, turn) is set on the stage, the same way for every kind.
// On a picture (Frame.elements) they belong to it: reordering or duplicating the picture carries
// them along. The box is in fractions of the frame, like a picture's position, so it survives a
// change of resolution; it isn't moved by the picture's own position or size.

// x / y: the top-left corner; rotation: degrees clockwise around the box's centre.
export type ElementBox = { x: number; y: number; width: number; height: number; rotation: number };
export type Element = { id: string; kind: string; box: ElementBox; props: Readonly<Record<string, unknown>> };

export const MIN_BOX = 0.06;   // fraction of the frame: smaller than this, an object can't be seen well

export function withProps(element: Element, props: Partial<Record<string, unknown>>): Element {
  return { ...element, props: { ...element.props, ...props } };
}

// The box's centre, in project pixels.
export function boxCentre(box: ElementBox, size: Size): Point {
  return { x: (box.x + box.width / 2) * size.width, y: (box.y + box.height / 2) * size.height };
}

// The box with its centre at `centre` (fractions of the frame), kept on the frame: where an object
// dropped on the stage lands.
export function boxAt(box: ElementBox, centre: Point): ElementBox {
  const cx = clamp(centre.x, 0, 1);
  const cy = clamp(centre.y, 0, 1);
  return { ...box, x: round(cx - box.width / 2), y: round(cy - box.height / 2) };
}

// Moves by project pixels; the centre stays on the frame, so a bubble can't be lost off the edge.
export function moveBox(box: ElementBox, dx: number, dy: number, size: Size): ElementBox {
  const cx = clamp(box.x + box.width / 2 + dx / size.width, 0, 1);
  const cy = clamp(box.y + box.height / 2 + dy / size.height, 0, 1);
  return { ...box, x: round(cx - box.width / 2), y: round(cy - box.height / 2) };
}

export type Corner = "nw" | "ne" | "se" | "sw";

// Resizes by dragging a corner `dx` / `dy` project pixels on screen: the opposite corner stays put,
// also when the box is turned (the drag is measured along the box's own sides). Never smaller
// than MIN_BOX of the frame.
export function resizeBox(box: ElementBox, corner: Corner, dx: number, dy: number, size: Size): ElementBox {
  const angle = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // The drag along the box's own axes.
  const along = { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
  const sx = corner === "ne" || corner === "se" ? 1 : -1;   // which way this corner grows
  const sy = corner === "sw" || corner === "se" ? 1 : -1;
  const w = Math.max(MIN_BOX * size.width, box.width * size.width + sx * along.x);
  const h = Math.max(MIN_BOX * size.height, box.height * size.height + sy * along.y);
  // The opposite corner, which stays where it is (in project pixels).
  const centre = boxCentre(box, size);
  const half = { x: (box.width * size.width) / 2, y: (box.height * size.height) / 2 };
  const fixed = rotate({ x: -sx * half.x, y: -sy * half.y }, cos, sin);
  const anchor = { x: centre.x + fixed.x, y: centre.y + fixed.y };
  // The new centre is half the new size from it, along the box's axes.
  const back = rotate({ x: (sx * w) / 2, y: (sy * h) / 2 }, cos, sin);
  const next = { x: anchor.x + back.x, y: anchor.y + back.y };
  return { ...box, width: round(w / size.width), height: round(h / size.height), x: round((next.x - w / 2) / size.width), y: round((next.y - h / 2) / size.height) };
}

export function rotateBox(box: ElementBox, degrees: number): ElementBox {
  return { ...box, rotation: normaliseAngle(box.rotation + degrees) };
}

// The box's corners in project pixels, turned with it: top-left, top-right, bottom-right, bottom-left.
export function boxCorners(box: ElementBox, size: Size): Point[] {
  const centre = boxCentre(box, size);
  const angle = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hw = (box.width * size.width) / 2;
  const hh = (box.height * size.height) / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => { const p = rotate({ x, y }, cos, sin); return { x: centre.x + p.x, y: centre.y + p.y }; });
}

// A point (project pixels) in the box's own terms: fractions of its width and height from its
// top-left corner, as if it weren't turned. For the tail, which moves and turns with the box.
export function pointInBox(box: ElementBox, point: Point, size: Size): Point {
  const centre = boxCentre(box, size);
  const angle = (-box.rotation * Math.PI) / 180;
  const local = rotate({ x: point.x - centre.x, y: point.y - centre.y }, Math.cos(angle), Math.sin(angle));
  return { x: round(local.x / (box.width * size.width) + 0.5), y: round(local.y / (box.height * size.height) + 0.5) };
}

// The other way round: a point in the box's own terms (fractions of it, as pointInBox gives) back
// in project pixels, turned with the box. Where a bubble's tail handle goes on the stage.
export function boxPoint(box: ElementBox, local: Point, size: Size): Point {
  const centre = boxCentre(box, size);
  const angle = (box.rotation * Math.PI) / 180;
  const p = rotate({ x: (local.x - 0.5) * box.width * size.width, y: (local.y - 0.5) * box.height * size.height }, Math.cos(angle), Math.sin(angle));
  return { x: centre.x + p.x, y: centre.y + p.y };
}

// Elements with nothing shared, for a copied frame or a preview. Ids stay: they only need to be
// unique within their frame.
export function cloneElements(elements: readonly Element[]): Element[] {
  return elements.map((element) => ({ ...element, box: { ...element.box }, props: structuredClone(element.props) }));
}

export function sameElements(a: readonly Element[], b: readonly Element[]): boolean {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b);
}

function rotate(point: Point, cos: number, sin: number): Point {
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
