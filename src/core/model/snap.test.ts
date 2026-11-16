import { describe, expect, it } from "vitest";
import { boundsOf, boxLines, snapBox } from "./snap";

const stage = { x: [0, 640, 1280], y: [0, 360, 720] };
const box = (left: number, top: number, width = 200, height = 100) => ({ left, top, right: left + width, bottom: top + height });

describe("snapBox", () => {
  it("snaps a nearby edge or centre to a line, on each axis", () => {
    expect(snapBox(box(4, 300), stage, 8)).toEqual({ dx: -4, dy: 0, x: 0, y: null });          // left edge to the stage edge
    expect(snapBox(box(535, 307), stage, 8)).toEqual({ dx: 5, dy: 3, x: 640, y: 360 });       // centre to the stage centre
    expect(snapBox(box(1075, 615), stage, 8)).toEqual({ dx: 5, dy: 5, x: 1280, y: 720 });     // right and bottom edges
  });

  it("leaves the box alone when nothing is within the threshold", () => {
    expect(snapBox(box(100, 100), stage, 8)).toEqual({ dx: 0, dy: 0, x: null, y: null });
  });

  it("takes the closest line when several are in reach", () => {
    expect(snapBox(box(0, 0, 10, 10), { x: [3, -1], y: [] }, 8).dx).toBe(-1);
  });

  it("snaps to another picture's edges and centre", () => {
    const ghost = box(300, 200);
    expect(snapBox(box(306, 198), boxLines(ghost), 8)).toEqual({ dx: -6, dy: 2, x: 300, y: 200 });
  });
});

describe("boundsOf", () => {
  it("is the smallest box around the points", () => {
    expect(boundsOf([{ x: 5, y: 0 }, { x: 10, y: 5 }, { x: 5, y: 10 }, { x: 0, y: 5 }])).toEqual({ left: 0, top: 0, right: 10, bottom: 10 });
  });
});
