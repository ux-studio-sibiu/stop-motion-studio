// Adding photos from the computer (step 28): which files to take, in what order, at what size,
// and what to tell the child afterwards. Opening and resizing them is the adapter's job
// (adapters/images/photo.ts); after that they're saved like a capture.

// At most this many photos at once, and this big a file each, so a stray folder of holiday
// pictures can't fill the device in one go.
export const PHOTO_LIMITS = { files: 300, fileBytes: 50 * 1024 * 1024 } as const;

type FileLike = { name: string; type: string; size?: number };

// iPhones save HEIC. Few browsers can open it (Safari can), so it gets its own message.
export function isHeic({ name, type }: FileLike): boolean {
  return /^image\/hei[cf]/i.test(type) || /\.hei[cf]$/i.test(name);
}

// A picture by its type, or by its name when the type is missing (some drops have none).
export function isPhotoFile(file: FileLike): boolean {
  return file.type.startsWith("image/") || isHeic(file) || (!file.type && /\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(file.name));
}

// The order to add them in: by name, counting numbers as numbers, so IMG_9 comes before IMG_10
// and photos taken one after another stay in order.
export function photoOrder<T extends FileLike>(files: readonly T[]): T[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  return [...files].sort((a, b) => collator.compare(a.name, b.name));
}

// A photo's size in the animation: its own shape, shrunk to fit inside the animation's size and
// never enlarged. The stage fits it in whole (like a capture of another shape), so nothing is
// cut off, and a portrait photo shows with bars at its sides.
export function photoSize(width: number, height: number, inside: { width: number; height: number }): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, inside.width / width, inside.height / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type PhotoResult = { added: number; heic: number; broken: number; tooBig: number; notPhotos: number; overLimit: number };

// The note afterwards: what was added, and why any weren't. Short, one reason each.
export function photoNote({ added, heic, broken, tooBig, notPhotos, overLimit }: PhotoResult): { text: string; problem: boolean } {
  const photos = (n: number) => (n === 1 ? "1 photo" : `${n} photos`);
  const parts = [added > 0 ? `Added ${photos(added)}.` : "No photos added."];
  if (heic > 0) parts.push(`${photos(heic)} from an iPhone (HEIC) can't be opened in this browser: save ${heic === 1 ? "it" : "them"} as JPEG first.`);
  if (broken > 0) parts.push(`${photos(broken)} couldn't be opened.`);
  if (tooBig > 0) parts.push(`${photos(tooBig)} ${tooBig === 1 ? "was" : "were"} too big.`);
  if (overLimit > 0) parts.push(`Only ${PHOTO_LIMITS.files} at a time: ${photos(overLimit)} left out.`);
  if (notPhotos > 0) parts.push(`${notPhotos === 1 ? "1 file wasn't a photo" : `${notPhotos} files weren't photos`}.`);
  return { text: parts.join(" "), problem: parts.length > 1 || added === 0 };
}
