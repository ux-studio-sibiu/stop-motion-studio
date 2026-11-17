import { describe, expect, it } from "vitest";
import { boxAt, BUBBLE_DEFAULTS, BUBBLE_FONTS, bubbleFont, boxCentre, boxCorners, boxPoint, pointInBox, bubbleProps, cloneElements, createBubble, MIN_BOX, moveBox, resizeBox, rotateBox, sameElements, SPEECH_BUBBLE, withProps } from ".";

const size = { width: 1000, height: 500 };
const box = { x: 0.2, y: 0.2, width: 0.4, height: 0.4, rotation: 0 };   // 400 × 200 px, top-left at (200, 100)
const near = (value: number) => Math.round(value * 1000) / 1000;
const rounded = (b: typeof box) => ({ x: near(b.x), y: near(b.y), width: near(b.width), height: near(b.height), rotation: b.rotation });

describe("bubbles", () => {
  it("start as an empty speech bubble near the top, tail below", () => {
    const bubble = createBubble();
    expect(bubble.kind).toBe(SPEECH_BUBBLE);
    expect(bubbleProps(bubble)).toEqual({ ...BUBBLE_DEFAULTS, text: "", variant: "speech", tail: { x: 0.25, y: 1.45 } });
    expect(createBubble("thought", "Hmm").props).toMatchObject({ variant: "thought", text: "Hmm" });
    expect(createBubble().id).not.toBe(createBubble().id);
  });

  it("read stored props defensively", () => {
    expect(bubbleProps({ props: { text: 3, variant: "shout", tail: { x: "a" } } })).toEqual({ ...BUBBLE_DEFAULTS, text: "", variant: "speech" });
    expect(bubbleProps(withProps(createBubble(), { text: "Hi" })).text).toBe("Hi");
  });

  it("start with the default settings, and bubbles saved before settings existed read with them", () => {
    expect(bubbleProps(createBubble())).toMatchObject(BUBBLE_DEFAULTS);
    const old = { kind: SPEECH_BUBBLE, props: { text: "Hi", variant: "thought", tail: { x: 0, y: 2 } } };
    expect(bubbleProps(old)).toEqual({ ...BUBBLE_DEFAULTS, text: "Hi", variant: "thought", tail: { x: 0, y: 2 } });
  });

  it("keep their shape, tail, size, font, colours and outline, and replace values that make no sense", () => {
    const set = { variant: "spiked", showTail: false, textSize: "huge", font: "comic", textColour: "#D62828", fill: "#fff3a3", outline: "thick", outlineColour: "#1d4ed8" };
    expect(bubbleProps({ props: set })).toMatchObject(set);
    const broken = bubbleProps({ props: { variant: "shout", showTail: "no", textSize: 40, font: "Wingdings", textColour: "red", fill: "#fff", outline: "huge", outlineColour: 3 } });
    expect(broken).toMatchObject({ variant: "speech", showTail: true, textSize: "medium", font: "rounded", textColour: BUBBLE_DEFAULTS.textColour, fill: BUBBLE_DEFAULTS.fill, outline: "medium", outlineColour: BUBBLE_DEFAULTS.outlineColour });
    expect(bubbleFont("nope")).toBe(BUBBLE_FONTS[0]);
  });
});

describe("moveBox", () => {
  it("moves by project pixels", () => {
    expect(rounded(moveBox(box, 100, -50, size))).toEqual({ ...box, x: 0.3, y: 0.1 });
  });

  it("keeps the centre on the frame", () => {
    const far = moveBox(box, 5000, 5000, size);
    expect(boxCentre(far, size)).toEqual({ x: 1000, y: 500 });
  });
});

describe("resizeBox", () => {
  it("grows from a corner while the opposite corner stays put", () => {
    expect(rounded(resizeBox(box, "se", 100, 50, size))).toEqual({ x: 0.2, y: 0.2, width: 0.5, height: 0.5, rotation: 0 });
    expect(rounded(resizeBox(box, "nw", -100, -50, size))).toEqual({ x: 0.1, y: 0.1, width: 0.5, height: 0.5, rotation: 0 });
  });

  it("never gets smaller than readable", () => {
    const tiny = resizeBox(box, "se", -5000, -5000, size);
    expect(near(tiny.width)).toBe(MIN_BOX);
    expect(near(tiny.height)).toBe(MIN_BOX);
    expect(rounded(tiny)).toMatchObject({ x: 0.2, y: 0.2 });   // still anchored at its top-left
  });

  it("measures the drag along a turned box's own sides", () => {
    // Turned 90° clockwise, the box's "right" points down: dragging the se corner down widens it.
    const turned = { ...box, rotation: 90 };
    const wider = resizeBox(turned, "se", 0, 100, size);
    expect(near(wider.width * size.width)).toBe(500);
    expect(near(wider.height * size.height)).toBe(200);
  });
});

describe("rotateBox, cloneElements and sameElements", () => {
  it("turns, kept between -180 and 180", () => {
    expect(rotateBox({ ...box, rotation: 170 }, 20).rotation).toBe(-170);
  });

  it("copies elements with nothing shared, and compares them by value", () => {
    const elements = [createBubble("speech", "Hi")];
    const copy = cloneElements(elements);
    expect(copy).toEqual(elements);
    expect(copy[0].box).not.toBe(elements[0].box);
    expect(copy[0].props).not.toBe(elements[0].props);
    expect(sameElements(copy, elements)).toBe(true);
    expect(sameElements([withProps(copy[0], { text: "Bye" })], elements)).toBe(false);
  });
});

describe("boxAt", () => {
  const box = { x: 0, y: 0, width: 0.4, height: 0.2, rotation: 15 };
  it("centres a box on a point of the frame, keeping its size and turn", () => {
    expect(boxAt(box, { x: 0.5, y: 0.5 })).toEqual({ ...box, x: 0.3, y: 0.4 });
  });
  it("keeps the centre on the frame, so a drop at the edge can't lose it", () => {
    expect(boxAt(box, { x: 1.4, y: -0.3 })).toEqual({ ...box, x: 0.8, y: -0.1 });
  });
});

describe("boxCorners, pointInBox and boxPoint", () => {
  it("give a box's corners on the frame, turned with it", () => {
    const at = (points: { x: number; y: number }[]) => points.map(({ x, y }) => [Math.round(x), Math.round(y)]);
    expect(at(boxCorners(box, size))).toEqual([[200, 100], [600, 100], [600, 300], [200, 300]]);
    expect(at(boxCorners({ ...box, rotation: 90 }, size))).toEqual([[500, 0], [500, 400], [300, 400], [300, 0]]);   // around the centre (400, 200)
  });

  it("put a point in the box's own terms, whichever way it's turned", () => {
    expect(pointInBox(box, { x: 400, y: 400 }, size)).toEqual({ x: 0.5, y: 1.5 });   // below the middle: the tail's usual place
    expect(pointInBox({ ...box, rotation: 90 }, { x: 200, y: 200 }, size)).toEqual({ x: 0.5, y: 1.5 });   // turned, "below" is to the left
  });

  it("boxPoint puts a point in the box's terms back on the frame, undoing pointInBox", () => {
    const at = ({ x, y }: { x: number; y: number }) => [Math.round(x), Math.round(y)];
    expect(at(boxPoint(box, { x: 0.5, y: 1.5 }, size))).toEqual([400, 400]);
    expect(at(boxPoint({ ...box, rotation: 90 }, { x: 0.5, y: 1.5 }, size))).toEqual([200, 200]);
    const turned = { ...box, rotation: -37 };
    expect(at(boxPoint(turned, pointInBox(turned, { x: 123, y: 456 }, size), size))).toEqual([123, 456]);
  });
});
