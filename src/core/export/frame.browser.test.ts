import { describe, expect, it } from "vitest";
import { createFrame } from "@/core/model";
import { drawExportFrame } from "@/core/export/frame";
import { exportRect, type DrawableImage } from "@/core/render";

// The exported picture, on a real canvas: only the part inside the safe zone, scaled to the file.
// (The safe zone keeps the picture's shape, so its sides are further in than 20 px: see exportRect.)
// The source has a 20 px red band all round and is green inside, so a corner pixel that isn't
// green means the band got in.

const W = 160;
const H = 90;

function banded(): DrawableImage {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgb(255,0,0)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgb(0,255,0)";
  ctx.fillRect(20, 20, W - 40, H - 40);
  return canvas;
}

function context(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext("2d", { willReadFrequently: true })!;
}

const pixel = (ctx: CanvasRenderingContext2D, x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];

describe("drawExportFrame", () => {
  it("keeps only what's inside the safe zone, scaled to the file: its corners come from 20 px in", () => {
    const image = banded();
    const scene = { width: W, height: H, frames: [createFrame("p", "photo")] };
    const rect = exportRect(scene, 20);   // 88 × 50 from (36, 20): the picture's shape, inside the band
    const out = context(60, 26);
    const result = drawExportFrame({ full: context(W, H), crop: context(rect.width, rect.height), out }, scene, () => image, 0, rect);
    expect(result.missing).toBe(false);
    for (const [x, y] of [[0, 0], [59, 0], [0, 25], [59, 25], [30, 13]]) expect(pixel(out, x, y)).toEqual([0, 255, 0]);
  });

  it("with no safe zone, the band is in the file", () => {
    const image = banded();
    const scene = { width: W, height: H, frames: [createFrame("p", "photo")] };
    const out = context(80, 46);
    const rect = exportRect(scene, 0);
    drawExportFrame({ full: context(W, H), crop: context(rect.width, rect.height), out }, scene, () => image, 0, rect);
    expect(pixel(out, 1, 1)).toEqual([255, 0, 0]);
  });
});
