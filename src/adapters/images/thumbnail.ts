import { THUMB_WIDTH } from "@/adapters/camera/capture";

// Opens a stored photo (a JPEG) and makes its thumbnail, as capture does: THUMB_WIDTH wide, its
// own shape. For pictures that arrive without one (a restored backup, step 27). Throws if the file
// can't be opened as a picture.
export async function decodePicture(blob: Blob): Promise<{ width: number; height: number; thumb: Blob }> {
  const bitmap = await createImageBitmap(blob);
  try {
    const height = Math.max(1, Math.round((THUMB_WIDTH * bitmap.height) / bitmap.width));
    const canvas = new OffscreenCanvas(THUMB_WIDTH, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D isn't available.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, THUMB_WIDTH, height);
    return { width: bitmap.width, height: bitmap.height, thumb: await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 }) };
  } finally {
    bitmap.close();
  }
}
