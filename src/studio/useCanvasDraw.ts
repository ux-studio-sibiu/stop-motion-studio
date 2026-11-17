"use client";

import { useEffect, type RefObject } from "react";
import { bitmaps } from "./media";

// Draws on a canvas with the renderer, whenever `draw` changes (make it with useCallback). The
// draw returns the pictures it couldn't draw because they aren't decoded yet; those are decoded
// and the canvas is drawn again. Only if something was really decoded, so a missing photo can't
// make it loop. Used by the stage, see-through, and later export.
export function useCanvasDraw(canvas: RefObject<HTMLCanvasElement | null>, draw: (ctx: CanvasRenderingContext2D) => readonly string[]) {
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let stopped = false;
    const run = () => {
      if (stopped) return;
      const missing = draw(ctx);
      if (missing.length) void Promise.all(missing.map((id) => bitmaps.load(id))).then((decoded) => { if (decoded.some(Boolean)) run(); });
    };
    run();
    // Text on the canvas (speech bubbles) needs its web font: draw again once it has loaded, or the first
    // drawing would keep the fallback font.
    void document.fonts?.ready.then(run);
    return () => { stopped = true; };
  }, [canvas, draw]);
}
