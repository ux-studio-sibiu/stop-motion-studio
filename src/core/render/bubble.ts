import { bubbleProps, type BubbleVariant, type Element } from "../model";
import { drawLettering, outlineWidth } from "./lettering";

// Speech bubbles (step 23), drawn on the canvas like the picture, so the stage, playback and
// export all show the same bubble.
//   speech   a rounded box with a pointed tail
//   thought  an oval with a trail of little circles
//   spiked   a jagged burst with a pointed tail, for shouting
// Filled with the bubble's colour, with an outline of its thickness and colour (or none), and
// centred text in its font and colour. The tail can be left off.
// The tail reaches `tail`, a point in fractions of the box, so it moves and turns with the bubble.

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// Where the text goes inside a bubble of this size (px, relative to its top-left corner): inset so
// it clears the rounded corners, more for the oval thought bubble.
export function bubbleTextArea(width: number, height: number, variant: BubbleVariant): { x: number; y: number; width: number; height: number } {
  const [ix, iy] = { speech: [0.08, 0.12], thought: [0.17, 0.2], spiked: [0.2, 0.25] }[variant];
  return { x: width * ix, y: height * iy, width: width * (1 - 2 * ix), height: height * (1 - 2 * iy) };
}

export function drawBubble(ctx: Ctx, element: Element, frame: { width: number; height: number }): void {
  const props = bubbleProps(element);
  const w = element.box.width * frame.width;
  const h = element.box.height * frame.height;
  const cx = element.box.x * frame.width + w / 2;
  const cy = element.box.y * frame.height + h / 2;
  const tail = { x: (props.tail.x - 0.5) * w, y: (props.tail.y - 0.5) * h };   // from the centre
  const line = outlineWidth(props.outline, frame.height);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((element.box.rotation * Math.PI) / 180);
  ctx.lineJoin = "round";
  ctx.lineWidth = line * 2;   // half of it is covered by the white fill, leaving `line` outside
  ctx.strokeStyle = props.outlineColour;
  ctx.fillStyle = props.fill;

  const all = { speech: speechParts, thought: thoughtParts, spiked: spikedParts }[props.variant](w, h, tail);
  const parts = props.showTail ? all : all.slice(-1);   // the body is always last
  // Outlines first, then the fills over them: where the tail meets the body, each covers the
  // other's inner outline, so the bubble reads as one shape.
  if (line > 0) for (const part of parts) { part(ctx); ctx.stroke(); }
  for (const part of parts) { part(ctx); ctx.fill(); }

  const area = bubbleTextArea(w, h, props.variant);
  drawLettering(ctx, props.text, { ...area, x: area.x - w / 2, y: area.y - h / 2 }, { font: props.font, size: props.textSize, colour: props.textColour, frameHeight: frame.height });
  ctx.restore();
}

type Part = (ctx: Ctx) => void;

// A rounded box, and a triangle from its middle to the tail point.
function speechParts(w: number, h: number, tail: { x: number; y: number }): Part[] {
  const r = Math.min(w, h) * 0.3;
  const body: Part = (ctx) => { ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r); };
  return [tipTowards(tail, Math.min(w, h) * 0.16), body];
}

// A burst: points around the oval, every other one pulled in, the outer ones a little uneven so
// it looks drawn by hand; and the same pointed tail as speech.
function spikedParts(w: number, h: number, tail: { x: number; y: number }): Part[] {
  const spikes = 12;
  const body: Part = (ctx) => {
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const reach = i % 2 === 1 ? 0.72 : [1, 0.9, 0.96][(i / 2) % 3];
      const x = (w / 2) * reach * Math.cos(angle);
      const y = (h / 2) * reach * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  return [tipTowards(tail, Math.min(w, h) * 0.12), body];
}

// A triangle from the middle to the tail point; `base` is half its width where it leaves the body.
function tipTowards(tail: { x: number; y: number }, base: number): Part {
  const length = Math.hypot(tail.x, tail.y) || 1;
  const nx = -tail.y / length;
  const ny = tail.x / length;
  return (ctx) => { ctx.beginPath(); ctx.moveTo(nx * base, ny * base); ctx.lineTo(tail.x, tail.y); ctx.lineTo(-nx * base, -ny * base); ctx.closePath(); };
}

// An oval, and three circles getting smaller towards the tail point.
function thoughtParts(w: number, h: number, tail: { x: number; y: number }): Part[] {
  const body: Part = (ctx) => { ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); };
  const angle = Math.atan2(tail.y, tail.x);
  // Where the oval's edge is, towards the tail.
  const edge = { x: (w / 2) * Math.cos(angle), y: (h / 2) * Math.sin(angle) };
  const unit = Math.min(w, h);
  const dots: Part[] = [0.35, 0.68, 1].map((t, i) => (ctx) => {
    ctx.beginPath();
    ctx.arc(edge.x + (tail.x - edge.x) * t, edge.y + (tail.y - edge.y) * t, unit * [0.09, 0.065, 0.04][i], 0, Math.PI * 2);
  });
  return [...dots, body];
}
