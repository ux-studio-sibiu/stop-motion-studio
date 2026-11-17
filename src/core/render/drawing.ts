import { drawingProps, pencilWidth, strokePoints, type Element, type Point } from "../model";

// Free drawings (step 24b), drawn on the canvas like any object, so the stage, thumbnails,
// see-through, playback and export show the same lines.

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function drawDrawing(ctx: Ctx, element: Element, frame: { width: number; height: number }): void {
  for (const stroke of drawingProps(element).strokes) drawStroke(ctx, strokePoints(element, stroke, frame), stroke.colour, pencilWidth(stroke.width, frame.height));
}

// One line through `points` (px), smooth: curves through the midpoints between them, with round
// ends and joins. A single point is a dot. Also what the stage uses while a stroke is being drawn.
export function drawStroke(ctx: Ctx, points: readonly Point[], colour: string, width: number): void {
  if (points.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}
