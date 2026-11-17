"use client";

import { memo, useCallback, useRef } from "react";
import type { Element, Frame } from "@/core/model";
import { adjustFilter, drawElements, transformCss } from "@/core/render";
import { useEditor } from "@/store/useEditor";
import { thumbs } from "../media";
import { useCanvasDraw } from "../useCanvasDraw";

const OBJECTS_WIDTH = 320;   // px of the objects' canvas: twice the thumbnail photo, so lines stay crisp

// A picture's thumbnail, close to how the stage shows it: the small photo taken with the picture,
// placed with the picture's own move, size, turn and flip (a CSS transform, transformCss) and
// brightness and contrast (a CSS filter), with its objects drawn on top by the stage's own
// drawing code. Inside a frame-shaped view, so a thumbnail narrower than the frame shows its
// middle. Cheap: the browser does the transform and the filter; only the objects are drawn.
export function Thumb({ frame }: { frame: Pick<Frame, "imageId" | "transform" | "adjust" | "elements"> }) {
  const url = thumbs.url(frame.imageId);
  const filter = adjustFilter(frame.adjust);
  const transform = transformCss(frame.transform);
  return (
    <span className="thumb">
      <span className="view">
        <span className="photo" style={{ backgroundImage: url ? `url("${url}")` : undefined, filter: filter === "none" ? undefined : filter, transform: transform === "none" ? undefined : transform }} />
        {frame.elements.length > 0 && <ThumbObjects elements={frame.elements} />}
      </span>
    </span>
  );
}

// Only redrawn when this picture's objects change (memo), so dragging a bubble on the stage
// redraws one thumbnail, not the whole timeline's.
const ThumbObjects = memo(function ThumbObjects({ elements }: { elements: readonly Element[] }) {
  const width = useEditor((state) => state.project?.width ?? 1280);
  const height = useEditor((state) => state.project?.height ?? 720);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scale = OBJECTS_WIDTH / width;
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawElements(ctx, { width, height }, elements);
    return [];
  }, [elements, width, height, scale]);
  useCanvasDraw(canvas, draw);
  return <canvas ref={canvas} className="objects" width={OBJECTS_WIDTH} height={Math.round(height * scale)} aria-hidden="true" />;
});
