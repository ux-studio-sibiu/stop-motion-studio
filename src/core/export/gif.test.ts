import { describe, expect, it } from "vitest";
import { gifFileName, gifFrames, gifSize } from "@/core/export/gif";
import { exportRect } from "@/core/render";

const holds = (...values: number[]) => values.map((hold) => ({ hold }));
const overlay = (id: string, start: number, length: number) => ({ id, start, length });

describe("gifFrames", () => {
  it("is one GIF frame per picture, as long as it's held", () => {
    expect(gifFrames(holds(1, 4, 2), [], 10)).toEqual([
      { tick: 0, ticks: 1, delay: 10 },
      { tick: 1, ticks: 4, delay: 40 },
      { tick: 5, ticks: 2, delay: 20 },
    ]);
  });

  it("cuts where an overlay starts or ends, and only there", () => {
    // pictures 0-4 and 4-8; a title from 2 to 6
    expect(gifFrames(holds(4, 4), [overlay("title", 2, 4)], 10).map(({ tick, ticks }) => [tick, ticks])).toEqual([[0, 2], [2, 2], [4, 2], [6, 2]]);
  });

  it("doesn't cut where nothing on screen changes; one overlay ending as another starts still does", () => {
    expect(gifFrames(holds(8), [overlay("a", 0, 8)], 10).map(({ ticks }) => ticks)).toEqual([8]);
    expect(gifFrames(holds(8), [overlay("a", 0, 4), overlay("b", 4, 4)], 10).map(({ ticks }) => ticks)).toEqual([4, 4]);
  });

  it("leaves out overlays past the end, and an animation with nothing is no GIF", () => {
    expect(gifFrames(holds(2), [overlay("late", 5, 3)], 10)).toEqual([{ tick: 0, ticks: 2, delay: 20 }]);
    expect(gifFrames([], [], 10)).toEqual([]);
  });

  it("rounds the delays so they add up to the real length, not drifting", () => {
    const frames = gifFrames(holds(1, 1, 1, 1, 1, 1, 1, 1), [], 15);   // 6.67 cs each
    expect(frames.map(({ delay }) => delay)).toEqual([7, 6, 7, 7, 6, 7, 7, 6]);
    expect(frames.reduce((sum, { delay }) => sum + delay, 0)).toBe(53);   // 8 / 15 s
  });
});

describe("gifSize", () => {
  it("scales the exported part to the size's width, keeping its shape, in even numbers: 16:9 stays 16:9", () => {
    const rect = exportRect({ width: 1280, height: 720 });   // 1208 × 680
    expect(gifSize(rect, "small")).toEqual({ width: 320, height: 180 });
    expect(gifSize(rect, "medium")).toEqual({ width: 640, height: 360 });
    expect(gifSize(rect, "full")).toEqual({ width: 1208, height: 680 });   // as it is
  });

  it("never scales up", () => {
    expect(gifSize({ width: 400, height: 300 }, "medium")).toEqual({ width: 400, height: 300 });
  });
});

describe("gifFileName", () => {
  it("is the animation's name, without characters a file can't have", () => {
    expect(gifFileName("Dino walk")).toBe("Dino walk.gif");
    expect(gifFileName("Cat: the return / part 2?")).toBe("Cat the return part 2.gif");
    expect(gifFileName("  ...  ")).toBe("animation.gif");
  });
});
