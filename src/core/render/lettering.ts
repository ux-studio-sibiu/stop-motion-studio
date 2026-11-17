import { bubbleFont, type OutlineWidth, type TextSize } from "../model";
import { fitText } from "./text";

// What every kind of object draws the same way (steps 23-24): fitted text, and outlines.

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Area = { x: number; y: number; width: number; height: number };

const LINE_HEIGHT = 1.15;

// The largest text for each size, as a fraction of the frame's height.
const TEXT_MAX: Readonly<Record<TextSize, number>> = { small: 0.05, medium: 0.07, large: 0.1, huge: 0.14 };

// The font sizes text may take: at most its size's share of the frame's height, and shrinking to
// fit down to 3.5%, so it stays readable when the video is small (a 360 px tall GIF still gets
// 13 px text).
export function fontRange(frameHeight: number, size: TextSize = "medium"): { max: number; min: number } {
  return { max: frameHeight * TEXT_MAX[size], min: frameHeight * 0.035 };
}

// An outline's thickness in px for a frame this tall: medium is 0.4% of its height (at least 2 px).
const OUTLINE: Readonly<Record<OutlineWidth, number>> = { none: 0, thin: 0.5, medium: 1, thick: 2 };
export function outlineWidth(outline: OutlineWidth, frameHeight: number): number {
  return Math.max(2, frameHeight * 0.004) * OUTLINE[outline];
}

// Text wrapped, fitted and centred in `area` (in the context's current coordinates), in one of
// BUBBLE_FONTS at most `size` big, in `colour`. Nothing for empty text.
export function drawLettering(ctx: Ctx, text: string, area: Area, { font: fontId, size, colour, frameHeight }: { font: string; size: TextSize; colour: string; frameHeight: number }): void {
  if (!text.trim()) return;
  const font = bubbleFont(fontId);
  const fontAt = (px: number) => `${font.weight} ${px}px ${font.family}`;
  const fitted = fitText(text, area, (piece, px) => { ctx.font = fontAt(px); return ctx.measureText(piece).width; }, { ...fontRange(frameHeight, size), lineHeight: LINE_HEIGHT });
  ctx.font = fontAt(fitted.size);
  ctx.fillStyle = colour;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const step = fitted.size * LINE_HEIGHT;
  const top = area.y + area.height / 2 - ((fitted.lines.length - 1) * step) / 2;
  fitted.lines.forEach((line, i) => ctx.fillText(line, area.x + area.width / 2, top + i * step));
}
