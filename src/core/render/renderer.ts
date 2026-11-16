import { frameIndexAt, frameStarts, type Adjust, type Frame, type Transform } from "../model";
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
};

// A decoded picture: an ImageBitmap, an <img>, a canvas... anything drawImage takes, with a size.
export type DrawableImage = CanvasImageSource & { width: number; height: number };

export type ImageSource = (imageId: string) => DrawableImage | undefined;

// What a render drew: which frame was on screen, and whether its picture was missing (not
// decoded yet), so the caller can draw again once it is.
export type RenderResult = { frameIndex: number; missing: boolean };

// Draws the animation as it is at `tick` (ticks from the start). A time, not a frame index,
// because overlays (step 24) live in time, not on a frame.
export function renderAt(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, scene: Scene, images: ImageSource, tick: number): RenderResult {
  clear(ctx, scene);
  const frameIndex = frameIndexAt(scene.frames, tick);
  const frame = scene.frames[frameIndex];
  if (!frame) return { frameIndex, missing: false };
  const image = images(frame.imageId);
  if (!image) return { frameIndex, missing: true };
  drawFrame(ctx, scene, frame, image);
  return { frameIndex, missing: false };
}

// One frame's picture with its position and look. Exposed for onion skin (step 17), which
// draws neighbouring frames faintly on top of each other.
export function drawFrame(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, scene: Pick<Scene, "width" | "height">, frame: Pick<Frame, "transform" | "adjust">, image: DrawableImage): void {
  const size = containSize(image.width, image.height, scene.width, scene.height);
  if (size.width === 0) return;
  ctx.save();
  ctx.setTransform(...frameMatrix(frame.transform, size, scene));
  const filter = adjustFilter(frame.adjust);
  if (filter !== "none" && "filter" in ctx) ctx.filter = filter;
  ctx.drawImage(image, 0, 0, size.width, size.height);
  ctx.restore();
}

function clear(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, scene: Scene): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = scene.background ?? "#000000";
  ctx.fillRect(0, 0, scene.width, scene.height);
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
