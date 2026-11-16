// Decoded pictures for the renderer. Decoding a JPEG takes a few milliseconds, so each photo is
// decoded once into an ImageBitmap and kept, but only the most recently used `limit` of them:
// a bitmap of a 1280 × 720 photo is about 3.5 MB, held outside the JavaScript heap, where the
// garbage collector doesn't see it. Every bitmap that leaves the cache is close()d, which frees
// it at once.
//
// `get` is synchronous (for drawing in an animation frame); `load` decodes in the background
// and resolves when the bitmap is ready. Loading the same picture twice decodes it once.

export type Bitmap = { width: number; height: number; close(): void };

export type BitmapCacheOptions<B extends Bitmap> = {
  limit?: number;
  fetch: (imageId: string) => Promise<Blob | undefined>;   // the stored photo
  decode?: (blob: Blob) => Promise<B>;
};

export const BITMAP_LIMIT = 30;

export function createBitmapCache<B extends Bitmap = ImageBitmap>({ limit = BITMAP_LIMIT, fetch, decode = (blob) => createImageBitmap(blob) as unknown as Promise<B> }: BitmapCacheOptions<B>) {
  const bitmaps = new Map<string, B>();   // in use order: the first is the least recently used
  const loading = new Map<string, Promise<B | undefined>>();
  let generation = 0;                     // bumped by clear(), so a decode that finishes late is dropped

  const touch = (imageId: string, bitmap: B) => {
    bitmaps.delete(imageId);
    bitmaps.set(imageId, bitmap);
    while (bitmaps.size > limit) {
      const [oldest, evicted] = bitmaps.entries().next().value as [string, B];
      bitmaps.delete(oldest);
      evicted.close();
    }
  };

  return {
    get(imageId: string): B | undefined {
      const bitmap = bitmaps.get(imageId);
      if (bitmap) touch(imageId, bitmap);
      return bitmap;
    },

    load(imageId: string): Promise<B | undefined> {
      const ready = bitmaps.get(imageId);
      if (ready) { touch(imageId, ready); return Promise.resolve(ready); }
      const running = loading.get(imageId);
      if (running) return running;
      const mine = generation;
      const task = (async () => {
        try {
          const blob = await fetch(imageId);
          if (!blob) return undefined;
          const bitmap = await decode(blob);
          if (mine !== generation) { bitmap.close(); return undefined; }   // cleared meanwhile
          touch(imageId, bitmap);
          return bitmap;
        } finally {
          loading.delete(imageId);
        }
      })();
      loading.set(imageId, task);
      return task;
    },

    has: (imageId: string) => bitmaps.has(imageId),

    delete(imageId: string): void {
      bitmaps.get(imageId)?.close();
      bitmaps.delete(imageId);
    },

    // Leaving the studio or opening another animation.
    clear(): void {
      generation++;
      bitmaps.forEach((bitmap) => bitmap.close());
      bitmaps.clear();
      loading.clear();
    },

    get size() { return bitmaps.size; },
  };
}

export type BitmapCache<B extends Bitmap = ImageBitmap> = ReturnType<typeof createBitmapCache<B>>;
