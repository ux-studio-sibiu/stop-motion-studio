"use client";

import type { Point, Size } from "@/core/model";

// What every tool on the stage needs from the pointer (the Picture tab's editor, the Objects layer,
// the Draw layer): where it is on the picture, and a redraw at most once per animation frame.

// A point on the screen in project pixels, for a layer laid exactly over the picture.
export function toProjectPoint(layer: Element | null, clientX: number, clientY: number, size: Size): Point {
  const box = layer?.getBoundingClientRect();
  if (!box || box.width === 0 || box.height === 0) return { x: 0, y: 0 };
  return { x: ((clientX - box.left) / box.width) * size.width, y: ((clientY - box.top) / box.height) * size.height };
}

// Runs the latest requested redraw on the next animation frame, once, however many pointer events
// came in meanwhile, so dragging stays smooth. cancel() drops one that's waiting (the gesture
// ended, and draws its last state itself).
export type FrameRunner = { request: (redraw: () => void) => void; cancel: () => void };
export function frameRunner(): FrameRunner {
  let frame = 0;
  let latest: (() => void) | null = null;
  return {
    request: (redraw) => {
      latest = redraw;
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; const run = latest; latest = null; run?.(); });
    },
    cancel: () => { if (frame) cancelAnimationFrame(frame); frame = 0; latest = null; },
  };
}
