"use client";

import { useEffect, useRef } from "react";
import { frameIndexAt, inOrder } from "@/core/model";
import { renderAt, startTick } from "@/core/render";
import { useEditor, useOrderedFrames } from "@/store/useEditor";
import { bitmaps } from "./media";

// A picture on the stage, drawn by the renderer exactly as export will draw it:
//   - while playing, whatever is at the playhead;
//   - otherwise the selected picture (or the last one), when the camera is off.
// The canvas is the project's resolution; CSS scales it to fit the stage.
export function StagePicture() {
  const frames = useOrderedFrames();
  const selection = useEditor((state) => state.selection);
  const isPlaying = useEditor((state) => state.isPlaying);
  const playhead = useEditor((state) => state.playhead);
  const width = useEditor((state) => state.project?.width ?? 1280);
  const height = useEditor((state) => state.project?.height ?? 720);
  const canvas = useRef<HTMLCanvasElement>(null);

  const order = frames.map((frame) => frame.id);
  const shownId = inOrder(order, selection).at(-1) ?? order.at(-1);
  const index = isPlaying ? frameIndexAt(frames, playhead) : shownId ? order.indexOf(shownId) : -1;
  const tick = isPlaying ? playhead : startTick(frames, index);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    const frame = frames[index];
    if (!ctx || !frame) return;
    let stopped = false;
    const draw = () => { if (!stopped) renderAt(ctx, { width, height, frames }, bitmaps.get, tick); };
    // Not decoded yet: keep what's on the canvas until it is, then draw (no black flash).
    if (bitmaps.has(frame.imageId)) draw();
    else void bitmaps.load(frame.imageId).then((bitmap) => { if (bitmap) draw(); });
    return () => { stopped = true; };
  }, [frames, index, tick, width, height]);

  return <canvas ref={canvas} className="stage-picture" width={width} height={height} role="img" aria-label={index >= 0 ? `Picture ${index + 1}` : "No picture"} />;
}
