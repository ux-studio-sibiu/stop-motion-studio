import { describe, expect, it } from "vitest";
import { clampFraming, coverCrop, framedCrop, framingTransform, NO_FRAMING, nudgeFraming } from "@/core/render/fit";

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

describe("camera framing", () => {
  const crop = { x: 0, y: 60, width: 640, height: 360 };   // a 4:3 camera's cover crop into 16:9

  it("keeps the whole crop at no zoom, wherever it's moved", () => {
    expect(framedCrop(crop, NO_FRAMING)).toEqual(crop);
    expect(framedCrop(crop, { zoom: 1, x: 1, y: -1 })).toEqual(crop);
  });

  it("zooms into the middle: half the crop at 2x", () => {
    expect(framedCrop(crop, { zoom: 2, x: 0, y: 0 })).toEqual({ x: 160, y: 150, width: 320, height: 180 });
  });

  it("moves as far as the zoom allows, never out of the picture", () => {
    expect(framedCrop(crop, { zoom: 2, x: -1, y: -1 })).toEqual({ x: 0, y: 60, width: 320, height: 180 });
    expect(framedCrop(crop, { zoom: 2, x: 1, y: 1 })).toEqual({ x: 320, y: 240, width: 320, height: 180 });
    expect(framedCrop(crop, { zoom: 2, x: 5, y: -5 })).toEqual({ x: 320, y: 60, width: 320, height: 180 });
  });

  it("keeps values in range: zoom 1 to 3, no movement at no zoom", () => {
    expect(clampFraming({ zoom: 9, x: 0.5, y: 0 })).toEqual({ zoom: 3, x: 0.5, y: 0 });
    expect(clampFraming({ zoom: 0.5, x: 0.5, y: 0.5 })).toEqual(NO_FRAMING);
    expect(clampFraming({ zoom: Number.NaN, x: 0, y: 0 })).toEqual(NO_FRAMING);
  });

  it("nudges a tenth of the way, up to the edge", () => {
    expect(nudgeFraming({ zoom: 2, x: 0, y: 0 }, 1, -1)).toEqual({ zoom: 2, x: 0.1, y: -0.1 });
    expect(nudgeFraming({ zoom: 2, x: 0.95, y: 0 }, 1, 0)).toEqual({ zoom: 2, x: 1, y: 0 });
    expect(nudgeFraming(NO_FRAMING, 1, 0)).toEqual(NO_FRAMING);   // nothing to move at no zoom
  });

  it("shows on the stage what a capture keeps: the scaled, moved picture's middle is the crop's middle", () => {
    const framing = { zoom: 2, x: 0.5, y: -1 };
    const { scale, moveX, moveY } = framingTransform(framing);
    // A point of the picture at fraction f across ends up at 0.5 + (f - 0.5 + move) * scale on the
    // stage; the stage's middle (0.5) shows the picture's fraction 0.5 - move.
    const kept = framedCrop({ x: 0, y: 0, width: 1, height: 1 }, framing);
    expect(scale).toBe(2);
    expect(0.5 - moveX / 100).toBeCloseTo(kept.x + kept.width / 2);
    expect(0.5 - moveY / 100).toBeCloseTo(kept.y + kept.height / 2);
    expect(framingTransform(NO_FRAMING)).toEqual({ scale: 1, moveX: 0, moveY: 0 });
  });
});
