import { renderAt, type ImageSource, type RenderResult, type Scene } from "../render/renderer";
import type { Rect } from "../render/fit";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// The three canvases an export draws through: the whole picture at the project's size, the
// exported part of it at the same scale, and the file's size.
export type ExportCanvases = { full: Ctx; crop: Ctx; out: Ctx };

// One picture of an export (GIF now, video later): the animation at `tick`, drawn whole at the
// project's size (through renderAt, like the stage and playback), then only its exported part
// (`rect`: inside the safe zone, exportRect) scaled to the file's size. So what's inside the dotted
// line on the stage is exactly what the file shows.
// The part is cut out first, at full size (no scaling, so nothing is blended), then scaled: scaling
// straight from the whole picture would blend in a little of what's just outside the line.
// `crop` must be rect's size.
export function drawExportFrame({ full, crop, out }: ExportCanvases, scene: Scene, images: ImageSource, tick: number, rect: Rect): RenderResult {
  const result = renderAt(full, scene, images, tick);
  crop.save();
  crop.setTransform(1, 0, 0, 1, 0, 0);
  crop.drawImage(full.canvas, -rect.x, -rect.y);
  crop.restore();
  out.save();
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.imageSmoothingEnabled = true;
  out.imageSmoothingQuality = "high";
  out.drawImage(crop.canvas, 0, 0, out.canvas.width, out.canvas.height);
  out.restore();
  return result;
}
