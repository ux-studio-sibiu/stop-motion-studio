import { DEFAULT_TRANSFORM } from "./project";
import type { Transform } from "./types";

// Moving, sizing, turning and flipping a picture (step 18). A transform stores x / y as
// fractions of the project (step 02), so it survives a change of resolution; these work in
// project pixels, so one arrow press is one pixel of the video whatever the screen size.

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 10;

// Where the picture's centre is, in project pixels.
export function pictureCentre(transform: Transform, size: Size): Point {
  return { x: size.width / 2 + transform.x * size.width, y: size.height / 2 + transform.y * size.height };
}

export function moveBy(transform: Transform, dx: number, dy: number, size: Size): Transform {
  return { ...transform, x: transform.x + dx / size.width, y: transform.y + dy / size.height };
}

// Sizes the picture by `factor` around `point` (project pixels): whatever is under the point
// stays under it, so the centre moves too (otherwise the picture slides away from the pointer).
// The size stays between 10% and 10×.
export function scaleAround(transform: Transform, factor: number, point: Point, size: Size): Transform {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, transform.scale * factor));
  const applied = scale / transform.scale;
  const centre = pictureCentre(transform, size);
  const next = { x: point.x + (centre.x - point.x) * applied, y: point.y + (centre.y - point.y) * applied };
  return { ...transform, scale, x: (next.x - size.width / 2) / size.width, y: (next.y - size.height / 2) / size.height };
}

// Turns around the picture's own centre (the renderer turns it there, step 15). The angle is
// kept between -180 and 180.
export function rotateBy(transform: Transform, degrees: number): Transform {
  return { ...transform, rotation: normaliseAngle(transform.rotation + degrees) };
}

export function normaliseAngle(degrees: number): number {
  const turned = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return turned === -180 ? 180 : Math.round(turned * 100) / 100;
}

export function flip(transform: Transform, axis: "x" | "y"): Transform {
  return axis === "x" ? { ...transform, flipX: !transform.flipX } : { ...transform, flipY: !transform.flipY };
}

export function resetTransform(): Transform {
  return { ...DEFAULT_TRANSFORM };
}

export function sameTransform(a: Transform, b: Transform): boolean {
  return a.x === b.x && a.y === b.y && a.scale === b.scale && a.rotation === b.rotation && a.flipX === b.flipX && a.flipY === b.flipY;
}

// The angle (degrees, clockwise) from `centre` to `point`: for the rotate handle.
export function angleTo(centre: Point, point: Point): number {
  return (Math.atan2(point.y - centre.y, point.x - centre.x) * 180) / Math.PI;
}
