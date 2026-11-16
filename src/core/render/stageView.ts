// Looking closer at the stage (step 19): the view zoom, separate from the picture's own size
// (PLAN.md §1, "Two zooms"). It's only how the stage is shown; the picture and the export don't
// change. `zoom` is relative to the stage fitting its space (1 = fit). `x` / `y` are the
// top-left corner of what's visible, as fractions of the whole stage, so the view stays put
// when the window is resized.

export type StageView = { zoom: number; x: number; y: number };

export const FIT_VIEW: StageView = { zoom: 1, x: 0, y: 0 };
const MAX_STAGE_ZOOM = 8;

// A view kept in range: zoom from fit to 8×, never panned past the stage's edges.
export function clampView(view: Partial<StageView>): StageView {
  const zoom = Number.isFinite(view.zoom) ? Math.min(MAX_STAGE_ZOOM, Math.max(1, view.zoom!)) : 1;
  const room = 1 - 1 / zoom;   // how far the visible part can go
  const keep = (value: number | undefined) => (Number.isFinite(value) ? Math.min(room, Math.max(0, value!)) : room / 2);
  return { zoom, x: keep(view.x), y: keep(view.y) };
}

// Zooms to `zoom` keeping the point at `focus` (a fraction of what's visible; the middle by
// default) where it is on screen.
export function zoomView(view: StageView, zoom: number, focus = { x: 0.5, y: 0.5 }): StageView {
  const next = clampView({ zoom }).zoom;
  const point = { x: view.x + focus.x / view.zoom, y: view.y + focus.y / view.zoom };
  return clampView({ zoom: next, x: point.x - focus.x / next, y: point.y - focus.y / next });
}

// Pans by a fraction of the whole stage.
export function panView(view: StageView, dx: number, dy: number): StageView {
  return clampView({ zoom: view.zoom, x: view.x + dx, y: view.y + dy });
}
