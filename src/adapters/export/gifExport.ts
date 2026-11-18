import { drawExportFrame } from "@/core/export/frame";
import { GIF_ENCODING, type GifEncoding, type GifFrame } from "@/core/export/gif";
import { frameIndexAt } from "@/core/model";
import type { DrawableImage, Rect, Scene } from "@/core/render";

// Making a GIF (step 25): the page draws each GIF frame through the shared renderer (so the file
// looks like the stage, fonts and all), and a worker (gif.worker.ts) picks its colours and
// encodes it. A few pictures are in flight at a time, so a long animation never holds every
// picture's pixels at once.

export type GifToWorker = { type: "start"; encoding: GifEncoding } | { type: "frame"; rgba: ArrayBuffer; width: number; height: number; delay: number } | { type: "finish" };
export type GifFromWorker = { type: "added" } | { type: "done"; bytes: ArrayBuffer } | { type: "error"; message: string };

export type GifExportOptions = {
  scene: Scene;                 // the whole animation, at the project's size
  rect: Rect;                   // the part that goes in the file (exportRect)
  size: { width: number; height: number };   // the file's pictures (gifSize)
  frames: readonly GifFrame[];  // what becomes the GIF's pictures (gifFrames)
  encoding?: GifEncoding;       // how hard it's squeezed (GIF_ENCODING: the quality); high by default
  loadImage: (imageId: string) => Promise<DrawableImage | undefined>;
  onProgress?: (fraction: number) => void;   // 0 to 1
  signal?: AbortSignal;         // stops it: the promise rejects with an AbortError
  createWorker?: () => Worker;
};

const IN_FLIGHT = 2;   // pictures sent to the worker and not encoded yet, at most

export async function exportGif({ scene, rect, size, frames, encoding = GIF_ENCODING.high, loadImage, onProgress, signal, createWorker = gifWorker }: GifExportOptions): Promise<Blob> {
  if (frames.length === 0) throw new Error("Nothing to export.");
  signal?.throwIfAborted();
  const full = context(scene.width, scene.height);
  const crop = context(rect.width, rect.height);
  const out = context(size.width, size.height, true);
  const worker = createWorker();

  let added = 0;
  let waiting: (() => void) | null = null;
  let failure: unknown = null;
  const finish = Promise.withResolvers<ArrayBuffer>();
  finish.promise.catch(() => {});   // handled where it's awaited; this keeps an early failure from being "unhandled"
  const fail = (error: unknown) => { failure ??= error; finish.reject(error); waiting?.(); };

  worker.onmessage = (event: MessageEvent<GifFromWorker>) => {
    const message = event.data;
    if (message.type === "added") { added++; onProgress?.(added / (frames.length + 1)); waiting?.(); }
    else if (message.type === "done") finish.resolve(message.bytes);
    else fail(new Error(message.message));
  };
  worker.onerror = (event) => fail(new Error(event.message || "The GIF worker failed."));
  const onAbort = () => fail(signal?.reason ?? new DOMException("Stopped", "AbortError"));
  signal?.addEventListener("abort", onAbort);

  try {
    worker.postMessage({ type: "start", encoding } satisfies GifToWorker);
    onProgress?.(0);
    for (const [sent, frame] of frames.entries()) {
      while (sent - added >= IN_FLIGHT && !failure) await new Promise<void>((resolve) => { waiting = resolve; });
      if (failure) throw failure;
      const picture = scene.frames[frameIndexAt(scene.frames, frame.tick)];
      const image = picture ? await loadImage(picture.imageId) : undefined;
      if (failure) throw failure;
      drawExportFrame({ full, crop, out }, scene, () => image, frame.tick, rect);
      const rgba = out.getImageData(0, 0, size.width, size.height).data.buffer;
      worker.postMessage({ type: "frame", rgba, width: size.width, height: size.height, delay: frame.delay } satisfies GifToWorker, [rgba]);
    }
    worker.postMessage({ type: "finish" } satisfies GifToWorker);
    const bytes = await finish.promise;
    onProgress?.(1);
    return new Blob([bytes], { type: "image/gif" });
  } finally {
    signal?.removeEventListener("abort", onAbort);
    worker.terminate();
  }
}

function gifWorker(): Worker {
  return new Worker(new URL("./gif.worker.ts", import.meta.url), { type: "module" });
}

function context(width: number, height: number, read = false): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", read ? { willReadFrequently: true } : undefined);
  if (!ctx) throw new Error("No canvas for the GIF.");
  return ctx;
}
