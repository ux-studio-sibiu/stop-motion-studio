import { describe, expect, it } from "vitest";
import { addStroke, createBubble, createFrame, createOverlay, createShape, createText, DEFAULT_ADJUST, DEFAULT_TRANSFORM, withProps, type Adjust, type Element, type Transform } from "@/core/model";
import { drawElements, drawFrame, drawOnionSkin, renderAt, renderPicture, type DrawableImage } from "@/core/render";

// Pixel tests: the renderer draws into a real canvas (Vitest browser mode, Chromium), and we
// read back the colour at chosen points. The source is a synthetic picture of four solid
// quadrants, so every expected colour is exact and nothing depends on photos or fonts.
//
//   red    | green
//   -------+-------
//   blue   | yellow

const W = 160;
const H = 90;
const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];
const YELLOW = [255, 255, 0];
const BLACK = [0, 0, 0];

function quadrants(width = W, height = H): DrawableImage {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const paint = (colour: number[], x: number, y: number) => { ctx.fillStyle = `rgb(${colour.join(",")})`; ctx.fillRect(x, y, width / 2, height / 2); };
  paint(RED, 0, 0);
  paint(GREEN, width / 2, 0);
  paint(BLUE, 0, height / 2);
  paint(YELLOW, width / 2, height / 2);
  return canvas;
}

function solid(colour: number[]): DrawableImage {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `rgb(${colour.join(",")})`;
  ctx.fillRect(0, 0, W, H);
  return canvas;
}

function target() {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  return canvas.getContext("2d", { willReadFrequently: true })!;
}

function draw(image: DrawableImage, transform: Partial<Transform> = {}, adjust: Partial<Adjust> = {}) {
  const ctx = target();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  drawFrame(ctx, { width: W, height: H }, { transform: { ...DEFAULT_TRANSFORM, ...transform }, adjust: { ...DEFAULT_ADJUST, ...adjust } }, image);
  return ctx;
}

// The colour at (x, y), allowing a little for smoothing (anti-aliasing) at edges.
function expectColour(ctx: CanvasRenderingContext2D, x: number, y: number, expected: number[], tolerance = 2) {
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
  const close = [r, g, b].every((value, i) => Math.abs(value - expected[i]) <= tolerance);
  expect(close, `pixel (${x}, ${y}) is rgb(${r}, ${g}, ${b}), expected rgb(${expected.join(", ")})`).toBe(true);
}

describe("renderer, on a real canvas", () => {
  it("draws an unmoved picture over the whole canvas", () => {
    const ctx = draw(quadrants());
    expectColour(ctx, 20, 20, RED);
    expectColour(ctx, 140, 20, GREEN);
    expectColour(ctx, 20, 70, BLUE);
    expectColour(ctx, 140, 70, YELLOW);
  });

  it("mirrors with flipX and flipY", () => {
    expectColour(draw(quadrants(), { flipX: true }), 20, 20, GREEN);
    expectColour(draw(quadrants(), { flipY: true }), 20, 20, BLUE);
  });

  it("turns around the centre", () => {
    const ctx = draw(quadrants(), { rotation: 180 });
    expectColour(ctx, 20, 20, YELLOW);
    expectColour(ctx, 140, 70, RED);
  });

  it("scales around the centre, showing the background around it", () => {
    const ctx = draw(quadrants(), { scale: 0.5 });   // the picture now spans 40..120 × 22.5..67.5
    expectColour(ctx, 20, 20, BLACK);
    expectColour(ctx, 60, 35, RED);
    expectColour(ctx, 100, 55, YELLOW);
  });

  it("moves by fractions of the canvas", () => {
    const ctx = draw(quadrants(), { x: 0.5 });   // half a canvas to the right
    expectColour(ctx, 20, 20, BLACK);
    expectColour(ctx, 100, 20, RED);
  });

  it("letterboxes a picture of another shape instead of stretching it", () => {
    const ctx = draw(quadrants(120, 90));   // 4:3 in a 16:9 canvas: bars 20 px wide
    expectColour(ctx, 10, 45, BLACK);
    expectColour(ctx, 150, 45, BLACK);
    expectColour(ctx, 30, 20, RED);
  });

  it("applies brightness without touching the picture", () => {
    const image = quadrants();
    const ctx = draw(image, {}, { brightness: 0.5 });
    expectColour(ctx, 20, 20, [128, 0, 0], 3);
    expectColour(draw(image), 20, 20, RED);   // the source is unchanged
  });

  it("draws the onion skin see-through, on a transparent canvas", () => {
    const ctx = target();
    drawOnionSkin(ctx, { width: W, height: H, frames: [createFrame("p", "red")] }, () => solid(RED), 1, { opacity: 0.4 });
    const [r, , , alpha] = ctx.getImageData(80, 45, 1, 1).data;
    expect(Math.abs(alpha - 102)).toBeLessThanOrEqual(2);   // 40% of 255: the camera shows through
    expect(r).toBeGreaterThan(250);
  });

  it("includes the picture's bubbles in the ghost, faint like the picture and drawn as one shape", () => {
    const ctx = target();
    const bubble = { ...createBubble(), box: { x: 0.25, y: 2 / 9, width: 0.5, height: 5 / 9, rotation: 0 } };
    drawOnionSkin(ctx, { width: W, height: H, frames: [{ ...createFrame("p", "red"), elements: [bubble] }] }, () => solid(RED), 1, { opacity: 0.4 });
    const [r, g, b, alpha] = ctx.getImageData(80, 45, 1, 1).data;
    expect([r, g, b]).toEqual([255, 255, 255]);              // the white bubble, over the red picture
    expect(Math.abs(alpha - 102)).toBeLessThanOrEqual(2);    // as faint as the picture, not fainter or stronger
    expect(ctx.getImageData(5, 5, 1, 1).data[0]).toBeGreaterThan(250);   // the picture around it still red
  });

  it("draws the outline look without colour: shapes in black and white", () => {
    const ctx = target();
    drawOnionSkin(ctx, { width: W, height: H, frames: [createFrame("p", "q")] }, () => quadrants(), 1, { opacity: 0.9, outline: true });
    for (const [x, y] of [[20, 20], [140, 20], [20, 70], [140, 70]]) {
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      expect(Math.max(r, g, b) - Math.min(r, g, b), `pixel (${x}, ${y}) is rgb(${r}, ${g}, ${b})`).toBeLessThanOrEqual(3);   // grey
    }
  });

  it("renderAt shows the picture on screen at that time, and black when none is decoded", () => {
    const frames = [createFrame("p", "red", { hold: 2 }), createFrame("p", "green")];
    const images = (id: string) => (id === "red" ? solid(RED) : id === "green" ? solid(GREEN) : undefined);
    const ctx = target();
    const scene = { width: W, height: H, frames };
    renderAt(ctx, scene, images, 1);
    expectColour(ctx, 80, 45, RED);
    renderAt(ctx, scene, images, 2);
    expectColour(ctx, 80, 45, GREEN);
    renderAt(ctx, scene, () => undefined, 2);
    expectColour(ctx, 80, 45, BLACK);
  });
});

describe("brightness and contrast (step 20)", () => {
  const grey = () => solid([100, 150, 200]);
  const adjusted = (canvasFilter: boolean, adjust: Partial<Adjust>) => {
    const ctx = target();
    drawFrame(ctx, { width: W, height: H }, { transform: DEFAULT_TRANSFORM, adjust: { ...DEFAULT_ADJUST, ...adjust } }, grey(), "none", { canvasFilter });
    return [...ctx.getImageData(80, 45, 1, 1).data.slice(0, 3)];
  };

  it("the pixel fallback looks the same as the canvas filter", () => {
    for (const adjust of [{ brightness: 1.4 }, { brightness: 0.6 }, { contrast: 1.5 }, { contrast: 0.5 }, { brightness: 1.3, contrast: 1.3 }]) {
      const filter = adjusted(true, adjust);
      const fallback = adjusted(false, adjust);
      fallback.forEach((value, i) => expect(Math.abs(value - filter[i]), `${JSON.stringify(adjust)}: ${fallback} vs ${filter}`).toBeLessThanOrEqual(2));
    }
  });

  it("brightens and darkens", () => {
    expect(adjusted(true, { brightness: 1.5 })).toEqual([150, 225, 255]);
    expect(adjusted(false, { brightness: 0.5 })).toEqual([50, 75, 100]);
  });
});

describe("spot the difference (step 19)", () => {
  it("draws only the nearest picture before, at full strength, with its own position", () => {
    const ctx = target();
    const frames = [createFrame("p", "a"), { ...createFrame("p", "b"), transform: { ...DEFAULT_TRANSFORM, scale: 0.5 } }, createFrame("p", "c")];
    drawOnionSkin(ctx, { width: W, height: H, frames }, () => solid(RED), 2, { count: 3, opacity: 0.4, outline: true, difference: true });
    const alpha = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3];
    expect(alpha(5, 5)).toBe(0);           // only the half-size picture just before; the older one is left out
    expectColour(ctx, 80, 45, RED);        // opaque, and not the outline look
    expect(alpha(80, 45)).toBe(255);
  });
});

describe("speech bubbles (step 23)", () => {
  // A bubble in the middle of the canvas: x 40-120, y 20-70.
  const bubble = (props: Record<string, unknown> = {}) => withProps({ ...createBubble(), box: { x: 0.25, y: 2 / 9, width: 0.5, height: 5 / 9, rotation: 0 } }, props);
  const WHITE = [255, 255, 255];
  // Pixels inside the bubble that aren't white: its text (tiny on this small canvas, so mostly
  // greys from smoothing rather than full ink).
  const dark = (ctx: CanvasRenderingContext2D) => {
    const { data } = ctx.getImageData(50, 30, 60, 30);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 1] < 200) count++;
    return count;
  };
  const onRed = () => { const ctx = target(); ctx.fillStyle = "rgb(255,0,0)"; ctx.fillRect(0, 0, W, H); return ctx; };

  it("draws a white bubble with its text, and leaves the rest of the picture alone", () => {
    const ctx = onRed();
    drawElements(ctx, { width: W, height: H }, [bubble({ text: "WOW" })]);
    expectColour(ctx, 45, 45, WHITE);   // inside, clear of the text
    expectColour(ctx, 5, 5, RED);       // outside, untouched
    expect(dark(ctx)).toBeGreaterThan(20);
  });

  it("fills the bubble with its colour and writes the text in its own colour", () => {
    const ctx = onRed();
    drawElements(ctx, { width: W, height: H }, [bubble({ text: "WOW", fill: "#000000", textColour: "#ffffff", textSize: "huge" })]);
    expectColour(ctx, 45, 45, [0, 0, 0]);   // the fill, clear of the text
    const { data } = ctx.getImageData(50, 30, 60, 30);
    let light = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 120 && data[i + 1] > 120) light++;
    expect(light).toBeGreaterThan(20);     // white text on the black bubble
  });

  it("can leave the tail off", () => {
    const below = (props: Record<string, unknown>) => { const ctx = onRed(); drawElements(ctx, { width: W, height: H }, [bubble({ tail: { x: 0.5, y: 1.3 }, ...props })]); return ctx; };
    expectColour(below({}), 80, 75, WHITE);                 // the tail, straight down from the middle
    expectColour(below({ showTail: false }), 80, 75, RED);
  });

  it("draws the outline in its colour and thickness, or none", () => {
    const edge = (props: Record<string, unknown>) => { const ctx = onRed(); drawElements(ctx, { width: W, height: H }, [bubble({ showTail: false, ...props })]); return ctx; };
    expectColour(edge({ outline: "thick", outlineColour: "#0000ff" }), 80, 72, [0, 0, 255]);   // just under the bottom edge
    expectColour(edge({ outline: "none" }), 80, 71, RED);
    expectColour(edge({ outline: "none" }), 80, 68, WHITE);
  });

  it("spiked bubbles are a burst: the box's corners and the gaps between spikes stay clear", () => {
    const ctx = onRed();
    drawElements(ctx, { width: W, height: H }, [bubble({ variant: "spiked" })]);
    expectColour(ctx, 80, 45, WHITE);
    expectColour(ctx, 43, 23, RED);     // the box's corner
    expectColour(ctx, 80, 22, WHITE);   // the top spike reaches the top of the box
  });

  it("thought bubbles are oval, with circles towards the tail", () => {
    const ctx = onRed();
    drawElements(ctx, { width: W, height: H }, [bubble({ variant: "thought" })]);
    expectColour(ctx, 80, 45, WHITE);
    expectColour(ctx, 43, 23, RED);     // the box's corner: inside a rounded box, outside the oval
  });

  it("renderAt draws a picture's bubbles on top of it", () => {
    const ctx = target();
    const frame = { ...createFrame("p", "red"), elements: [bubble()] };
    renderAt(ctx, { width: W, height: H, frames: [frame] }, () => solid(RED), 0);
    expectColour(ctx, 80, 45, WHITE);
    expectColour(ctx, 5, 5, RED);
  });
});

describe("text and shapes (step 24)", () => {
  // In the middle of the canvas: x 40-120, y 20-70, like the bubbles above.
  const place = (element: Element, props: Record<string, unknown> = {}) => withProps({ ...element, box: { x: 0.25, y: 2 / 9, width: 0.5, height: 5 / 9, rotation: 0 } }, props);
  const onRed = () => { const ctx = target(); ctx.fillStyle = "rgb(255,0,0)"; ctx.fillRect(0, 0, W, H); return ctx; };
  const draw = (element: Element) => { const ctx = onRed(); drawElements(ctx, { width: W, height: H }, [element]); return ctx; };
  const BLUE_FILL = [0, 0, 255];

  it("a rectangle fills its box", () => {
    const ctx = draw(place(createShape("rectangle"), { fill: "#0000ff", outline: "none" }));
    expectColour(ctx, 43, 23, BLUE_FILL);   // right into the corner
    expectColour(ctx, 80, 45, BLUE_FILL);
    expectColour(ctx, 36, 45, RED);         // outside
  });

  it("an ellipse leaves the box's corners clear", () => {
    const ctx = draw(place(createShape("ellipse"), { fill: "#0000ff", outline: "none" }));
    expectColour(ctx, 80, 45, BLUE_FILL);
    expectColour(ctx, 43, 23, RED);
  });

  it("an arrow points right: a shaft, and a head as tall as the box", () => {
    const ctx = draw(place(createShape("arrow"), { fill: "#0000ff", outline: "none" }));
    expectColour(ctx, 50, 45, BLUE_FILL);   // the shaft
    expectColour(ctx, 50, 25, RED);         // above the shaft
    expectColour(ctx, 92, 24, BLUE_FILL);   // the head reaches the top, just past the neck
    expectColour(ctx, 116, 45, BLUE_FILL);  // near the tip
    expectColour(ctx, 116, 25, RED);
  });

  it("with no fill, only the outline is drawn", () => {
    const ctx = draw(place(createShape("rectangle"), { fill: "none", outline: "thick", outlineColour: "#0000ff" }));
    expectColour(ctx, 80, 45, RED);         // see-through inside
    expectColour(ctx, 42, 45, BLUE_FILL);   // the outline, inside the box's edge
  });

  it("text is written in its colour, on its background when it has one", () => {
    const light = (ctx: CanvasRenderingContext2D) => {
      const { data } = ctx.getImageData(45, 25, 70, 40);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] > 150 && data[i + 1] > 150) count++;
      return count;
    };
    const plain = draw(place(createText("WOW"), { textColour: "#ffffff" }));
    expect(light(plain)).toBeGreaterThan(20);
    expectColour(plain, 43, 23, RED);       // no background
    const boxed = draw(place(createText("WOW"), { textColour: "#ffffff", fill: "#000000" }));
    expectColour(boxed, 45, 45, [0, 0, 0]); // the background, clear of the text
    expect(light(boxed)).toBeGreaterThan(20);
  });

  it("renderAt draws the overlays showing at that time on top, and not the others", () => {
    const frames = [{ ...createFrame("p", "red", { hold: 4 }), elements: [] }, { ...createFrame("p", "red", { hold: 4 }), elements: [] }];
    const overlays = [createOverlay(place(createShape("rectangle"), { fill: "#0000ff", outline: "none" }), 2, 4)];   // ticks 2-5
    const at = (tick: number) => { const ctx = target(); renderAt(ctx, { width: W, height: H, frames, overlays }, () => solid(RED), tick); return ctx; };
    expectColour(at(1), 80, 45, RED);
    expectColour(at(2), 80, 45, BLUE_FILL);
    expectColour(at(5), 80, 45, BLUE_FILL);   // over the second picture too
    expectColour(at(6), 80, 45, RED);
  });

  it("renderPicture shows a picture with every overlay showing at any moment of it", () => {
    const frames = [{ ...createFrame("p", "red", { hold: 4 }), elements: [] }, { ...createFrame("p", "red", { hold: 4 }), elements: [] }, { ...createFrame("p", "red", { hold: 4 }), elements: [] }];
    const overlays = [createOverlay(place(createShape("rectangle"), { fill: "#0000ff", outline: "none" }), 6, 1)];   // only tick 6: partway through picture 2
    const picture = (index: number) => { const ctx = target(); renderPicture(ctx, { width: W, height: H, frames, overlays }, () => solid(RED), index); return ctx; };
    expectColour(picture(1), 80, 45, BLUE_FILL);   // picture 2, ticks 4-7
    expectColour(picture(0), 80, 45, RED);
    expectColour(picture(2), 80, 45, RED);
  });
});

describe("free drawing (step 24b)", () => {
  const frame = { width: W, height: H };
  const onRed = () => { const ctx = target(); ctx.fillStyle = "rgb(255,0,0)"; ctx.fillRect(0, 0, W, H); return ctx; };
  const BLUE = [0, 0, 255];

  it("draws a drawing's strokes in their colour and thickness, smooth, with round ends", () => {
    const drawing = addStroke(undefined, { points: [{ x: 20, y: 45 }, { x: 80, y: 20 }, { x: 140, y: 45 }], colour: "#0000ff", width: "huge" }, frame);   // 4.5 px thick here
    const ctx = onRed();
    drawElements(ctx, frame, [drawing]);
    expectColour(ctx, 20, 45, BLUE);    // a round end, on its point
    expectColour(ctx, 140, 45, BLUE);
    expectColour(ctx, 72, 29, BLUE);    // the curve, bending towards the middle point
    expectColour(ctx, 80, 20, RED);     // without its sharp corner: smoothed
    expectColour(ctx, 80, 45, RED);     // not filled in
    expectColour(ctx, 5, 80, RED);
  });

  it("a single point is a dot", () => {
    const dot = addStroke(undefined, { points: [{ x: 80, y: 45 }], colour: "#0000ff", width: "huge" }, frame);
    const ctx = onRed();
    drawElements(ctx, frame, [dot]);
    expectColour(ctx, 80, 45, BLUE);
    expectColour(ctx, 80, 52, RED);
  });

  it("moves and sizes with its box", () => {
    const drawing = addStroke(undefined, { points: [{ x: 20, y: 20 }, { x: 60, y: 20 }], colour: "#0000ff", width: "huge" }, frame);
    const moved = { ...drawing, box: { ...drawing.box, x: drawing.box.x + 0.5, y: drawing.box.y + 0.5 } };   // 80 px right, 45 down
    const ctx = onRed();
    drawElements(ctx, frame, [moved]);
    expectColour(ctx, 120, 65, BLUE);
    expectColour(ctx, 40, 20, RED);
  });
});
