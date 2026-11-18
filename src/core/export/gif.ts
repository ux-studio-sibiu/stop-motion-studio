import { frameIndexAt, frameStarts, overlayEnd, totalTicks, activeOverlays, type Frame, type Overlay } from "../model";
import type { Rect } from "../render/fit";

// GIF export (step 25), the parts that are plain maths: which GIF frames the animation becomes,
// how long each shows, and how big the file's pictures are. The encoding itself is an adapter
// (adapters/export/gif).

// One picture of the GIF: the animation as it is from `tick`, for `ticks` ticks, shown for
// `delay` hundredths of a second (the unit GIF counts in).
export type GifFrame = { tick: number; ticks: number; delay: number };

// A new GIF frame only where what's on screen changes: a new picture, or an overlay starting or
// ending. A picture held for 4 ticks with nothing changing is one GIF frame, 4 ticks long, so the
// file stays small. Delays are rounded so they add up to the animation's real length (rounding
// each one alone would drift: 3 ticks at 8 fps are 37.5 cs, which 38 + 38 + 38... would stretch).
export function gifFrames(frames: readonly Pick<Frame, "hold">[], overlays: readonly Pick<Overlay, "id" | "start" | "length">[], fps: number): GifFrame[] {
  const total = totalTicks(frames);
  if (total <= 0) return [];
  const cuts = new Set<number>([0, ...frameStarts(frames)]);
  for (const overlay of overlays) {
    cuts.add(overlay.start);
    cuts.add(overlayEnd(overlay));
  }
  const starts = [...cuts].filter((tick) => tick >= 0 && tick < total).sort((a, b) => a - b);

  // What's on screen at a tick: its picture and the overlays showing then.
  const shown = (tick: number) => `${frameIndexAt(frames, tick)}|${activeOverlays(overlays as Overlay[], tick).map((overlay) => overlay.id).join(",")}`;
  const kept = starts.filter((tick, index) => index === 0 || shown(tick) !== shown(starts[index - 1]));

  const cs = (tick: number) => Math.round((tick * 100) / fps);
  return kept.map((tick, index) => {
    const end = kept[index + 1] ?? total;
    return { tick, ticks: end - tick, delay: cs(end) - cs(tick) };
  });
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
export type GifEncoding = { colours: number; format: "rgb565" | "rgb444"; tolerance: number };   // tolerance 0: every picture whole
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

// The file's name: the animation's name, without characters file systems refuse.
export function gifFileName(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
  return `${clean || "animation"}.gif`;
}
