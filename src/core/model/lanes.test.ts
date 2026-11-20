import { describe, expect, it } from "vitest";
import { laneCount, timeLanes } from ".";

describe("time lanes", () => {
  it("puts overlapping bars in rows, reusing a row once it's free", () => {
    const lanes = timeLanes([{ id: "a", start: 0, end: 8 }, { id: "b", start: 4, end: 12 }, { id: "c", start: 8, end: 10 }, { id: "d", start: 5, end: 6 }]);
    expect(lanes).toEqual({ a: 0, b: 1, d: 2, c: 0 });   // c starts as a ends
  });

  it("lays them out the same whatever order they come in", () => {
    const spans = [{ id: "x", start: 2, end: 4 }, { id: "y", start: 2, end: 4 }, { id: "z", start: 0, end: 3 }];
    expect(timeLanes(spans)).toEqual(timeLanes([...spans].reverse()));
  });

  it("counts the rows needed, at least one", () => {
    expect(laneCount({})).toBe(1);
    expect(laneCount({ a: 0, b: 2 })).toBe(3);
  });
});
