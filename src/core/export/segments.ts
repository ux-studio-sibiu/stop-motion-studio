import { activeOverlays, frameIndexAt, frameStarts, overlayEnd, totalTicks, type Frame, type Overlay } from "../model";

// What every export draws (GIF, step 25; video, step 26): the animation cut where what's on
// screen changes, and only there: a new picture, or an overlay starting or ending. A picture held
// for 4 ticks with nothing changing is one stretch, 4 ticks long, so it's drawn and stored once.
export type Segment = { tick: number; ticks: number };   // from `tick`, for `ticks` ticks

export function exportSegments(frames: readonly Pick<Frame, "hold">[], overlays: readonly Pick<Overlay, "id" | "start" | "length">[]): Segment[] {
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
  return kept.map((tick, index) => ({ tick, ticks: (kept[index + 1] ?? total) - tick }));
}

// The file's name: the animation's name, without characters file systems refuse.
export function exportFileName(name: string, extension: string): string {
  const clean = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
  return `${clean || "animation"}.${extension}`;
}
