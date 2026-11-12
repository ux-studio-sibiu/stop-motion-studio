import { createImageCache } from "@/adapters/images/imageCache";

// The open project's photos, in memory until step 07 stores them in IndexedDB.
// Full pictures and thumbnails are kept apart so the timeline only ever touches thumbnails.
export const images = createImageCache();
export const thumbs = createImageCache();

export function clearMedia(): void {
  images.clear();
  thumbs.clear();
}
