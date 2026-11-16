import { describe, expect, it } from "vitest";
import { exportRect, SAFE_MARGIN } from "@/core/render";

describe("exportRect", () => {
  it("leaves out the safe margin on every side", () => {
    expect(SAFE_MARGIN).toBe(20);
    expect(exportRect({ width: 1280, height: 720 })).toEqual({ x: 20, y: 20, width: 1240, height: 680 });
  });

  it("keeps the video's size even, taking an odd pixel off the right or bottom", () => {
    expect(exportRect({ width: 1281, height: 721 })).toEqual({ x: 20, y: 20, width: 1240, height: 680 });
  });

  it("never eats the whole picture on a tiny project, and allows no margin at all", () => {
    expect(exportRect({ width: 30, height: 20 })).toEqual({ x: 9, y: 9, width: 12, height: 2 });
    expect(exportRect({ width: 1280, height: 720 }, 0)).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
  });
});
