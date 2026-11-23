import { describe, expect, it } from "vitest";
import { DEFAULT_TRANSFORM, angleTo, flip, moveBy, normaliseAngle, pictureCentre, resetTransform, rotateBy, sameTransform, scaleAround, type Transform } from "@/core/model";

const size = { width: 1280, height: 720 };
const t = (changes: Partial<Transform> = {}): Transform => ({ ...DEFAULT_TRANSFORM, ...changes });

describe("moveBy", () => {
  it("moves by project pixels, stored as fractions", () => {
    const moved = moveBy(t(), 128, -72, size);
    expect(moved).toMatchObject({ x: 0.1, y: -0.1 });
    expect(pictureCentre(moved, size)).toEqual({ x: 768, y: 288 });
  });

  it("ten one-pixel nudges are exactly ten pixels", () => {
    let moved = t();
    for (let i = 0; i < 10; i++) moved = moveBy(moved, 1, 0, size);
    expect(pictureCentre(moved, size).x).toBeCloseTo(650, 9);
  });
});

describe("scaleAround", () => {
  it("keeps whatever is under the point in place", () => {
    const point = { x: 960, y: 180 };
    const scaled = scaleAround(t(), 2, point, size);
    expect(scaled.scale).toBe(2);
    // The centre was 320 px left and 180 px below the point; now twice as far.
    expect(pictureCentre(scaled, size)).toEqual({ x: 960 - 640, y: 180 + 360 });
  });

  it("sizes around the centre when the point is the centre, without moving", () => {
    const scaled = scaleAround(t({ x: 0.1 }), 0.5, pictureCentre(t({ x: 0.1 }), size), size);
    expect(scaled).toMatchObject({ scale: 0.5 });
    expect(scaled.x).toBeCloseTo(0.1, 9);
    expect(scaled.y).toBeCloseTo(0, 9);
  });

  it("stays between 10% and 10x, moving only as much as it really scaled", () => {
    const point = { x: 0, y: 0 };
    const big = scaleAround(t({ scale: 8 }), 4, point, size);
    expect(big.scale).toBe(10);
    expect(pictureCentre(big, size).x).toBeCloseTo(640 * 1.25, 6);   // 8 → 10 is ×1.25, not ×4
    expect(scaleAround(t(), 0.001, point, size).scale).toBe(0.1);
  });
});

describe("rotateBy and normaliseAngle", () => {
  it("adds degrees, kept between -180 and 180", () => {
    expect(rotateBy(t({ rotation: 170 }), 20).rotation).toBe(-170);
    expect(rotateBy(t({ rotation: -170 }), -20).rotation).toBe(170);
    expect(normaliseAngle(540)).toBe(180);
    expect(normaliseAngle(-180)).toBe(180);
    expect(normaliseAngle(0)).toBe(0);
  });

  it("measures the angle from a centre to a point, clockwise from the right", () => {
    expect(angleTo({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
    expect(angleTo({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(90);   // screen y points down
  });
});

describe("flip, reset and sameTransform", () => {
  it("mirrors one way at a time, and back", () => {
    expect(flip(t(), "x")).toMatchObject({ flipX: true, flipY: false });
    expect(flip(flip(t(), "y"), "y").flipY).toBe(false);
  });

  it("resets to an unmoved picture, as a new object", () => {
    const reset = resetTransform();
    expect(reset).toEqual(DEFAULT_TRANSFORM);
    expect(reset).not.toBe(DEFAULT_TRANSFORM);
  });

  it("compares every field", () => {
    expect(sameTransform(t(), t())).toBe(true);
    expect(sameTransform(t(), t({ flipY: true }))).toBe(false);
  });

  it("counts a difference too small to see as the same (a snap that lands back where it was, give or take rounding)", () => {
    expect(sameTransform(t(), t({ x: 1e-13, y: -2e-14 }))).toBe(true);
    expect(sameTransform(t(), t({ scale: 1 + 1e-12, rotation: 1e-11 }))).toBe(true);
    expect(sameTransform(t(), t({ x: 0.001 }))).toBe(false);   // about a pixel: a move
  });
});
