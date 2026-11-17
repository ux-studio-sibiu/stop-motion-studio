import { clampHold } from "./project";
import type { Frame } from "./types";

// Time on the timeline (PLAN.md §3). Everything is counted in ticks of 1/fps: a picture lasts
// `hold` ticks, and later the overlays start and end on ticks too. Seconds and pixels are
// only ever worked out from ticks, for showing.

export function ticksToSeconds(ticks: number, fps: number): number {
  return ticks / fps;
}

export function secondsToTicks(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

// How wide one tick is on screen, at a zoom given in pixels per second.
export function pxPerTick(pxPerSecond: number, fps: number): number {
  return pxPerSecond / fps;
}

// The tick each frame starts on, in animation order: [0, hold0, hold0 + hold1, ...].
export function frameStarts(frames: readonly Pick<Frame, "hold">[]): number[] {
  const starts: number[] = [];
  let tick = 0;
  for (const frame of frames) {
    starts.push(tick);
    tick += frame.hold;
  }
  return starts;
}

export function totalTicks(frames: readonly Pick<Frame, "hold">[]): number {
  return frames.reduce((total, frame) => total + frame.hold, 0);
}

// Which frame is on screen at `tick` (the playhead): the last one starting at or before it.
// -1 for an empty animation; the last frame for ticks past the end.
export function frameIndexAt(frames: readonly Pick<Frame, "hold">[], tick: number): number {
  if (frames.length === 0) return -1;
  const starts = frameStarts(frames);
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (starts[mid] <= tick) low = mid;
    else high = mid - 1;
  }
  return low;
}

// The seconds ruler: a faint mark every `markSeconds`, a label every `labelSeconds`.
// Labels are spread so they never come closer than `minLabelGap` pixels; marks get finer
// (half, quarter seconds) when zoomed in far enough for them to be told apart.
export type RulerScale = { markSeconds: number; labelSeconds: number };

const LABEL_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300];

export function rulerScale(pxPerSecond: number, minLabelGap = 64): RulerScale {
  const labelSeconds = LABEL_STEPS.find((step) => step * pxPerSecond >= minLabelGap) ?? LABEL_STEPS[LABEL_STEPS.length - 1];
  const markSeconds = pxPerSecond >= 400 ? 0.25 : pxPerSecond >= 200 ? 0.5 : 1;
  return { markSeconds, labelSeconds };
}

// "0s", "4s", "59s", "1:00", "12:05".
export function formatSeconds(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  if (whole < 60) return `${whole}s`;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

// A length or a moment for people to read, exact to a hundredth: "1.5 s", "0.13 s", "2 s". For a
// picture's length, and when an object in time starts and ends.
export function formatTicks(ticks: number, fps: number): string {
  return `${Number(ticksToSeconds(ticks, fps).toFixed(2))} s`;
}

// A drag of `px` pixels on the timeline, in whole ticks (snapped to the nearest).
export function ticksFromPx(px: number, tickWidth: number): number {
  if (!Number.isFinite(px) || !(tickWidth > 0)) return 0;
  const ticks = Math.round(px / tickWidth);
  return ticks === 0 ? 0 : ticks;   // never -0
}

// Every picture made `delta` ticks longer (or shorter), each at least 1 tick long. Several
// pictures change by the same amount, so a shortened 1-tick picture stays at 1 while a 3-tick
// one goes to 2. Only pictures whose length really changes are returned.
export function resizeHolds(frames: readonly Pick<Frame, "id" | "hold">[], delta: number): { id: string; from: number; to: number }[] {
  return frames
    .map(({ id, hold }) => ({ id, from: hold, to: clampHold(hold + delta) }))
    .filter(({ from, to }) => from !== to);
}
