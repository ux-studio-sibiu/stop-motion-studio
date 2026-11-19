import type { Capture } from "@/adapters/camera/capture";
import { photoSize } from "@/core/photos";
import { thumbnailOf } from "./thumbnail";

const IMAGE_QUALITY = 0.9;   // as capture's

// Opens a photo from the computer and makes it a picture for the animation (step 28): turned the
// way the camera held it (EXIF orientation), its own shape shrunk to fit inside the animation's
// size (photoSize), saved as a JPEG, with a thumbnail. The same result as a capture, so the rest
// doesn't care where a picture came from. Throws if the browser can't open the file (HEIC, mostly).
export async function preparePhoto(file: Blob, inside: { width: number; height: number }): Promise<Capture> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = photoSize(bitmap.width, bitmap.height, inside);
    if (width === 0) throw new Error("The photo is empty.");
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D isn't available.");
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff";   // a see-through PNG gets a white background, not a black one
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const [image, thumb] = await Promise.all([canvas.convertToBlob({ type: "image/jpeg", quality: IMAGE_QUALITY }), thumbnailOf(canvas)]);
    return { image, thumb, width, height };
  } finally {
    bitmap.close();
  }
}
