export type Rect = { x: number; y: number; width: number; height: number };

// The size of a source fitted whole inside a target, like CSS `object-fit: contain`: the
// picture is never cropped, and bars fill the rest (letterboxing). Used by the renderer.
export function containSize(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) return { width: 0, height: 0 };
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  return { width: sourceWidth * scale, height: sourceHeight * scale };
}

// The centred part of a source that fills a target of another shape without stretching,
// like CSS `object-fit: cover`. A 4:3 webcam into a 16:9 frame loses a strip at the top and
// bottom; a portrait phone camera loses the sides. Used by capture (step 05) and the renderer.
export function coverCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): Rect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) return { x: 0, y: 0, width: 0, height: 0 };

  const targetRatio = targetWidth / targetHeight;
  if (sourceWidth / sourceHeight > targetRatio) {
    const width = sourceHeight * targetRatio;   // source is wider: cut the sides
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / targetRatio;      // source is taller: cut top and bottom
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}

// The camera's framing: a digital zoom into the live picture and where in it the frame sits, so a
// child can frame a shot closer without moving the camera. zoom: 1 (all of it) to MAX_FRAMING_ZOOM;
// x and y: -1 (as far left / up as the zoom allows) to 1 (right / down), 0 in the middle.
export type Framing = { zoom: number; x: number; y: number };
export const NO_FRAMING: Framing = { zoom: 1, x: 0, y: 0 };
export const MAX_FRAMING_ZOOM = 3;
export const NUDGE_STEP = 0.1;   // a nudge: a tenth of the way across what the zoom leaves to move in

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

// A framing with every value in range (a remembered one may be old, or hand-edited).
export function clampFraming(framing: Framing): Framing {
  const zoom = clamp(Number.isFinite(framing.zoom) ? framing.zoom : 1, 1, MAX_FRAMING_ZOOM);
  if (zoom === 1) return NO_FRAMING;   // nothing to move in
  return { zoom, x: clamp(Number.isFinite(framing.x) ? framing.x : 0, -1, 1), y: clamp(Number.isFinite(framing.y) ? framing.y : 0, -1, 1) };
}

// The framing moved by one nudge (dx, dy: -1, 0 or 1 steps).
export function nudgeFraming(framing: Framing, dx: number, dy: number): Framing {
  return clampFraming({ ...framing, x: framing.x + dx * NUDGE_STEP, y: framing.y + dy * NUDGE_STEP });
}

// The part of a crop (the camera picture's cover crop) the framing keeps: 1/zoom of it, moved
// from the middle by x and y of the room that leaves. What a capture saves.
export function framedCrop(crop: Rect, framing: Framing): Rect {
  const { zoom, x, y } = clampFraming(framing);
  const width = crop.width / zoom, height = crop.height / zoom;
  return {
    x: crop.x + (crop.width - width) / 2 + (x * (crop.width - width)) / 2,
    y: crop.y + (crop.height - height) / 2 + (y * (crop.height - height)) / 2,
    width,
    height,
  };
}

// The same framing for the live picture on the stage (shown cover-cropped): scaled by the zoom
// round its middle, and moved (in % of its own size, before the scale) so the part framedCrop
// keeps fills the stage. CSS: `scale(${scale}) translate(${moveX}%, ${moveY}%)`.
export function framingTransform(framing: Framing): { scale: number; moveX: number; moveY: number } {
  const { zoom, x, y } = clampFraming(framing);
  const room = (1 - 1 / zoom) / 2;   // how far (of the picture's size) the middle can move each way
  return { scale: zoom, moveX: -x * room * 100 || 0, moveY: -y * room * 100 || 0 };
}
