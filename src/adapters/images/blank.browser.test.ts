import { describe, expect, it } from "vitest";
import { THUMB_WIDTH } from "@/adapters/camera/capture";
import { blankPicture } from "@/adapters/images/blank";

// The empty picture: a fully see-through PNG at the animation's size, and a see-through thumbnail.

async function opened(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque++;
  return { width: bitmap.width, height: bitmap.height, opaque };
}

describe("blankPicture", () => {
  it("is see-through all over, at the animation's size, with a see-through thumbnail", async () => {
    const picture = await blankPicture({ width: 1280, height: 720 });
    expect([picture.width, picture.height]).toEqual([1280, 720]);
    expect(picture.image.type).toBe("image/png");
    expect(await opened(picture.image)).toEqual({ width: 1280, height: 720, opaque: 0 });
    expect(await opened(picture.thumb)).toEqual({ width: THUMB_WIDTH, height: 90, opaque: 0 });
  });
});
