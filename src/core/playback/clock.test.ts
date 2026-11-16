import { describe, expect, it } from "vitest";
import { readClock, startClock } from "@/core/playback/clock";

// 8 ticks per second: one tick every 125 ms. Time is made up, so nothing waits.

describe("playback clock", () => {
  it("counts whole ticks from the start time", () => {
    const clock = startClock(1000, 0, 8, 20, false);
    expect(readClock(clock, 1000)).toEqual({ tick: 0, ended: false });
    expect(readClock(clock, 1124)).toEqual({ tick: 0, ended: false });
    expect(readClock(clock, 1125)).toEqual({ tick: 1, ended: false });
    expect(readClock(clock, 2000)).toEqual({ tick: 8, ended: false });   // one second
  });

  it("starts from any tick, kept inside the animation", () => {
    expect(readClock(startClock(0, 5, 8, 20, false), 250)).toEqual({ tick: 7, ended: false });
    expect(readClock(startClock(0, 99, 8, 20, false), 0).tick).toBe(19);
    expect(readClock(startClock(0, -3, 8, 20, false), 0).tick).toBe(0);
  });

  it("ends on the last tick, or wraps around when looping", () => {
    expect(readClock(startClock(0, 0, 8, 4, false), 500)).toEqual({ tick: 3, ended: true });
    expect(readClock(startClock(0, 0, 8, 4, true), 500)).toEqual({ tick: 0, ended: false });
    expect(readClock(startClock(0, 0, 8, 4, true), 750)).toEqual({ tick: 2, ended: false });
  });

  it("jumps ahead after a pause in drawing (a background tab) instead of catching up", () => {
    const clock = startClock(0, 0, 10, 1000, false);
    expect(readClock(clock, 100).tick).toBe(1);
    expect(readClock(clock, 30_000).tick).toBe(300);   // 30 s later: exactly where it should be
  });

  it("follows the speed", () => {
    expect(readClock(startClock(0, 0, 15, 100, false), 1000).tick).toBe(15);
    expect(readClock(startClock(0, 0, 5, 100, false), 1000).tick).toBe(5);
  });

  it("has nothing to play in an empty animation", () => {
    expect(readClock(startClock(0, 0, 8, 0, true), 500)).toEqual({ tick: 0, ended: true });
  });
});
