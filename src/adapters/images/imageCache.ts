// In-memory home for photo Blobs until IndexedDB takes over (step 07). Kept out of the
// store on purpose: Blobs are large, and the store only ever holds the ids that point here.
//
// The cache also owns the object URLs that let an <img> show a Blob: one per image, made the
// first time it's asked for and revoked when the image is replaced, deleted or cleared. So
// components never create or revoke URLs themselves, and none leak.

export type ImageCache = {
  put: (imageId: string, blob: Blob) => void;
  get: (imageId: string) => Blob | undefined;
  url: (imageId: string) => string | undefined;
  delete: (imageId: string) => void;
  clear: () => void;
  readonly size: number;
};

export function createImageCache(): ImageCache {
  const blobs = new Map<string, Blob>();
  const urls = new Map<string, string>();

  const revoke = (imageId: string) => {
    const url = urls.get(imageId);
    if (url) URL.revokeObjectURL(url);
    urls.delete(imageId);
  };

  return {
    put: (imageId, blob) => { revoke(imageId); blobs.set(imageId, blob); },
    get: (imageId) => blobs.get(imageId),
    url: (imageId) => {
      const blob = blobs.get(imageId);
      if (!blob) return undefined;
      let url = urls.get(imageId);
      if (!url) { url = URL.createObjectURL(blob); urls.set(imageId, url); }
      return url;
    },
    delete: (imageId) => { revoke(imageId); blobs.delete(imageId); },
    clear: () => { [...urls.keys()].forEach(revoke); blobs.clear(); },
    get size() { return blobs.size; },
  };
}
