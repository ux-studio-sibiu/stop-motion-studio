import { describe, expect, it } from "vitest";
import { addStroke, copyOf, createBubble, createText, drawingProps, pasteInto, strokePoints, withProps } from ".";

// Copy and paste of objects between pictures.

const size = { width: 1000, height: 500 };

describe("copy and paste", () => {
  it("a copy shares nothing with the original", () => {
    const bubble = withProps(createBubble(), { text: "Hi" });
    const copy = copyOf(bubble);
    expect(copy).toEqual(bubble);
    expect(copy.props).not.toBe(bubble.props);
    expect(copy.box).not.toBe(bubble.box);
  });

  it("pastes as a new object in the same place, on top", () => {
    const bubble = withProps(createBubble(), { text: "Hi" });
    const there = [createText("Already here")];
    const { elements, pasted } = pasteInto(there, bubble, size);
    expect(elements).toHaveLength(2);
    expect(elements[1]).toBe(pasted);
    expect(pasted.id).not.toBe(bubble.id);
    expect({ ...pasted, id: "" }).toEqual({ ...bubble, id: "" });
    expect(pasteInto(elements, bubble, size).pasted.id).not.toBe(pasted.id);   // each paste its own object
  });

  it("a drawing pasted onto a picture with a drawing joins it, every line where it was", () => {
    const mine = addStroke(undefined, { points: [{ x: 100, y: 100 }, { x: 200, y: 100 }], colour: "#d62828", width: "medium" }, size);
    const copied = addStroke(undefined, { points: [{ x: 600, y: 400 }, { x: 700, y: 400 }], colour: "#1d4ed8", width: "thick" }, size);
    const { elements, pasted } = pasteInto([mine], copied, size);
    expect(elements).toHaveLength(1);
    expect(pasted.id).toBe(mine.id);
    const lines = drawingProps(pasted).strokes.map((stroke) => strokePoints(pasted, stroke, size).map(({ x, y }) => [Math.round(x), Math.round(y)]));
    expect(lines).toEqual([[[100, 100], [200, 100]], [[600, 400], [700, 400]]]);
  });

  it("a drawing pasted onto a picture without one is a drawing of its own", () => {
    const copied = addStroke(undefined, { points: [{ x: 600, y: 400 }, { x: 700, y: 400 }], colour: "#1d4ed8", width: "thick" }, size);
    const { elements, pasted } = pasteInto([createText()], copied, size);
    expect(elements).toHaveLength(2);
    expect(pasted.id).not.toBe(copied.id);
  });
});
