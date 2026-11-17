import type { Adjust } from "../model";
import type { DrawableImage } from "./renderer";
import { scratchCanvas } from "./scratch";

// Brightness and contrast without ctx.filter (step 20). The renderer uses the canvas filter
// where the browser has one (adjustFilter); older Safari doesn't, so there the picture is copied,
// its pixels are adjusted here, and the copy is drawn instead. The maths follows CSS
// `brightness(b) contrast(c)`, applied in that order, so both ways look the same.

// Adjusts RGBA pixels in place (alpha untouched).
export function adjustPixels(data: Uint8ClampedArray, adjust: Adjust): void {
  const table = adjustTable(adjust);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = table[data[i]];
    data[i + 1] = table[data[i + 1]];
    data[i + 2] = table[data[i + 2]];
  }
}

// What each channel value becomes: brightness multiplies, contrast spreads around the middle;
// each step is kept between black and white, as CSS filters are.
export function adjustTable({ brightness, contrast }: Adjust): Uint8ClampedArray {
  const table = new Uint8ClampedArray(256);
  for (let value = 0; value < 256; value++) {
    const lit = Math.min(1, (value / 255) * brightness);
    table[value] = Math.round(((lit - 0.5) * contrast + 0.5) * 255);
  }
  return table;
}

// Does this context apply ctx.filter? Checked on its prototype: setting an unknown property on the
// context would just store it and read back fine.
export function canvasFilterWorks(ctx: object): boolean {
  return "filter" in Object.getPrototypeOf(ctx);
}

// A copy of `image` with its pixels adjusted, kept for the next draw of the same picture with the
// same values (a slider drag redraws often). One copy per picture; it goes with the picture.
const copies = new WeakMap<object, { key: string; canvas: OffscreenCanvas | HTMLCanvasElement }>();

export function adjustedCopy(image: DrawableImage, adjust: Adjust): DrawableImage {
  const key = `${adjust.brightness},${adjust.contrast}`;
  const kept = copies.get(image);
  if (kept?.key === key) return kept.canvas;
  const ctx = scratchCanvas(image.width, image.height);
  if (!ctx) return image;
  const { canvas } = ctx;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, image.width, image.height);
  adjustPixels(pixels.data, adjust);
  ctx.putImageData(pixels, 0, 0);
  copies.set(image, { key, canvas });
  return canvas;
}
