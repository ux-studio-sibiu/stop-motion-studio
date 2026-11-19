import { describe, expect, it } from "vitest";
import { THUMB_WIDTH } from "@/adapters/camera/capture";
import { preparePhoto } from "@/adapters/images/photo";

// Opening photos from the computer in Chromium: their size, shape, colours and thumbnail.

const inside = { width: 1280, height: 720 };

async function picture(width: number, height: number, type: string, paint: (ctx: OffscreenCanvasRenderingContext2D) => void): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  paint(ctx);
  return canvas.convertToBlob({ type, quality: 0.9 });
}

async function pixel(blob: Blob, x: number, y: number): Promise<number[]> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  return [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
}

const near = (actual: number[], expected: number[]) => actual.every((value, i) => Math.abs(value - expected[i]) <= 12);

describe("preparePhoto", () => {
  it("shrinks a big photo to fit inside the animation, keeping its shape, and makes a thumbnail", async () => {
    const photo = await preparePhoto(await picture(2000, 1500, "image/jpeg", (ctx) => { ctx.fillStyle = "#1d4ed8"; ctx.fillRect(0, 0, 2000, 1500); }), inside);
    expect([photo.width, photo.height]).toEqual([960, 720]);
    expect(photo.image.type).toBe("image/jpeg");
    const image = await createImageBitmap(photo.image);
    expect([image.width, image.height]).toEqual([960, 720]);
    const thumb = await createImageBitmap(photo.thumb);
    expect([thumb.width, thumb.height]).toEqual([THUMB_WIDTH, 120]);
    expect(near(await pixel(photo.image, 480, 360), [29, 78, 216])).toBe(true);
  });

  it("keeps a portrait photo upright and whole, and a small one at its size", async () => {
    // Top half red, bottom half green: still so after resizing (nothing turned or cut).
    const tall = await preparePhoto(await picture(600, 1200, "image/png", (ctx) => { ctx.fillStyle = "#f00"; ctx.fillRect(0, 0, 600, 600); ctx.fillStyle = "#0f0"; ctx.fillRect(0, 600, 600, 600); }), inside);
    expect([tall.width, tall.height]).toEqual([360, 720]);
    expect(near(await pixel(tall.image, 180, 100), [255, 0, 0])).toBe(true);
    expect(near(await pixel(tall.image, 180, 620), [0, 255, 0])).toBe(true);
    const small = await preparePhoto(await picture(320, 240, "image/png", () => {}), inside);
    expect([small.width, small.height]).toEqual([320, 240]);
  });

  it("gives a see-through picture a white background", async () => {
    const photo = await preparePhoto(await picture(100, 100, "image/png", () => {}), inside);
    expect(near(await pixel(photo.image, 50, 50), [255, 255, 255])).toBe(true);
  });

  it("refuses a file it can't open", async () => {
    await expect(preparePhoto(new Blob(["not a picture"], { type: "image/heic" }), inside)).rejects.toThrow();
  });
});
