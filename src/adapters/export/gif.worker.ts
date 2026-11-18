/// <reference lib="webworker" />
import { createGifWriter, type GifWriter } from "./gifWriter";
import type { GifToWorker, GifFromWorker } from "./gifExport";

// The GIF worker: picks each picture's colours and encodes it (the slow part), off the page's
// thread, so the studio stays responsive while a GIF is made. The page draws the pictures (where
// the fonts are loaded) and sends their pixels here, one at a time.
let writer: GifWriter | null = null;   // made by the first message, with the quality asked for
const post = (message: GifFromWorker, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(message, transfer);

self.onmessage = (event: MessageEvent<GifToWorker>) => {
  try {
    const message = event.data;
    if (message.type === "start") {
      writer = createGifWriter(message.encoding);
    } else if (message.type === "frame") {
      writer!.add(new Uint8ClampedArray(message.rgba), message.width, message.height, message.delay);
      post({ type: "added" });
    } else {
      const bytes = writer!.finish();
      post({ type: "done", bytes: bytes.buffer as ArrayBuffer }, [bytes.buffer as ArrayBuffer]);
    }
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
