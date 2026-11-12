import { describe, expect, it } from "vitest";
import { coverCrop } from "@/core/render/fit";

describe("coverCrop", () => {
  it("keeps the whole source when the shapes match", () => {
    expect(coverCrop(1920, 1080, 1280, 720)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it("cuts top and bottom from a 4:3 camera into a 16:9 frame", () => {
    expect(coverCrop(640, 480, 1280, 720)).toEqual({ x: 0, y: 60, width: 640, height: 360 });
  });

  it("cuts the sides from a portrait camera", () => {
    const crop = coverCrop(720, 1280, 1280, 720);
    expect(crop.width).toBe(720);
    expect(crop.height).toBeCloseTo(405);
    expect(crop.y).toBeCloseTo((1280 - 405) / 2);
  });

  it("cuts the sides from an ultra-wide camera", () => {
    expect(coverCrop(2560, 1080, 1280, 720)).toEqual({ x: 320, y: 0, width: 1920, height: 1080 });
  });

  it("returns an empty rect for empty sizes (a video before its first frame)", () => {
    expect(coverCrop(0, 0, 1280, 720)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
