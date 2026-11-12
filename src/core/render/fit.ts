export type Rect = { x: number; y: number; width: number; height: number };

// The centred part of a source that fills a target of another shape without stretching,
// like CSS `object-fit: cover`. A 4:3 webcam into a 16:9 frame loses a strip at the top and
// bottom; a portrait phone camera loses the sides. Used by capture (step 05) and the renderer.
export function coverCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): Rect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) return { x: 0, y: 0, width: 0, height: 0 };

  const targetRatio = targetWidth / targetHeight;
  if (sourceWidth / sourceHeight > targetRatio) {
    const width = sourceHeight * targetRatio;   // source is wider: cut the sides
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / targetRatio;      // source is taller: cut top and bottom
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}
