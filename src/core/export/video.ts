import type { Frame, Overlay } from "../model";
import { exportSegments, type Segment } from "./segments";

// Video export (step 26), the plain maths: each export segment (only where the screen changes) is
// one video frame, starting at its time and lasting as long, in seconds: a picture held for a
// second is one frame a second long, not eight copies. Times are worked out from ticks each time,
// not added up, so they never drift.
export type VideoFrame = Segment & { timestamp: number; duration: number };

export function videoFrames(frames: readonly Pick<Frame, "hold">[], overlays: readonly Pick<Overlay, "id" | "start" | "length">[], fps: number): VideoFrame[] {
  return exportSegments(frames, overlays).map(({ tick, ticks }) => ({ tick, ticks, timestamp: tick / fps, duration: ticks / fps }));
}
