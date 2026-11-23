import { THUMB_WIDTH, type Capture } from "@/adapters/camera/capture";

// An empty picture: a fully see-through PNG at the animation's size, with a see-through thumbnail.
// The same result as a capture, so it's saved, copied and backed up like any picture; the frame
// is marked `empty`, so it's drawn without a background (a checkerboard on screen, see-through in
// a GIF).
export async function blankPicture(size: { width: number; height: number }): Promise<Capture> {
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const thumbHeight = Math.max(1, Math.round((THUMB_WIDTH * height) / width));
  const [image, thumb] = await Promise.all([seeThrough(width, height), seeThrough(THUMB_WIDTH, thumbHeight)]);
  return { image, thumb, width, height };
}

// A PNG with nothing drawn on it. (A canvas needs a context before it can be saved.)
function seeThrough(width: number, height: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  if (!canvas.getContext("2d")) throw new Error("Canvas 2D isn't available.");
  return canvas.convertToBlob({ type: "image/png" });
}
