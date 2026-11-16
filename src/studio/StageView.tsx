"use client";

import type { ReactNode } from "react";
import { useEditor } from "@/store/useEditor";

// The stage's layers, shown at the view zoom (step 19) when `zoomable` (the Picture tab is open
// on a picture); otherwise fitted. A CSS transform, so every layer (the picture, see-through, the
// safe zone, the editing outline) moves together, and pointer maths that measures the element on
// screen (StageEditor) keeps working. Zooming and panning happen on the stage (StageEditor).
export function StageView({ zoomable, children }: { zoomable: boolean; children: ReactNode }) {
  const view = useEditor((state) => state.stageView);
  const zoomed = zoomable && view.zoom > 1;
  const style = zoomed ? { transform: `scale(${view.zoom}) translate(${-view.x * 100}%, ${-view.y * 100}%)` } : undefined;
  return <div className={`stage-view${zoomed ? " is-zoomed" : ""}`} style={style}>{children}</div>;
}
