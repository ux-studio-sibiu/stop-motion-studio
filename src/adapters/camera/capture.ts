import { coverCrop } from "@/core/render/fit";

export type Capture = { image: Blob; thumb: Blob; width: number; height: number };

export const THUMB_WIDTH = 160;
const IMAGE_QUALITY = 0.9;
const THUMB_QUALITY = 0.8;

// Takes one picture from the live video: cover-cropped to the project's shape and resized
// to its working resolution, so a 4:3 or 4K webcam both give a 1280x720 JPEG. The thumbnail
// is made from that picture, not from the video, so it shows exactly the same crop.
export async function captureFrame(video: HTMLVideoElement, size: { width: number; height: number }): Promise<Capture> {
  if (!video.videoWidth || !video.videoHeight) throw new Error("The camera picture isn't ready yet.");

  const picture = canvas(size.width, size.height);
  const crop = coverCrop(video.videoWidth, video.videoHeight, size.width, size.height);
  draw(picture, video, crop);

  const thumbHeight = Math.round((THUMB_WIDTH * size.height) / size.width);
  const thumb = canvas(THUMB_WIDTH, thumbHeight);
  draw(thumb, picture, { x: 0, y: 0, width: size.width, height: size.height });

  try {
    const [imageBlob, thumbBlob] = await Promise.all([toJpeg(picture, IMAGE_QUALITY), toJpeg(thumb, THUMB_QUALITY)]);
    return { image: imageBlob, thumb: thumbBlob, width: size.width, height: size.height };
  } finally {
    release(picture);
    release(thumb);
  }
}

function canvas(width: number, height: number): HTMLCanvasElement {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  return element;
}

function draw(target: HTMLCanvasElement, source: CanvasImageSource, crop: { x: number; y: number; width: number; height: number }): void {
  const context = target.getContext("2d");
  if (!context) throw new Error("Canvas 2D isn't available.");
  context.imageSmoothingQuality = "high";
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, target.width, target.height);
}

function toJpeg(source: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    source.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the picture."))), "image/jpeg", quality);
  });
}

// Shrinking a canvas to 0x0 frees its pixel memory right away (Safari holds on to it otherwise).
function release(element: HTMLCanvasElement): void {
  element.width = 0;
  element.height = 0;
}
