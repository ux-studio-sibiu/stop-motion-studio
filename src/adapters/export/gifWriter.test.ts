import { describe, expect, it } from "vitest";
import { readGif } from "@/adapters/export/gifReader";
import { createGifWriter } from "@/adapters/export/gifWriter";
import { GIF_ENCODING } from "@/core/export/gif";

// The GIF writer in Node. Its files are decoded pixel by pixel (gifReader.ts), the way a GIF
// viewer would: so the tests check what a child would see (each picture's colours, how long
// it shows, that it loops), not how the bytes happen to be laid out.

const solid = (width: number, height: number, [r, g, b]: number[]) => {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) rgba.set([r, g, b, 255], i);
  return rgba;
};

// A set that stays put with a little camera noise (±3), and a red square (the toy) that moves.
function scene(width: number, height: number, toyX: number, seed: number) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  let s = seed;
  const noise = () => { s = (s * 1103515245 + 12345) % 2147483648; return (s % 7) - 3; };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const toy = x >= toyX && x < toyX + 8 && y >= 8 && y < 16;
      const base = toy ? [200, 40, 40] : [40 + ((x * 3) % 120), 90 + ((y * 5) % 100), 160];
      rgba.set([base[0] + noise(), base[1] + noise(), base[2] + noise(), 255], (y * width + x) * 4);
    }
  }
  return rgba;
}

const pixel = (frame: Uint8ClampedArray, width: number, x: number, y: number) => [...frame.slice((y * width + x) * 4, (y * width + x) * 4 + 3)];
const close = (a: number[], b: number[], within: number) => a.every((value, i) => Math.abs(value - b[i]) <= within);

describe("createGifWriter", () => {
  it("writes a looping GIF of the pictures, each shown for its delay, in its colours", () => {
    const writer = createGifWriter();
    writer.add(solid(8, 4, [255, 0, 0]), 8, 4, 10);
    writer.add(solid(8, 4, [0, 0, 255]), 8, 4, 38);
    writer.add(solid(8, 4, [0, 255, 0]), 8, 4, 7);
    const gif = readGif(writer.finish());
    expect(gif).toMatchObject({ width: 8, height: 4, loops: true, delays: [10, 38, 7] });
    expect(gif.frames.map((frame) => pixel(frame, 8, 3, 2))).toEqual([[255, 0, 0], [0, 0, 255], [0, 255, 0]]);
  });

  it("at high quality, every picture is whole", () => {
    const writer = createGifWriter(GIF_ENCODING.high);
    for (let i = 0; i < 3; i++) writer.add(scene(48, 24, 4 + i * 10, i + 1), 48, 24, 10);
    expect(readGif(writer.finish()).kept).toEqual([false, false, false]);
  });

  it("at medium and low, a picture stores only what changed, and still shows the right thing", () => {
    for (const quality of ["medium", "low"] as const) {
      const writer = createGifWriter(GIF_ENCODING[quality]);
      const photos = [0, 1, 2].map((i) => scene(48, 24, 4 + i * 10, i + 1));
      photos.forEach((photo) => writer.add(photo, 48, 24, 10));
      const gif = readGif(writer.finish());
      expect(gif.kept).toEqual([false, true, true]);
      const within = GIF_ENCODING[quality].tolerance + 18;   // the tolerance, plus the colour steps
      for (const [i, photo] of photos.entries()) {
        // the set's corners, the toy where it is now, and where it was before (the set again)
        for (const [x, y] of [[0, 0], [30, 20], [4 + i * 10 + 3, 12], [4 + 3, 12], [47, 23]]) {
          expect(close(pixel(gif.frames[i], 48, x, y), pixel(photo, 48, x, y), within)).toBe(true);
        }
      }
    }
  });

  it("the lower the quality, the smaller the file, when the set stays put", () => {
    const sizes = (["high", "medium", "low"] as const).map((quality) => {
      const writer = createGifWriter(GIF_ENCODING[quality]);
      for (let i = 0; i < 6; i++) writer.add(scene(96, 48, 4 + i * 12, i + 1), 96, 48, 10);
      return writer.finish().length;
    });
    expect(sizes[1]).toBeLessThan(sizes[0] * 0.6);
    expect(sizes[2]).toBeLessThan(sizes[1]);
  });

  it("a picture where nothing changed is still there, for its time, looking the same", () => {
    const writer = createGifWriter(GIF_ENCODING.medium);
    const photo = scene(16, 16, 2, 1);
    writer.add(photo, 16, 16, 10);
    writer.add(photo, 16, 16, 30);
    const gif = readGif(writer.finish());
    expect(gif.delays).toEqual([10, 30]);
    // the same to within the colour steps (a pixel the colours missed by more than the allowance
    // is written again, a little closer)
    for (let i = 0; i < gif.frames[0].length; i++) expect(Math.abs(gif.frames[1][i] - gif.frames[0][i])).toBeLessThanOrEqual(18);
  });
});
