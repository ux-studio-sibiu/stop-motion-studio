import type { Frame, Overlay } from "../model";
import { exportFileName, exportSegments, type Segment } from "./segments";
import type { Rect } from "../render/fit";

// GIF export (step 25), the parts that are plain maths: which GIF frames the animation becomes,
// how long each shows, and how big the file's pictures are. The encoding itself is an adapter
// (adapters/export/gif).

// One picture of the GIF: the animation as it is from `tick`, for `ticks` ticks (an export segment),
// shown for `delay` hundredths of a second (the unit GIF counts in).
export type GifFrame = Segment & { delay: number };

// The GIF's pictures: one per export segment (exportSegments: only where the screen changes).
// Delays are rounded so they add up to the animation's real length (rounding each one alone
// would drift: 3 ticks at 8 fps are 37.5 cs, which 38 + 38 + 38... would stretch).
export function gifFrames(frames: readonly Pick<Frame, "hold">[], overlays: readonly Pick<Overlay, "id" | "start" | "length">[], fps: number): GifFrame[] {
  const cs = (tick: number) => Math.round((tick * 100) / fps);
  return exportSegments(frames, overlays).map(({ tick, ticks }) => ({ tick, ticks, delay: cs(tick + ticks) - cs(tick) }));
}

// Small and medium are a set width; full is the exported part as it is (1208 × 680 for 1280 × 720
// with the default safe zone): sharp, but several times the file.
export type GifSize = "small" | "medium" | "full";
export const GIF_SIZES: readonly GifSize[] = ["small", "medium", "full"];
export const GIF_WIDTH: Readonly<Record<GifSize, number>> = { small: 320, medium: 640, full: Infinity };   // medium is the default
export const BIG_GIF_BYTES = 20 * 1024 * 1024;   // above this, the studio says the file is big

// Quality: how hard the GIF is squeezed, in three steps. Lower makes a smaller file:
//   high    every picture whole, 256 colours of its own (as it looks on the stage);
//   medium  after the first, only what changed is stored; the rest stays from before (see-through
//           in the file). "Changed" allows for camera noise: a colour within `tolerance` (of 255,
//           per channel) counts as the same. In stop-motion the set stays put, so most of each
//           picture is kept from before, and that compresses very well;
//   low     the same with more allowance, 128 colours, in coarser steps: smallest, a little rougher.
export type GifQuality = "low" | "medium" | "high";
export const GIF_QUALITIES: readonly GifQuality[] = ["low", "medium", "high"];
// tolerance 0: every picture whole. transparent: the animation has empty (see-through) pictures, so
// the GIF keeps their see-through pixels (every picture whole then, cleared before the next).
export type GifEncoding = { colours: number; format: "rgb565" | "rgb444"; tolerance: number; transparent?: boolean };
export const GIF_ENCODING: Readonly<Record<GifQuality, GifEncoding>> = {
  high: { colours: 256, format: "rgb565", tolerance: 0 },
  medium: { colours: 256, format: "rgb565", tolerance: 8 },
  low: { colours: 128, format: "rgb444", tolerance: 20 },
};

// The size of the GIF's pictures: the exported part of the picture (exportRect, inside the safe
// zone, the picture's own shape) scaled to the size's width, never up, keeping its shape. Even
// numbers, like the video.
export function gifSize(rect: Pick<Rect, "width" | "height">, size: GifSize): { width: number; height: number } {
  const width = Math.min(GIF_WIDTH[size], rect.width);
  const height = (rect.height * width) / rect.width;
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(width), height: even(height) };
}

// The GIF's file name: the animation's name (exportFileName).
export const gifFileName = (name: string) => exportFileName(name, "gif");
