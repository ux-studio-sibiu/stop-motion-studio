"use client";

import { useEffect, useRef } from "react";
import { inOrder } from "@/core/model";
import { renderAt, startTick } from "@/core/render";
import { useEditor, useOrderedFrames } from "@/store/useEditor";
import { bitmaps } from "./media";

// The stage when the camera is off: the selected picture (or the last one), drawn by the
// renderer exactly as playback and export will draw it, with its position and brightness.
// The canvas is the project's resolution; CSS scales it to fit the stage.
export function StagePicture() {
  const frames = useOrderedFrames();
  const selection = useEditor((state) => state.selection);
  const width = useEditor((state) => state.project?.width ?? 1280);
  const height = useEditor((state) => state.project?.height ?? 720);
  const canvas = useRef<HTMLCanvasElement>(null);

  const order = frames.map((frame) => frame.id);
  const shownId = inOrder(order, selection).at(-1) ?? order.at(-1);
  const index = shownId ? order.indexOf(shownId) : -1;

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || index < 0) return;
    let stopped = false;
    const scene = { width, height, frames };
    const draw = () => {
      if (stopped) return;
      const result = renderAt(ctx, scene, bitmaps.get, startTick(frames, index));
      // Not decoded yet: decode it, then draw again (the background shows meanwhile).
      if (result.missing) void bitmaps.load(frames[index].imageId).then((bitmap) => { if (bitmap) draw(); });
    };
    draw();
    return () => { stopped = true; };
  }, [frames, index, width, height]);

  return <canvas ref={canvas} className="stage-picture" width={width} height={height} role="img" aria-label={index >= 0 ? `Picture ${index + 1}` : "No picture"} />;
}
