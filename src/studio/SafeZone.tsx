"use client";

import { SAFE_MARGIN, safeMargin } from "@/core/model";
import { exportRect } from "@/core/render";
import { useEditor } from "@/store/useEditor";

// The safe zone on the stage: the band the video leaves out, veiled, with a dotted line where
// the video's edge is. Drawn in project pixels (the SVG's viewBox), over the camera or the
// picture, which fill the stage the same way. It never takes the pointer.
export function SafeZone() {
  const width = useEditor((state) => state.project?.width ?? 1280);
  const height = useEditor((state) => state.project?.height ?? 720);
  const margin = useEditor((state) => state.safeMarginPreview ?? (state.project ? safeMargin(state.project) : SAFE_MARGIN));
  const inside = exportRect({ width, height }, margin);
  if (margin === 0) return null;   // the whole picture is filmed: nothing to veil
  const hole = `M${inside.x} ${inside.y}h${inside.width}v${inside.height}h${-inside.width}z`;

  return (
    <svg className="safe-zone" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="veil" fillRule="evenodd" d={`M0 0h${width}v${height}h${-width}z ${hole}`} />
      <rect className="edge" x={inside.x} y={inside.y} width={inside.width} height={inside.height} />
    </svg>
  );
}
