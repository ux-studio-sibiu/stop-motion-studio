import { applyPalette, GIFEncoder, quantize, type Palette } from "gifenc";
import { GIF_ENCODING, type GifEncoding } from "@/core/export/gif";

// Writes a GIF one picture at a time (gifenc). Each picture gets its own colours (a palette per
// frame): photos change too much from one picture to the next to share one. It loops forever,
// like a GIF is expected to. Plain code, no DOM: it runs in the GIF worker, and in Node for tests.
//
// With a `tolerance` (quality medium or low, GIF_ENCODING), each picture after the first stores
// only the pixels that changed: the others are see-through, and the viewer keeps showing what was
// there (GIF "do not dispose"). What counts as changed is measured against what the viewer shows
// by then (the colours as written, not the photo), so small differences never add up into drift.
export type GifWriter = {
  // `rgba` is the picture's pixels (getImageData's data), `delay` in hundredths of a second.
  add(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, delay: number): void;
  finish(): Uint8Array;
};

export function createGifWriter({ colours, format, tolerance, transparent = false }: GifEncoding = GIF_ENCODING.high): GifWriter {
  const gif = GIFEncoder();
  let shown: Uint8ClampedArray | null = null;   // what the viewer shows so far (RGBA), with a tolerance
  let first = true;

  const write = (index: Uint8Array, width: number, height: number, palette: Palette, delay: number, see?: number) => {
    gif.writeFrame(index, width, height, {
      palette,
      delay: delay * 10,   // gifenc counts in ms
      ...(first ? { repeat: 0 } : {}),
      ...(see === undefined ? {} : { transparent: true, transparentIndex: see, dispose: 1 }),
    });
    first = false;
  };

  return {
    add(rgba, width, height, delay) {
      const pixels = width * height;
      // With see-through pictures: every picture whole, its see-through pixels (alpha under half)
      // given the last palette slot, and the GIF told to clear each picture before the next
      // (dispose 2), so nothing of one shows through the holes of the next.
      if (transparent) {
        const opaque = new Uint8ClampedArray(rgba.length);
        let count = 0;
        for (let p = 0; p < pixels; p++) if (rgba[p * 4 + 3] >= 128) opaque.set(rgba.subarray(p * 4, p * 4 + 4), (count++) * 4);
        const part = opaque.subarray(0, Math.max(1, count) * 4);
        const palette = count ? quantize(part, colours - 1, { format }) : [];
        const see = palette.length;
        const partIndex = count ? applyPalette(part, palette, format) : new Uint8Array(0);
        palette.push([0, 0, 0]);
        const index = new Uint8Array(pixels).fill(see);
        for (let p = 0, n = 0; p < pixels; p++) if (rgba[p * 4 + 3] >= 128) index[p] = partIndex[n++];
        gif.writeFrame(index, width, height, { palette, delay: delay * 10, ...(first ? { repeat: 0 } : {}), transparent: true, transparentIndex: see, dispose: 2 });
        first = false;
        return;
      }
      if (tolerance === 0 || !shown || shown.length !== rgba.length) {
        const palette = quantize(rgba, colours, { format });
        const index = applyPalette(rgba, palette, format);
        if (tolerance > 0) shown = paint(new Uint8ClampedArray(rgba.length), index, palette);
        write(index, width, height, palette, delay);
        return;
      }

      // Only what changed: its pixels picked out, given colours of their own (one slot fewer: the
      // last is "see-through"), then put back in place over a see-through frame.
      const changed = new Uint32Array(pixels);
      let count = 0;
      for (let p = 0; p < pixels; p++) {
        const i = p * 4;
        if (Math.abs(rgba[i] - shown[i]) > tolerance || Math.abs(rgba[i + 1] - shown[i + 1]) > tolerance || Math.abs(rgba[i + 2] - shown[i + 2]) > tolerance) changed[count++] = p;
      }
      const part = new Uint8ClampedArray(Math.max(1, count) * 4);
      for (let n = 0; n < count; n++) part.set(rgba.subarray(changed[n] * 4, changed[n] * 4 + 4), n * 4);
      const palette = count ? quantize(part, colours - 1, { format }) : [];
      const see = palette.length;
      const partIndex = count ? applyPalette(part, palette, format) : new Uint8Array(0);
      palette.push([0, 0, 0]);
      const index = new Uint8Array(pixels).fill(see);
      for (let n = 0; n < count; n++) {
        const p = changed[n];
        const [r, g, b] = palette[partIndex[n]];
        index[p] = partIndex[n];
        shown[p * 4] = r;
        shown[p * 4 + 1] = g;
        shown[p * 4 + 2] = b;
      }
      write(index, width, height, palette, delay, see);
    },
    finish() {
      gif.finish();
      return gif.bytes();
    },
  };
}

// The colours the viewer shows for `index` in `palette`, as RGBA.
function paint(into: Uint8ClampedArray, index: Uint8Array, palette: Palette): Uint8ClampedArray {
  for (let p = 0; p < index.length; p++) {
    const [r, g, b] = palette[index[p]];
    into.set([r, g, b, 255], p * 4);
  }
  return into;
}
