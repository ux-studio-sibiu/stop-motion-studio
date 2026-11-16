"use client";

import { useCallback, useMemo, useRef } from "react";
import { insertIndexAfter } from "@/core/model";
import { drawOnionSkin } from "@/core/render";
import { withTransformPreview } from "@/store/editorStore";
import { useEditor, useOrderedFrames } from "@/store/useEditor";
import { bitmaps } from "./media";
import { shownIndex } from "./StagePicture";
import { useCanvasDraw } from "./useCanvasDraw";

// See-through: the picture(s) before, drawn faintly with the same renderer, so a toy can be lined
// up with where it was.
//   camera  over the live camera: the picture(s) the next shot follows
//   frame   over a picture on the stage (camera off): the picture(s) before that one, to check
//           or fix how it matches them
// A transparent canvas at the project's size sits exactly over the <video> or the picture: they
// all fill the stage the same way (cover, as capture crops it, step 05), so everything lines up.
// "Spot the difference" (step 19) blends it with what's under it (.is-difference): what lines up
// goes black.
export function OnionSkin({ mode }: { mode: "camera" | "frame" }) {
  const saved = useOrderedFrames();
  const preview = useEditor((state) => state.transformPreview);
  const frames = useMemo(() => withTransformPreview(saved, preview), [saved, preview]);
  const selection = useEditor((state) => state.selection);
  const settings = useEditor((state) => state.onionSkin);
  const width = useEditor((state) => state.project?.width ?? 1280);
  const height = useEditor((state) => state.project?.height ?? 720);
  const canvas = useRef<HTMLCanvasElement>(null);

  // camera: the next capture goes after the selection (step 12), so the ghost is what's before that.
  // frame: the ghost is what's before the picture on the stage.
  const order = frames.map((frame) => frame.id);
  const index = mode === "camera" ? insertIndexAfter(order, selection) : Math.max(0, shownIndex(order, selection));

  const draw = useCallback((ctx: CanvasRenderingContext2D) => drawOnionSkin(ctx, { width, height, frames }, bitmaps.get, index, settings), [frames, index, settings, width, height]);
  useCanvasDraw(canvas, draw);

  if (!settings.on || index === 0) return null;
  return <canvas ref={canvas} className={`onion-skin${settings.difference ? " is-difference" : ""}`} width={width} height={height} aria-hidden="true" />;
}
