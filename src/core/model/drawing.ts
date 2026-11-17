import { boxPoint, pointInBox, withProps, type Element } from "./element";
import { newId } from "./ids";
import { DRAWING, isColour } from "./objectKinds";
import type { Point, Size } from "./transform";

// Free drawing (step 24b): one drawing object per picture, holding all its strokes. It's an object
// like a bubble, so it's drawn, copied, undone, shown in thumbnails and see-through, and can be
// moved, sized or deleted in the Objects tab as one thing.
//
// A stroke's points are in the drawing's own box (fractions of it, like a bubble's tail), so moving
// or sizing the drawing moves its strokes. While the box isn't turned it's kept fitted around every
// stroke; once turned (in the Objects tab), new strokes are added in its turned terms and may reach
// past it. Nothing here is about pictures: a drawing could equally live on an overlay (the time
// track) later; see PLAN.md.

export type PencilWidth = "thin" | "medium" | "thick" | "huge";
export const PENCIL_WIDTHS: readonly PencilWidth[] = ["thin", "medium", "thick", "huge"];
// A line's thickness as a fraction of the frame's height, so it looks the same in a small GIF.
const WIDTH: Readonly<Record<PencilWidth, number>> = { thin: 0.006, medium: 0.012, thick: 0.025, huge: 0.05 };
export function pencilWidth(width: PencilWidth, frameHeight: number): number {
  return WIDTH[width] * frameHeight;
}

// points: x, y, x, y... in fractions of the drawing's box (kept short: 4 decimals).
export type Stroke = { points: number[]; colour: string; width: PencilWidth };
export type DrawingProps = { strokes: Stroke[] };
// A stroke as drawn: its points in project pixels.
export type NewStroke = { points: Point[]; colour: string; width: PencilWidth };

const INK = "#1f2433";

// A drawing's strokes, whatever is stored: anything that isn't a stroke is left out.
export function drawingProps(element: Pick<Element, "props">): DrawingProps {
  const stored: unknown = element.props.strokes;
  if (!Array.isArray(stored)) return { strokes: [] };
  const strokes = stored.flatMap((item): Stroke[] => {
    const points: unknown = item?.points;
    if (!Array.isArray(points) || points.length < 2 || points.length % 2 !== 0 || !points.every((n) => Number.isFinite(n))) return [];
    return [{ points: points as number[], colour: isColour(item.colour) ? item.colour : INK, width: PENCIL_WIDTHS.includes(item.width) ? item.width : "medium" }];
  });
  return { strokes };
}

// A stroke's points in project pixels.
export function strokePoints(drawing: Pick<Element, "box">, stroke: Stroke, size: Size): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < stroke.points.length; i += 2) points.push(boxPoint(drawing.box, { x: stroke.points[i], y: stroke.points[i + 1] }, size));
  return points;
}

// A drawn line made smooth and light: a light average takes out the hand's jitter, then points that
// add nothing (nearly on the line between their neighbours, within `tolerance` px) are dropped
// (Ramer-Douglas-Peucker). The ends stay where they were. A couple of hundred points from the
// pointer usually become a few dozen.
export function simplifyStroke(points: readonly Point[], tolerance: number): Point[] {
  const spaced = points.filter((point, i) => i === 0 || i === points.length - 1 || Math.hypot(point.x - points[i - 1].x, point.y - points[i - 1].y) >= tolerance / 2);
  if (spaced.length <= 2) return spaced.map((point) => ({ ...point }));
  let smooth = spaced;
  for (let pass = 0; pass < 2; pass++) smooth = smooth.map((point, i) => (i === 0 || i === smooth.length - 1 ? point : { x: (smooth[i - 1].x + point.x * 2 + smooth[i + 1].x) / 4, y: (smooth[i - 1].y + point.y * 2 + smooth[i + 1].y) / 4 }));
  return douglasPeucker(smooth, tolerance);
}

// A stroke added to a picture's drawing, or a new drawing for the first one. Returns the drawing.
export function addStroke(drawing: Element | undefined, stroke: NewStroke, size: Size): Element {
  if (drawing && drawing.box.rotation !== 0) {
    const local = stroke.points.map((point) => pointInBox(drawing.box, point, size));
    return withProps(drawing, { strokes: [...drawingProps(drawing).strokes, { colour: stroke.colour, width: stroke.width, points: flat(local) }] });
  }
  const existing = drawing ? drawingProps(drawing).strokes.map((item) => ({ ...item, at: strokePoints(drawing, item, size) })) : [];
  return fitted(drawing?.id ?? newId(), [...existing, { colour: stroke.colour, width: stroke.width, at: stroke.points }], size);
}

// The drawing without the strokes the eraser touched: within `radius` px of any point of its path
// (a stroke's own thickness counts). null when no stroke is left: the drawing goes.
export function eraseStrokes(drawing: Element, path: readonly Point[], radius: number, size: Size): Element | null {
  const strokes = drawingProps(drawing).strokes;
  const kept = strokes.filter((stroke) => {
    const reach = radius + pencilWidth(stroke.width, size.height) / 2;
    const points = strokePoints(drawing, stroke, size);
    return !path.some((at) => points.some((point, i) => distanceToSegment(at, points[Math.max(0, i - 1)], point) <= reach));
  });
  if (kept.length === strokes.length) return drawing;
  if (kept.length === 0) return null;
  if (drawing.box.rotation !== 0) return withProps(drawing, { strokes: kept });
  return fitted(drawing.id, kept.map((stroke) => ({ ...stroke, at: strokePoints(drawing, stroke, size) })), size);
}

// A drawing with its box fitted around strokes given in project pixels (`at`), padded by half the
// thickest line so the box takes in the whole line.
function fitted(id: string, strokes: { colour: string; width: PencilWidth; at: Point[] }[], size: Size): Element {
  const pad = Math.max(...strokes.map((stroke) => pencilWidth(stroke.width, size.height) / 2));
  const xs = strokes.flatMap((stroke) => stroke.at.map((point) => point.x));
  const ys = strokes.flatMap((stroke) => stroke.at.map((point) => point.y));
  const left = Math.min(...xs) - pad;
  const top = Math.min(...ys) - pad;
  const width = Math.max(1, Math.max(...xs) + pad - left);
  const height = Math.max(1, Math.max(...ys) + pad - top);
  const box = { x: round(left / size.width), y: round(top / size.height), width: round(width / size.width), height: round(height / size.height), rotation: 0 };
  const local = (point: Point): Point => ({ x: (point.x - left) / width, y: (point.y - top) / height });
  return { id, kind: DRAWING, box, props: { strokes: strokes.map((stroke) => ({ colour: stroke.colour, width: stroke.width, points: flat(stroke.at.map(local)) })) } };
}

function douglasPeucker(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 2) return [...points];
  const first = points[0];
  const last = points[points.length - 1];
  let far = 0;
  let farthest = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = distanceToSegment(points[i], first, last);
    if (distance > farthest) { farthest = distance; far = i; }
  }
  if (farthest <= tolerance) return [first, last];
  return [...douglasPeucker(points.slice(0, far + 1), tolerance).slice(0, -1), ...douglasPeucker(points.slice(far), tolerance)];
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function flat(points: readonly Point[]): number[] {
  return points.flatMap((point) => [round(point.x), round(point.y)]);
}

function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

// One drawing's strokes added to another, each where it was: a pasted drawing on a picture that
// already has one (one drawing per picture). Returns `into` with them.
export function mergeDrawings(into: Element, from: Element, size: Size): Element {
  return drawingProps(from).strokes.reduce((drawing, stroke) => addStroke(drawing, { points: strokePoints(from, stroke, size), colour: stroke.colour, width: stroke.width }, size), into);
}
