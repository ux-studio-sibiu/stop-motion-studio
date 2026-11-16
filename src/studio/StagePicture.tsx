"use client";

import { useCallback, useRef } from "react";
import { frameIndexAt, inOrder } from "@/core/model";
import { renderAt, startTick } from "@/core/render";
import { useEditor, useShownFrames } from "@/store/useEditor";
import { bitmaps } from "./media";
import { useCanvasDraw } from "./useCanvasDraw";

// A picture on the stage, drawn by the renderer exactly as export will draw it:
//   - while playing, whatever is at the playhead;
//   - otherwise the selected picture (or the last one), when the camera is off.
// The canvas is the project's resolution; CSS scales it to fit the stage.
export function StagePicture() {
  const frames = useShownFrames();   // with any change not saved yet
  const selection = useEditor((state) => state.selection);
  const isPlaying = useEditor((state) => state.isPlaying);
  const playhead = useEditor((state) => state.playhead);
  const width = useEditor((state) => state.project?.width ?? 1280);
  const height = useEditor((state) => state.project?.height ?? 720);
  const canvas = useRef<HTMLCanvasElement>(null);

  const index = isPlaying ? frameIndexAt(frames, playhead) : shownIndex(frames.map((frame) => frame.id), selection);
  const tick = isPlaying ? playhead : startTick(frames, index);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const frame = frames[index];
    if (!frame) return [];
    // Not decoded yet: keep what's on the canvas until it is (no black flash), then draw.
    if (!bitmaps.has(frame.imageId)) return [frame.imageId];
    renderAt(ctx, { width, height, frames }, bitmaps.get, tick);
    return [];
  }, [frames, index, tick, width, height]);
  useCanvasDraw(canvas, draw);

  return <canvas ref={canvas} className="stage-picture" width={width} height={height} role="img" aria-label={index >= 0 ? `Picture ${index + 1}` : "No picture"} />;
}

// The picture the stage shows when not playing: the rightmost selected one, or the last. -1 if none.
export function shownIndex(order: readonly string[], selection: readonly string[]): number {
  const id = inOrder(order, selection).at(-1) ?? order.at(-1);
  return id ? order.indexOf(id) : -1;
}
