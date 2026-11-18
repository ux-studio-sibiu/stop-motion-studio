import { BufferTarget, CanvasSource, canEncodeVideo, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat, type VideoCodec } from "mediabunny";
import { drawExportFrame } from "@/core/export/frame";
import type { VideoFrame } from "@/core/export/video";
import { frameIndexAt } from "@/core/model";
import type { DrawableImage, Rect, Scene } from "@/core/render";

// Making a video (step 26) with Mediabunny (WebCodecs, in the browser; no FFmpeg). The page draws
// each video frame through the shared renderer, like the GIF, onto a canvas the encoder reads.
// A held picture is one frame with a long duration, not copies.

// What this browser can make, best first: MP4 with H.264 plays in every player and app; WebM with
// VP9 where H.264 can't be encoded (some Linux builds, Chromium without its licensed codecs).
// Asked of the browser itself (WebCodecs), never guessed from its name.
export type VideoFormat = { container: "mp4" | "webm"; codec: VideoCodec; extension: string; type: string };
export const VIDEO_FORMATS: readonly VideoFormat[] = [
  { container: "mp4", codec: "avc", extension: "mp4", type: "video/mp4" },
  { container: "webm", codec: "vp9", extension: "webm", type: "video/webm" },
];

export async function videoFormat(size: { width: number; height: number }): Promise<VideoFormat | null> {
  if (typeof VideoEncoder === "undefined") return null;
  for (const format of VIDEO_FORMATS) {
    try {
      if (await canEncodeVideo(format.codec, { ...size, quality: QUALITY_HIGH })) return format;
    } catch { /* this one can't: try the next */ }
  }
  return null;
}

export type VideoExportOptions = {
  scene: Scene;                 // the whole animation, at the project's size
  rect: Rect;                   // the part that goes in the file (exportRect), its size even
  frames: readonly VideoFrame[];   // what becomes the video's frames (videoFrames)
  format: VideoFormat;          // from videoFormat
  loadImage: (imageId: string) => Promise<DrawableImage | undefined>;
  onProgress?: (fraction: number) => void;   // 0 to 1
  signal?: AbortSignal;         // stops it: the promise rejects with an AbortError
};

export async function exportVideo({ scene, rect, frames, format, loadImage, onProgress, signal }: VideoExportOptions): Promise<Blob> {
  if (frames.length === 0) throw new Error("Nothing to export.");
  signal?.throwIfAborted();
  const full = context(scene.width, scene.height);
  const crop = context(rect.width, rect.height);
  const out = context(rect.width, rect.height);   // the file is the exported part as it is

  const target = new BufferTarget();
  const output = new Output({ format: format.container === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(), target });
  const source = new CanvasSource(out.canvas, { codec: format.codec, quality: QUALITY_HIGH });
  output.addVideoTrack(source);

  try {
    await output.start();
    onProgress?.(0);
    for (const [index, frame] of frames.entries()) {
      signal?.throwIfAborted();
      const picture = scene.frames[frameIndexAt(scene.frames, frame.tick)];
      const image = picture ? await loadImage(picture.imageId) : undefined;
      signal?.throwIfAborted();
      drawExportFrame({ full, crop, out }, scene, () => image, frame.tick, rect);
      await source.add(frame.timestamp, frame.duration);   // waits while the encoder catches up
      onProgress?.((index + 1) / (frames.length + 1));
    }
    signal?.throwIfAborted();
    await output.finalize();
    onProgress?.(1);
    return new Blob([target.buffer!], { type: format.type });
  } catch (error) {
    if (output.state !== "finalized" && output.state !== "canceled") await output.cancel().catch(() => {});
    throw error;
  }
}

function context(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas for the video.");
  return ctx;
}
