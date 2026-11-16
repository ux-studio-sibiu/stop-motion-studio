import { describe, expect, it } from "vitest";
import { clampView, FIT_VIEW, panView, zoomView } from "./stageView";

describe("stage view", () => {
  it("zooms around the middle by default, and back to fit", () => {
    const close = zoomView(FIT_VIEW, 2);
    expect(close).toEqual({ zoom: 2, x: 0.25, y: 0.25 });   // the middle half is visible
    expect(zoomView(close, 1)).toEqual(FIT_VIEW);
  });

  it("keeps the point under the pointer where it is", () => {
    const close = zoomView(FIT_VIEW, 4, { x: 0, y: 1 });   // the bottom-left corner stays put
    expect(close).toEqual({ zoom: 4, x: 0, y: 0.75 });
  });

  it("never pans past the stage's edges", () => {
    const close = zoomView(FIT_VIEW, 2);
    expect(panView(close, 1, -1)).toEqual({ zoom: 2, x: 0.5, y: 0 });
    expect(panView(FIT_VIEW, 0.3, 0.3)).toEqual(FIT_VIEW);   // at fit there's nothing to pan
  });

  it("keeps zoom between fit and 8×, and mends bad values", () => {
    expect(clampView({ zoom: 20 }).zoom).toBe(8);
    expect(clampView({ zoom: 0.2, x: 0.4 })).toEqual(FIT_VIEW);
    expect(clampView({ zoom: Number.NaN, x: Number.NaN })).toEqual(FIT_VIEW);
    expect(clampView({ zoom: 2 })).toEqual({ zoom: 2, x: 0.25, y: 0.25 });   // centred when no position
  });
});
