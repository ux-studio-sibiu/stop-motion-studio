import { NO_FILL, shapeProps, textProps, type Element } from "../model";
import { drawLettering, outlineWidth } from "./lettering";

// Text and shapes (step 24), drawn on the canvas like bubbles, in their box (turned with it).
//   text    its text fitted in the box, on its background colour if it has one
//   shape   a rectangle, an ellipse, or an arrow pointing right across the box; filled (or not)
//           and outlined (or not)

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Frame = { width: number; height: number };

// Into the box's own coordinates: (0, 0) at its centre, turned with it. Returns its size in px.
function intoBox(ctx: Ctx, element: Element, frame: Frame): { w: number; h: number } {
  const w = element.box.width * frame.width;
  const h = element.box.height * frame.height;
  ctx.translate(element.box.x * frame.width + w / 2, element.box.y * frame.height + h / 2);
  ctx.rotate((element.box.rotation * Math.PI) / 180);
  return { w, h };
}

export function drawText(ctx: Ctx, element: Element, frame: Frame): void {
  const props = textProps(element);
  ctx.save();
  const { w, h } = intoBox(ctx, element, frame);
  if (props.fill !== NO_FILL) {
    ctx.fillStyle = props.fill;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.15);
    ctx.fill();
  }
  const inset = Math.min(w, h) * 0.1;
  drawLettering(ctx, props.text, { x: -w / 2 + inset, y: -h / 2 + inset, width: w - 2 * inset, height: h - 2 * inset }, { font: props.font, size: props.textSize, colour: props.textColour, frameHeight: frame.height });
  ctx.restore();
}

export function drawShape(ctx: Ctx, element: Element, frame: Frame): void {
  const props = shapeProps(element);
  ctx.save();
  const { w, h } = intoBox(ctx, element, frame);
  const line = outlineWidth(props.outline, frame.height);
  // Inset by half the outline, so the outline stays inside the box, where the handles are.
  const iw = Math.max(1, w - line);
  const ih = Math.max(1, h - line);
  ctx.beginPath();
  if (props.form === "ellipse") ctx.ellipse(0, 0, iw / 2, ih / 2, 0, 0, Math.PI * 2);
  else if (props.form === "arrow") arrowPath(ctx, iw, ih);
  else ctx.rect(-iw / 2, -ih / 2, iw, ih);
  if (props.fill !== NO_FILL) { ctx.fillStyle = props.fill; ctx.fill(); }
  if (line > 0) { ctx.lineJoin = "round"; ctx.lineWidth = line; ctx.strokeStyle = props.outlineColour; ctx.stroke(); }
  ctx.restore();
}

// A fat arrow pointing right: a shaft half the box's height, and a head as tall as the box,
// taking up to the last 40% of its length (never longer than it is tall, so it stays pointy).
function arrowPath(ctx: Ctx, w: number, h: number): void {
  const head = Math.min(w * 0.4, h);
  const shaft = h / 4;
  const left = -w / 2;
  const neck = w / 2 - head;
  ctx.moveTo(left, -shaft);
  ctx.lineTo(neck, -shaft);
  ctx.lineTo(neck, -h / 2);
  ctx.lineTo(w / 2, 0);
  ctx.lineTo(neck, h / 2);
  ctx.lineTo(neck, shaft);
  ctx.lineTo(left, shaft);
  ctx.closePath();
}
