import { SAFE_MARGIN, safeMargin, type Project } from "../model";
import type { Rect } from "./fit";

// The safe zone: a band along every edge of the picture that the video leaves out. The stage
// shows it veiled with a dotted line, so a child frames the shot inside it, and wobbly edges
// (the table, the wall behind the set, a moved camera) don't end up in the film. Export (steps
// 25-27) crops to exportRect; everything else (capture, the renderer) keeps the whole picture,
// so moving a picture later can still bring the edge into view.

export { SAFE_MARGIN };   // the default, 20 project px off the short sides; a project can set its own (safeMargin())

// An animation's exported part: its size, inside its own safe zone. What every export uses.
export function projectExportRect(project: Pick<Project, "width" | "height" | "safeMargin">): Rect {
  return exportRect(project, safeMargin(project));
}

// The part of the picture that ends up in the video: a smaller copy of the picture's own shape,
// in the middle, so a GIF or video keeps the picture's proportions at any size. `margin` is what's
// taken off the short sides (top and bottom of a wide picture); the long sides lose as large a
// share (20 px top and bottom of 1280 × 720 is about 36 px left and right: 1208 × 680).
// Width and height stay even (H.264 needs that, step 26), so the shape is kept to within a pixel;
// it's rounded down, inside the line, and centred.
export function exportRect(size: { width: number; height: number }, margin = SAFE_MARGIN): Rect {
  const short = Math.min(size.width, size.height);
  const m = Math.max(0, Math.min(margin, Math.floor((short - 2) / 2)));
  const scale = (short - 2 * m) / short;
  const even = (n: number) => Math.max(2, Math.floor(n + 1e-9) - (Math.floor(n + 1e-9) % 2));
  const width = even(size.width * scale);
  const height = even(size.height * scale);
  return { x: Math.floor((size.width - width) / 2), y: Math.floor((size.height - height) / 2), width, height };
}
