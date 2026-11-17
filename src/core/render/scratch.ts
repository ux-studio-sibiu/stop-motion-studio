// A canvas off screen to draw on before drawing the result somewhere else: an OffscreenCanvas
// where there is one, else a detached <canvas>; null where there's neither (Node). Used by the
// brightness fallback (adjust.ts) and see-through ghosts with objects (renderer.ts).
export type ScratchContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function scratchCanvas(width: number, height: number): ScratchContext | null {
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : typeof document !== "undefined" ? Object.assign(document.createElement("canvas"), { width, height }) : null;
  return (canvas?.getContext("2d") as ScratchContext | null | undefined) ?? null;
}
