import { describe, expect, it } from "vitest";
import { createFrame, DEFAULT_ADJUST, DEFAULT_TRANSFORM, type Adjust, type Transform } from "@/core/model";
import { drawFrame, drawOnionSkin, renderAt, type DrawableImage } from "@/core/render";

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
