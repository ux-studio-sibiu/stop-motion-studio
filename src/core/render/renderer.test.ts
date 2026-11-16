import { describe, expect, it } from "vitest";
import { createFrame, DEFAULT_TRANSFORM, type Transform } from "@/core/model";
import { adjustFilter, applyMatrix, containSize, drawOnionSkin, frameMatrix, onionOpacity, outlineFilter, renderAt, startTick, type DrawableImage } from "@/core/render";

// The renderer's maths, in Node. What it really looks like on a canvas is checked pixel by
// pixel in renderer.browser.test.ts.

const canvas = { width: 160, height: 90 };
const full = { width: 160, height: 90 };   // a picture the canvas's own shape fills it
const transform = (changes: Partial<Transform> = {}): Transform => ({ ...DEFAULT_TRANSFORM, ...changes });
const corners = (m: ReturnType<typeof frameMatrix>) => [applyMatrix(m, 0, 0), applyMatrix(m, full.width, full.height)].map(({ x, y }) => ({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }));

describe("containSize", () => {
  it("fits a picture whole, with bars on the sides or top and bottom", () => {
    expect(containSize(1280, 720, 160, 90)).toEqual({ width: 160, height: 90 });
    expect(containSize(400, 300, 160, 90)).toEqual({ width: 120, height: 90 });   // 4:3: bars left and right
    expect(containSize(90, 160, 160, 90)).toEqual({ width: 50.625, height: 90 });  // portrait
    expect(containSize(0, 10, 160, 90)).toEqual({ width: 0, height: 0 });
  });
});

describe("frameMatrix", () => {
  it("puts an unmoved picture exactly over the canvas", () => {
    expect(corners(frameMatrix(transform(), full, canvas))).toEqual([{ x: 0, y: 0 }, { x: 160, y: 90 }]);
  });

  it("moves by fractions of the canvas", () => {
    expect(corners(frameMatrix(transform({ x: 0.25, y: -0.1 }), full, canvas))).toEqual([{ x: 40, y: -9 }, { x: 200, y: 81 }]);
  });

  it("scales around the centre", () => {
    expect(corners(frameMatrix(transform({ scale: 0.5 }), full, canvas))).toEqual([{ x: 40, y: 22.5 }, { x: 120, y: 67.5 }]);
  });

  it("turns clockwise around the centre", () => {
    // A quarter turn clockwise: the top-left corner swings to the top-right.
    const m = frameMatrix(transform({ rotation: 90 }), full, canvas);
    const topLeft = applyMatrix(m, 0, 0);
    expect(topLeft.x).toBeCloseTo(125, 6);
    expect(topLeft.y).toBeCloseTo(-35, 6);
    expect(applyMatrix(m, 80, 45).x).toBeCloseTo(80, 6);   // the centre stays
  });

  it("mirrors with flips, keeping the picture in place", () => {
    expect(corners(frameMatrix(transform({ flipX: true }), full, canvas))).toEqual([{ x: 160, y: 0 }, { x: 0, y: 90 }]);
    expect(corners(frameMatrix(transform({ flipY: true }), full, canvas))).toEqual([{ x: 0, y: 90 }, { x: 160, y: 0 }]);
  });
});

describe("adjustFilter", () => {
  it("is none for an unchanged picture, a CSS filter otherwise", () => {
    expect(adjustFilter({ brightness: 1, contrast: 1 })).toBe("none");
    expect(adjustFilter({ brightness: 1.25, contrast: 1 })).toBe("brightness(1.25)");
    expect(adjustFilter({ brightness: 0.8, contrast: 1.5 })).toBe("brightness(0.8) contrast(1.5)");
  });
});

// A canvas context that only records what's drawn.
function recordingContext() {
  const drawn: string[] = [];
  const ctx = {
    save() {}, restore() {}, setTransform() {}, fillRect() { drawn.push("background"); },
    drawImage(image: { name: string }) { drawn.push(image.name); },
    fillStyle: "", filter: "none",
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, drawn };
}

describe("drawOnionSkin", () => {
  const frames = ["a", "b", "c"].map((id) => createFrame("p", `img-${id}`));
  const scene = { ...canvas, frames };

  // Records what was drawn and how strongly.
  function ghostContext() {
    const drawn: string[] = [];
    const ctx = {
      globalAlpha: 1, filter: "none",
      save() {}, restore() {}, setTransform() {}, clearRect() { drawn.push("clear"); },
      drawImage(image: { name: string }) { drawn.push(`${image.name}@${ctx.globalAlpha}`); },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, drawn };
  }
  const images = (id: string) => ({ name: id.slice(4).toUpperCase(), width: 160, height: 90 }) as unknown as DrawableImage;

  it("draws the picture before the next shot, faintly, on a cleared canvas", () => {
    const { ctx, drawn } = ghostContext();
    expect(drawOnionSkin(ctx, scene, images, 3)).toEqual([]);
    expect(drawn).toEqual(["clear", "C@0.4"]);
  });

  it("draws older pictures fainter, oldest first so the nearest is on top", () => {
    const { ctx, drawn } = ghostContext();
    drawOnionSkin(ctx, scene, images, 3, { count: 3, opacity: 0.6 });
    expect(drawn).toEqual(["clear", "A@0.15", "B@0.3", "C@0.6"]);
  });

  it("draws nothing before the first picture, and reports pictures not decoded yet", () => {
    const { ctx, drawn } = ghostContext();
    expect(drawOnionSkin(ctx, scene, images, 0)).toEqual([]);
    expect(drawn).toEqual(["clear"]);
    expect(drawOnionSkin(ghostContext().ctx, scene, () => undefined, 2, { count: 2 })).toEqual(["img-a", "img-b"]);
  });

  it("draws the outline look as blurred, black-and-white, high-contrast shapes", () => {
    const filters: string[] = [];
    const ctx = {
      globalAlpha: 1, filter: "none",
      save() {}, restore() {}, setTransform() {}, clearRect() {},
      drawImage() { filters.push(ctx.filter); },
    };
    drawOnionSkin(ctx as unknown as CanvasRenderingContext2D, scene, images, 3, { outline: true });
    expect(filters).toEqual(["blur(1px) grayscale(1) contrast(8)"]);   // a 160 px canvas: the 1 px minimum
    expect(outlineFilter(1280)).toBe("blur(4px) grayscale(1) contrast(8)");
  });

  it("keeps the strength between 0 and 1", () => {
    expect(onionOpacity(2, 1)).toBe(1);
    expect(onionOpacity(-1, 1)).toBe(0);
    expect(onionOpacity(0.4, 2)).toBe(0.2);
  });
});

describe("renderAt", () => {
  const a = createFrame("p", "img-a", { hold: 2 });
  const b = createFrame("p", "img-b", { hold: 1 });
  const scene = { ...canvas, frames: [a, b] };
  const picture = (name: string) => ({ name, width: 160, height: 90 }) as unknown as DrawableImage;
  const images = (id: string) => (id === "img-a" ? picture("A") : id === "img-b" ? picture("B") : undefined);

  it("draws the picture on screen at that time, over the background", () => {
    for (const [tick, name, index] of [[0, "A", 0], [1, "A", 0], [2, "B", 1]] as const) {
      const { ctx, drawn } = recordingContext();
      expect(renderAt(ctx, scene, images, tick)).toEqual({ frameIndex: index, missing: false });
      expect(drawn).toEqual(["background", name]);
    }
  });

  it("says when the picture isn't decoded yet, drawing only the background", () => {
    const { ctx, drawn } = recordingContext();
    expect(renderAt(ctx, scene, () => undefined, 0)).toEqual({ frameIndex: 0, missing: true });
    expect(drawn).toEqual(["background"]);
  });

  it("draws only the background for an empty animation", () => {
    const { ctx, drawn } = recordingContext();
    expect(renderAt(ctx, { ...canvas, frames: [] }, images, 0).missing).toBe(false);
    expect(drawn).toEqual(["background"]);
  });

  it("finds where a frame starts, to show a selected one", () => {
    expect(startTick(scene.frames, 0)).toBe(0);
    expect(startTick(scene.frames, 1)).toBe(2);
  });
});
