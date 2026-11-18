import { describe, expect, it } from "vitest";
import { exportGif } from "@/adapters/export/gifExport";
import { gifFrames } from "@/core/export";
import { createFrame } from "@/core/model";
import { exportRect, type DrawableImage } from "@/core/render";

// The whole GIF pipeline in Chromium: the page draws, the real worker encodes.

function solid(colour: string): DrawableImage {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 90;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, 160, 90);
  return canvas;
}

function setup(count: number) {
  const frames = Array.from({ length: count }, (_, i) => ({ ...createFrame("p", `image-${i}`), hold: 2 }));
  const scene = { width: 160, height: 90, frames };
  const rect = exportRect(scene, 10);
  const images = new Map(frames.map((frame, i) => [frame.imageId, solid(i % 2 ? "#1d4ed8" : "#d62828")]));
  return { scene, rect, size: { width: 70, height: 36 }, frames: gifFrames(frames, [], 8), loadImage: async (id: string) => images.get(id) };
}

describe("exportGif", () => {
  it("makes a GIF of every picture, reporting progress up to done", async () => {
    const progress: number[] = [];
    const blob = await exportGif({ ...setup(4), onProgress: (fraction) => progress.push(fraction) });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(blob.type).toBe("image/gif");
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe("GIF89a");
    expect([bytes[6] | (bytes[7] << 8), bytes[8] | (bytes[9] << 8)]).toEqual([70, 36]);
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));   // only ever forward
  });

  it("stops when asked: it rejects, and nothing more is drawn", async () => {
    const stop = new AbortController();
    let loaded = 0;
    const options = setup(20);
    const making = exportGif({ ...options, loadImage: async (id) => { if (++loaded === 3) stop.abort(); return options.loadImage(id); }, signal: stop.signal });
    await expect(making).rejects.toMatchObject({ name: "AbortError" });
    expect(loaded).toBeLessThan(6);
  });
});
