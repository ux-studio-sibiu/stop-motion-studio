import { describe, expect, it } from "vitest";
import { createBubble, createShape, createText, hasText, objectLabel, objectText, withProps, NO_FILL, SHAPE, SHAPE_DEFAULTS, shapeProps, TEXT, TEXT_DEFAULTS, textProps } from ".";

// Text and shapes (step 24); speech bubbles are in element.test.ts.

describe("text", () => {
  it("starts as empty, large white text across the middle, with no background", () => {
    const text = createText();
    expect(text.kind).toBe(TEXT);
    expect(textProps(text)).toEqual(TEXT_DEFAULTS);
    expect(textProps(text).fill).toBe(NO_FILL);
    expect(textProps(createText("Hi")).text).toBe("Hi");
  });

  it("keeps its settings, and replaces values that make no sense", () => {
    const set = { text: "THE END", textSize: "huge", font: "comic", textColour: "#d62828", fill: "#1f2433" };
    expect(textProps({ props: set })).toEqual(set);
    expect(textProps({ props: { text: 4, textSize: "giant", font: "?", textColour: "red", fill: "blue" } })).toEqual(TEXT_DEFAULTS);
  });
});

describe("shapes", () => {
  it("are one kind; the form is a setting, the arrow gets a long, flat box", () => {
    const rectangle = createShape();
    expect(rectangle.kind).toBe(SHAPE);
    expect(shapeProps(rectangle)).toEqual(SHAPE_DEFAULTS);
    const arrow = createShape("arrow");
    expect(shapeProps(arrow).form).toBe("arrow");
    expect(arrow.box.width).toBeGreaterThan(arrow.box.height);
    expect(shapeProps(createShape("ellipse")).form).toBe("ellipse");
  });

  it("keep their settings, and replace values that make no sense", () => {
    const set = { form: "ellipse", fill: NO_FILL, outline: "thick", outlineColour: "#1d4ed8" };
    expect(shapeProps({ props: set })).toEqual(set);
    expect(shapeProps({ props: { form: "star", fill: 3, outline: "huge", outlineColour: "#12" } })).toEqual(SHAPE_DEFAULTS);
  });
});

it("bubbles and text have text to type; shapes don't", () => {
  expect([createBubble(), createText(), createShape()].map(hasText)).toEqual([true, true, false]);
});

it("objects are named by what they are", () => {
  expect(objectLabel(createBubble())).toBe("speech bubble");
  expect(objectLabel(createBubble("spiked"))).toBe("spiked bubble");
  expect(objectLabel(createText())).toBe("text");
  expect(objectLabel(withProps(createShape(), { form: "arrow" }))).toBe("arrow");
  expect(objectLabel({ kind: "sticker", props: {} })).toBe("object");
});

it("an object's text is what's typed in it, and nothing for shapes", () => {
  expect(objectText(createBubble("speech", "  Hi! "))).toBe("Hi!");
  expect(objectText(createText("THE END"))).toBe("THE END");
  expect(objectText(createShape())).toBe("");
});
