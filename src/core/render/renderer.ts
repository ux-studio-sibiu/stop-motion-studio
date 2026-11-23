import { activeOverlays, frameIndexAt, overlaysDuring, frameStarts, type Adjust, type Frame, type Overlay, type Transform } from "../model";
import { adjustedCopy, canvasFilterWorks } from "./adjust";
import { drawElements } from "./elements";
import { scratchCanvas, type ScratchContext } from "./scratch";
import { containSize } from "./fit";

// The one renderer (PLAN.md §1): the stage, playback, onion skin and export all draw through
// renderAt, so what a child sees is what ends up in the video. It works on any 2D canvas
// context, on screen or off, and knows nothing about where pictures come from: `images` hands
// it a decoded picture, or nothing yet.

export type Scene = {
  width: number;              // the canvas size in px: the project's resolution
  height: number;
  frames: readonly Frame[];   // in animation order
  background?: string;        // behind letterboxed pictures (default black)
  overlays?: readonly Overlay[];   // objects that live in time (step 24), drawn on top while they show
};

// A decoded picture: an ImageBitmap, an <img>, a canvas... anything drawImage takes, with a size.
export type DrawableImage = CanvasImageSource & { width: number; height: number };

export type ImageSource = (imageId: string) => DrawableImage | undefined;

// What a render drew: which frame was on screen, and whether its picture was missing (not
// decoded yet), so the caller can draw again once it is.
export type RenderResult = { frameIndex: number; missing: boolean };

// Draws the animation as it is at `tick` (ticks from the start): what playback and export show. A
// time, not a frame index, because overlays (step 24) live in time, not on a frame: only the ones
// showing at that moment are drawn.
export function renderAt(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, scene: Scene, images: ImageSource, tick: number): RenderResult {
  const frameIndex = frameIndexAt(scene.frames, tick);
  return drawPicture(ctx, scene, images, frameIndex, activeOverlays(scene.overlays ?? [], tick));
}

// Draws one picture looked at on its own (the stage when not playing, step 24): with every overlay
// showing at any moment during it, so one that starts or ends partway through is there to see and
// edit.
export function renderPicture(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, scene: Scene, images: ImageSource, frameIndex: number): RenderResult {
  const start = startTick(scene.frames, frameIndex);
  const end = start + (scene.frames[frameIndex]?.hold ?? 0);
  return drawPicture(ctx, scene, images, frameIndex, overlaysDuring(scene.overlays ?? [], start, end));
}

// A picture with its objects, then the given overlays.
function drawPicture(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, scene: Scene, images: ImageSource, frameIndex: number, overlays: readonly Overlay[]): RenderResult {
  const frame = scene.frames[frameIndex];
  clear(ctx, scene, frame?.empty === true);   // an empty picture stays see-through: no background behind it
  if (!frame) return { frameIndex, missing: false };
  const image = images(frame.imageId);
  if (!image) return { frameIndex, missing: true };
  drawFrame(ctx, scene, frame, image);
  // The picture's objects on top (step 23), in frame coordinates: the picture's own position and
  // size don't move them. Then the overlays (step 24), above everything.
  drawElements(ctx, scene, frame.elements ?? []);
  drawElements(ctx, scene, overlays.map((overlay) => overlay.element));
  return { frameIndex, missing: false };
}

// One frame's picture with its position and look. Exposed for onion skin (step 17), which
// draws neighbouring frames faintly on top of each other.
// `style` is an extra canvas filter applied after the picture's own adjustments (the onion
// skin's outline look). Brightness and contrast (step 20) use the canvas filter; where the browser
// has none (older Safari), an adjusted copy of the picture is drawn instead (adjust.ts), and the
// extra style is left out. `canvasFilter` is for tests, to draw both ways.
export function drawFrame(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, scene: Pick<Scene, "width" | "height">, frame: Pick<Frame, "transform" | "adjust">, image: DrawableImage, style = "none", { canvasFilter = canvasFilterWorks(ctx) } = {}): void {
  const size = containSize(image.width, image.height, scene.width, scene.height);
  if (size.width === 0) return;
  const adjust = adjustFilter(frame.adjust);
  const source = adjust !== "none" && !canvasFilter ? adjustedCopy(image, frame.adjust) : image;
  ctx.save();
  ctx.setTransform(...frameMatrix(frame.transform, size, scene));
  const filter = canvasFilter ? [adjust, style].filter((part) => part !== "none").join(" ") || "none" : "none";
  if (filter !== "none") ctx.filter = filter;
  ctx.drawImage(source, 0, 0, size.width, size.height);
  ctx.restore();
}

// Onion skin ("see-through"): the pictures before `index` drawn faintly on a transparent canvas
// that sits over the live camera, so the next pose can be lined up with them. The nearest one
// is drawn at `opacity`, older ones fainter (× 0.5 each). Returns the pictures that weren't
// decoded yet (and so were left out), so the caller can decode them and draw again.
// `outline` turns the ghosts into broad black-and-white shapes (outlineFilter).
// A ghost includes its picture's objects (speech bubbles), so they can be lined up too: drawn
// whole on a scratch canvas first, then laid down faintly in one go, so a bubble's overlapping
// parts don't show through each other.
// `difference` ("spot the difference", step 19) draws only the nearest picture, at full strength:
// the canvas is shown with CSS `mix-blend-mode: difference` over the camera or the picture, so
// what lines up goes black and what doesn't glows. Only a looking aid: export never draws it.
export function drawOnionSkin(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, scene: Pick<Scene, "width" | "height" | "frames">, images: ImageSource, index: number, { count = 1, opacity = 0.4, outline = false, difference = false } = {}): string[] {
  // Spot the difference: only the nearest picture, at full strength, as a photo.
  const shown = difference ? { count: 1, opacity: 1, style: "none" } : { count, opacity, style: outline ? outlineFilter(scene.width) : "none" };
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, scene.width, scene.height);
  ctx.restore();
  const missing: string[] = [];
  // Oldest first, so the nearest ghost ends up on top.
  for (let back = Math.min(shown.count, index); back >= 1; back--) {
    const frame = scene.frames[index - back];
    const image = frame && images(frame.imageId);
    if (!frame) continue;
    if (!image) { missing.push(frame.imageId); continue; }
    ctx.save();
    ctx.globalAlpha = onionOpacity(shown.opacity, back);
    const layer = frame.elements?.length ? ghostLayer(scene) : null;
    if (layer) {
      drawFrame(layer, scene, frame, image, shown.style);
      layer.save();
      if (shown.style !== "none" && canvasFilterWorks(layer)) layer.filter = shown.style;
      drawElements(layer, scene, frame.elements);
      layer.restore();
      ctx.drawImage(layer.canvas, 0, 0);
    } else {
      drawFrame(ctx, scene, frame, image, shown.style);
    }
    ctx.restore();
  }
  return missing;
}

// The scratch canvas a ghost with objects is drawn on, cleared, at the scene's size. One, kept.
let ghost: ScratchContext | null = null;
function ghostLayer(size: { width: number; height: number }): ScratchContext | null {
  if (!ghost || ghost.canvas.width !== size.width || ghost.canvas.height !== size.height) {
    ghost = scratchCanvas(size.width, size.height);
    if (!ghost) return null;
  }
  ghost.save();
  ghost.setTransform(1, 0, 0, 1, 0, 0);
  ghost.clearRect(0, 0, size.width, size.height);
  ghost.restore();
  return ghost;
}

// A picture's four corners on the canvas (top-left, top-right, bottom-right, bottom-left), for its
// outline on the stage and for snapping. `image` is the picture's size (the canvas's if unknown).
export function frameCorners(transform: Transform, image: { width: number; height: number } | undefined, scene: { width: number; height: number }): { x: number; y: number }[] {
  const fit = containSize(image?.width ?? scene.width, image?.height ?? scene.height, scene.width, scene.height);
  const m = frameMatrix(transform, fit, scene);
  return [applyMatrix(m, 0, 0), applyMatrix(m, fit.width, 0), applyMatrix(m, fit.width, fit.height), applyMatrix(m, 0, fit.height)];
}

// The onion skin's outline look: blur away the details, drop the colour, then push the contrast
// so far that what's left is broad light and dark shapes: where the toy was, not what it looks
// like. The blur scales with the canvas (4 px at 1280 wide), so it looks the same at any size.
export function outlineFilter(canvasWidth: number): string {
  return `blur(${round(Math.max(1, canvasWidth / 320))}px) grayscale(1) contrast(8)`;
}

// How strong the ghost `back` pictures away is: the nearest at `opacity`, each older one half that.
export function onionOpacity(opacity: number, back: number): number {
  return Math.min(1, Math.max(0, opacity)) * 0.5 ** (back - 1);
}

// The background behind a picture, or nothing at all (see-through) behind an empty one.
function clear(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, scene: Scene, seeThrough = false): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, scene.width, scene.height);
  if (!seeThrough) {
    ctx.fillStyle = scene.background ?? "#000000";
    ctx.fillRect(0, 0, scene.width, scene.height);
  }
  ctx.restore();
}

export type Matrix = [a: number, b: number, c: number, d: number, e: number, f: number];

// Where a picture of `size` (already fitted into the canvas) goes, as a canvas transform:
//   1. its centre moves to the canvas centre, shifted by x / y (fractions of the canvas),
//   2. it turns by `rotation` degrees clockwise around its centre,
//   3. it's scaled by `scale`, and mirrored by flipX / flipY.
// Drawing the picture at (0, 0, size.width, size.height) with this matrix puts it in place.
export function frameMatrix(transform: Transform, size: { width: number; height: number }, canvas: { width: number; height: number }): Matrix {
  const angle = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const sx = transform.scale * (transform.flipX ? -1 : 1);
  const sy = transform.scale * (transform.flipY ? -1 : 1);
  const cx = canvas.width / 2 + transform.x * canvas.width;
  const cy = canvas.height / 2 + transform.y * canvas.height;
  // translate(cx, cy) · rotate(angle) · scale(sx, sy) · translate(-w/2, -h/2)
  const a = cos * sx;
  const b = sin * sx;
  const c = -sin * sy;
  const d = cos * sy;
  const e = cx - a * (size.width / 2) - c * (size.height / 2);
  const f = cy - b * (size.width / 2) - d * (size.height / 2);
  return [a, b, c, d, e, f];
}

// The same placement as frameMatrix, as a CSS transform for an element the size of the frame
// with the photo fitted inside it (background-size: contain) and the default transform-origin
// (its centre): the timeline thumbnails, so they show a picture moved, sized, turned or flipped as
// the stage does. Percentages of the element are fractions of the frame, so it works at any size.
// "none" for a picture that wasn't changed.
export function transformCss(transform: Transform): string {
  const { x, y, scale, rotation, flipX, flipY } = transform;
  if (x === 0 && y === 0 && scale === 1 && rotation === 0 && !flipX && !flipY) return "none";
  const n = (value: number) => Math.round(value * 1e4) / 1e4;
  return `translate(${n(x * 100)}%, ${n(y * 100)}%) rotate(${n(rotation)}deg) scale(${n(scale * (flipX ? -1 : 1))}, ${n(scale * (flipY ? -1 : 1))})`;
}

// Where the matrix sends a point of the picture (for tests and hit-testing, step 18).
export function applyMatrix([a, b, c, d, e, f]: Matrix, x: number, y: number): { x: number; y: number } {
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}

// Brightness and contrast as a canvas filter; "none" when both are unchanged (1).
export function adjustFilter(adjust: Adjust): string {
  const parts = [];
  if (adjust.brightness !== 1) parts.push(`brightness(${round(adjust.brightness)})`);
  if (adjust.contrast !== 1) parts.push(`contrast(${round(adjust.contrast)})`);
  return parts.length ? parts.join(" ") : "none";
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// The tick a frame starts at, for showing a selected frame: renderAt(ctx, scene, images, startTick(frames, i)).
export function startTick(frames: readonly Pick<Frame, "hold">[], index: number): number {
  return frameStarts(frames)[index] ?? 0;
}

