// In-memory home for photo Blobs until IndexedDB takes over (step 07). Kept out of the
// store on purpose: Blobs are large, and the store only ever holds the ids that point here.

export type ImageCache = {
  put: (imageId: string, blob: Blob) => void;
  get: (imageId: string) => Blob | undefined;
  delete: (imageId: string) => void;
  clear: () => void;
  readonly size: number;
};

export function createImageCache(): ImageCache {
  const blobs = new Map<string, Blob>();
  return {
    put: (imageId, blob) => { blobs.set(imageId, blob); },
    get: (imageId) => blobs.get(imageId),
    delete: (imageId) => { blobs.delete(imageId); },
    clear: () => { blobs.clear(); },
    get size() { return blobs.size; },
  };
}
