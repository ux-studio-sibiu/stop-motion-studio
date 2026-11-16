// The playback clock: which tick is on screen at a given moment. Pure maths on elapsed time,
// with `now` passed in (from requestAnimationFrame in the app, made up in tests):
//
//   tick = startTick + floor(elapsed ms × fps / 1000)
//
// Counting from the start time, never adding "one tick per frame", keeps playback at the right
// speed however unevenly the browser draws. A tab in the background stops drawing; when it
// comes back, the clock simply jumps to where the animation would be by then, instead of
// racing through everything it missed.

export type Clock = { startedAt: number; startTick: number; fps: number; totalTicks: number; loop: boolean };

export type ClockReading = { tick: number; ended: boolean };

export function startClock(now: number, startTick: number, fps: number, totalTicks: number, loop: boolean): Clock {
  const start = totalTicks > 0 ? Math.min(Math.max(0, Math.floor(startTick)), totalTicks - 1) : 0;
  return { startedAt: now, startTick: start, fps, totalTicks, loop };
}

// Where the animation is at `now`. Looping wraps around to the start; otherwise playback ends
// on the last tick.
export function readClock(clock: Clock, now: number): ClockReading {
  if (clock.totalTicks <= 0) return { tick: 0, ended: true };
  const elapsed = Math.max(0, now - clock.startedAt);
  const tick = clock.startTick + Math.floor((elapsed * clock.fps) / 1000);
  if (clock.loop) return { tick: tick % clock.totalTicks, ended: false };
  return tick >= clock.totalTicks ? { tick: clock.totalTicks - 1, ended: true } : { tick, ended: false };
}
