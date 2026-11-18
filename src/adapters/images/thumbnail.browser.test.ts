import { describe, expect, it } from "vitest";
import { THUMB_WIDTH } from "@/adapters/camera/capture";
import { decodePicture } from "@/adapters/images/thumbnail";

// Opening a restored photo in Chromium: its real size, and a thumbnail like capture makes.

async function jpeg(width: number, height: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#d62828";
  ctx.fillRect(0, 0, width, height);
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
}

describe("decodePicture", () => {
  it("gives the picture's size and a thumbnail of its shape", async () => {
    const { width, height, thumb } = await decodePicture(await jpeg(640, 360));
    expect([width, height]).toEqual([640, 360]);
    const small = await createImageBitmap(thumb);
    expect([small.width, small.height]).toEqual([THUMB_WIDTH, 90]);
    expect(thumb.type).toBe("image/jpeg");
  });

  it("refuses a file that isn't a picture", async () => {
    await expect(decodePicture(new Blob(["not a picture"], { type: "image/jpeg" }))).rejects.toThrow();
  });
});
