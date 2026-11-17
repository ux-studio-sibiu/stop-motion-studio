import { describe, expect, it } from "vitest";
import { addStroke, DRAWING, drawingProps, eraseStrokes, objectLabel, pencilWidth, simplifyStroke, strokePoints, type NewStroke, type Point } from ".";

// Free drawing (step 24b).

const size = { width: 1000, height: 500 };
const line = (from: Point, to: Point, steps = 50): Point[] => Array.from({ length: steps + 1 }, (_, i) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }));
const stroke = (points: Point[], width: NewStroke["width"] = "medium"): NewStroke => ({ points, colour: "#d62828", width });
const near = (points: Point[]) => points.map(({ x, y }) => [Math.round(x), Math.round(y)]);

describe("smoothing a stroke", () => {
  it("drops the points a straight line doesn't need, keeping its ends", () => {
    const simple = simplifyStroke(line({ x: 10, y: 10 }, { x: 410, y: 210 }, 200), 1);
    expect(near(simple)).toEqual([[10, 10], [410, 210]]);
  });

  it("takes out a shaky hand's jitter, and keeps the corners that are really there", () => {
    const shaky = line({ x: 0, y: 100 }, { x: 400, y: 100 }, 200).map((point, i) => ({ x: point.x, y: point.y + (i % 2 ? 1.5 : -1.5) }));
    const corner = [...shaky, ...line({ x: 400, y: 100 }, { x: 400, y: 400 }, 100).slice(1)];
    const simple = simplifyStroke(corner, 2);
    expect(simple.length).toBeLessThan(8);
    expect(simple.some((point) => Math.abs(point.x - 400) < 6 && Math.abs(point.y - 100) < 6)).toBe(true);   // the corner
    expect(near([simple[0], simple[simple.length - 1]])).toEqual([[0, 99], [400, 400]]);
  });

  it("keeps a dot a dot", () => {
    expect(simplifyStroke([{ x: 5, y: 5 }], 1)).toEqual([{ x: 5, y: 5 }]);
  });
});

describe("a drawing", () => {
  it("starts with its first stroke, its box fitted around the line, thickness included", () => {
    const drawing = addStroke(undefined, stroke(line({ x: 100, y: 100 }, { x: 300, y: 200 })), size);
    expect(drawing.kind).toBe(DRAWING);
    expect(objectLabel(drawing)).toBe("drawing");
    const pad = pencilWidth("medium", size.height) / 2;   // 3 px
    expect(drawing.box).toEqual({ x: (100 - pad) / 1000, y: (100 - pad) / 500, width: (200 + 2 * pad) / 1000, height: (100 + 2 * pad) / 500, rotation: 0 });
    expect(near(strokePoints(drawing, drawingProps(drawing).strokes[0], size))).toEqual([[100, 100], ...near(line({ x: 100, y: 100 }, { x: 300, y: 200 })).slice(1)]);
  });

  it("grows its box for each stroke, and every stroke stays where it was drawn", () => {
    const first = addStroke(undefined, stroke([{ x: 100, y: 100 }, { x: 200, y: 100 }]), size);
    const both = addStroke(first, stroke([{ x: 600, y: 400 }, { x: 700, y: 450 }], "thick"), size);
    expect(both.id).toBe(first.id);
    const [a, b] = drawingProps(both).strokes;
    expect(near(strokePoints(both, a, size))).toEqual([[100, 100], [200, 100]]);
    expect(near(strokePoints(both, b, size))).toEqual([[600, 400], [700, 450]]);
    expect(b).toMatchObject({ colour: "#d62828", width: "thick" });
  });

  it("once turned, keeps its box and adds strokes in its turned terms", () => {
    const drawing = { ...addStroke(undefined, stroke([{ x: 100, y: 100 }, { x: 300, y: 300 }]), size), box: { x: 0.1, y: 0.2, width: 0.2, height: 0.4, rotation: 30 } };
    const more = addStroke(drawing, stroke([{ x: 500, y: 250 }, { x: 520, y: 260 }]), size);
    expect(more.box).toEqual(drawing.box);
    expect(near(strokePoints(more, drawingProps(more).strokes[1], size))).toEqual([[500, 250], [520, 260]]);
  });

  it("the eraser takes away the strokes it touches, and the drawing goes with the last one", () => {
    const one = addStroke(undefined, stroke([{ x: 100, y: 100 }, { x: 300, y: 100 }]), size);
    const two = addStroke(one, stroke([{ x: 100, y: 400 }, { x: 300, y: 400 }]), size);
    expect(eraseStrokes(two, [{ x: 600, y: 250 }], 10, size)).toBe(two);   // nothing touched: unchanged
    const left = eraseStrokes(two, [{ x: 200, y: 105 }], 3, size)!;        // 5 px off the line: within reach (3 px eraser + 3 px half the line)
    expect(eraseStrokes(two, [{ x: 200, y: 107 }], 3, size)).toBe(two);   // 7 px off: just out of reach
    expect(drawingProps(left).strokes).toHaveLength(1);
    expect(near(strokePoints(left, drawingProps(left).strokes[0], size))).toEqual([[100, 400], [300, 400]]);
    expect(left.box.y).toBeGreaterThan(0.7);   // fitted to what's left
    expect(eraseStrokes(left, [{ x: 150, y: 400 }], 3, size)).toBeNull();
  });

  it("reads its strokes defensively", () => {
    expect(drawingProps({ props: {} })).toEqual({ strokes: [] });
    expect(drawingProps({ props: { strokes: [{ points: [0.1, 0.2, 0.3, 0.4], colour: "red", width: "giant" }, { points: [1] }, null] } })).toEqual({ strokes: [{ points: [0.1, 0.2, 0.3, 0.4], colour: "#1f2433", width: "medium" }] });
  });
});
