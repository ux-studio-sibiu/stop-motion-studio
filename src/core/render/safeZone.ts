import { SAFE_MARGIN } from "../model";
import type { Rect } from "./fit";

// The safe zone: a band along every edge of the picture that the video leaves out. The stage
// shows it veiled with a dotted line, so a child frames the shot inside it, and wobbly edges
// (the table, the wall behind the set, a moved camera) don't end up in the film. Export (steps
// 25-27) crops to exportRect; everything else (capture, the renderer) keeps the whole picture,
// so moving a picture later can still bring the edge into view.

export { SAFE_MARGIN };   // the default, 20 project px on each side; a project can set its own (safeMargin())

// The part of the picture that ends up in the video. Width and height stay even (H.264 needs
// that, step 26), taking any odd pixel off the right or bottom.
export function exportRect(size: { width: number; height: number }, margin = SAFE_MARGIN): Rect {
  const m = Math.max(0, Math.min(margin, Math.floor((Math.min(size.width, size.height) - 2) / 2)));
  const even = (n: number) => Math.max(2, n - (n % 2));
  return { x: m, y: m, width: even(size.width - 2 * m), height: even(size.height - 2 * m) };
}
