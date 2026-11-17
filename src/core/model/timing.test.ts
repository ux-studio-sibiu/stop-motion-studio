import { describe, expect, it } from "vitest";
import { formatSeconds, formatTicks, frameIndexAt, frameStarts, pxPerTick, resizeHolds, rulerScale, secondsToTicks, ticksFromPx, ticksToSeconds, totalTicks } from "@/core/model";

describe("ticksFromPx", () => {
  it("snaps a drag to the nearest whole tick", () => {
    expect(ticksFromPx(29, 20)).toBe(1);
    expect(ticksFromPx(31, 20)).toBe(2);
    expect(ticksFromPx(-41, 20)).toBe(-2);
    expect(ticksFromPx(9, 20)).toBe(0);
    expect(Object.is(ticksFromPx(-9, 20), 0)).toBe(true);   // not -0
  });

  it("is 0 for nonsense", () => {
    expect(ticksFromPx(Number.NaN, 20)).toBe(0);
    expect(ticksFromPx(40, 0)).toBe(0);
  });
});

describe("resizeHolds", () => {
  const frames = [{ id: "a", hold: 1 }, { id: "b", hold: 3 }];

  it("changes every picture by the same amount", () => {
    expect(resizeHolds(frames, 2)).toEqual([{ id: "a", from: 1, to: 3 }, { id: "b", from: 3, to: 5 }]);
  });

  it("keeps every picture at least 1 tick, and leaves out those that don't change", () => {
    expect(resizeHolds(frames, -1)).toEqual([{ id: "b", from: 3, to: 2 }]);
    expect(resizeHolds(frames, -5)).toEqual([{ id: "b", from: 3, to: 1 }]);
    expect(resizeHolds(frames, 0)).toEqual([]);
  });
});

const holds = (...values: number[]) => values.map((hold) => ({ hold }));

describe("ticks, seconds and pixels", () => {
  it("converts both ways at the project's speed", () => {
    expect(ticksToSeconds(16, 8)).toBe(2);
    expect(secondsToTicks(1.5, 8)).toBe(12);
    expect(secondsToTicks(0.3, 8)).toBe(2);   // rounded to a whole tick
  });

  it("makes a tick 1/fps of a second wide", () => {
    expect(pxPerTick(160, 8)).toBe(20);
    expect(pxPerTick(160, 16)).toBe(10);
  });
});

describe("frame starts", () => {
  it("lays frames end to end", () => {
    expect(frameStarts(holds(1, 3, 2))).toEqual([0, 1, 4]);
    expect(totalTicks(holds(1, 3, 2))).toBe(6);
  });

  it("handles an empty animation", () => {
    expect(frameStarts([])).toEqual([]);
    expect(totalTicks([])).toBe(0);
  });
});

describe("frameIndexAt", () => {
  const frames = holds(1, 3, 2);   // ticks 0 | 1 2 3 | 4 5

  it.each([[0, 0], [1, 1], [3, 1], [4, 2], [5, 2]])("at tick %d shows frame %d", (tick, index) => {
    expect(frameIndexAt(frames, tick)).toBe(index);
  });

  it("shows the last frame past the end, and nothing for an empty animation", () => {
    expect(frameIndexAt(frames, 99)).toBe(2);
    expect(frameIndexAt([], 0)).toBe(-1);
  });
});

describe("rulerScale", () => {
  it("labels every second when seconds are wide, further apart when they're narrow", () => {
    expect(rulerScale(160).labelSeconds).toBe(1);
    expect(rulerScale(40).labelSeconds).toBe(2);
    expect(rulerScale(10).labelSeconds).toBe(10);
  });

  it("never puts labels closer than the gap", () => {
    for (const pxPerSecond of [5, 13, 40, 77, 160, 640]) {
      const { labelSeconds } = rulerScale(pxPerSecond);
      expect(labelSeconds * pxPerSecond).toBeGreaterThanOrEqual(64);
    }
  });

  it("adds finer marks when zoomed in", () => {
    expect(rulerScale(160).markSeconds).toBe(1);
    expect(rulerScale(240).markSeconds).toBe(0.5);
    expect(rulerScale(640).markSeconds).toBe(0.25);
  });
});

describe("formatTicks", () => {
  it("reads as seconds, exact to a hundredth, without trailing zeros", () => {
    expect(formatTicks(12, 8)).toBe("1.5 s");
    expect(formatTicks(1, 8)).toBe("0.13 s");
    expect(formatTicks(16, 8)).toBe("2 s");
    expect(formatTicks(0, 8)).toBe("0 s");
  });
});

describe("formatSeconds", () => {
  it.each([[0, "0s"], [4, "4s"], [59.4, "59s"], [60, "1:00"], [725, "12:05"]])("shows %d seconds as %s", (seconds, text) => {
    expect(formatSeconds(seconds)).toBe(text);
  });
});
