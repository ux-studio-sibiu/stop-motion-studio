// Reads a GIF back the way a viewer shows it: its size, whether it loops, and each picture with
// its delay and what's on screen once it's drawn (see-through pixels keep what was there, unless
// the picture before asked to be cleared: then they're see-through, alpha 0). For
// tests only (the writer's unit tests and export.spec); nothing in the app imports it.

export type ReadGif = {
  header: string;
  width: number;
  height: number;
  loops: boolean;
  delays: number[];             // hundredths of a second
  kept: boolean[];              // the picture is drawn over the one before ("do not dispose")
  frames: Uint8ClampedArray[];  // RGBA of the screen after each picture
};

// GIF89a: header, screen, palettes, Graphic Control (delay, see-through, dispose), LZW images.
export function readGif(bytes: Uint8Array): ReadGif {
  const text = (from: number, length: number) => String.fromCharCode(...bytes.slice(from, from + length));
  const header = text(0, 6);
  if (header !== "GIF89a") throw new Error("not a GIF89a");
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  let at = 13;
  const table = (packed: number) => {
    const size = 3 * 2 ** ((packed & 7) + 1);
    const colours = bytes.slice(at, at + size);
    at += size;
    return colours;
  };
  const global = bytes[10] & 0x80 ? table(bytes[10]) : null;
  const read: ReadGif = { header, width, height, loops: false, delays: [], kept: [], frames: [] };
  const screen = new Uint8ClampedArray(width * height * 4);
  let control = { delay: 0, see: -1, dispose: 0 };
  const subBlocks = () => {
    const parts: number[] = [];
    while (bytes[at] !== 0) { parts.push(...bytes.slice(at + 1, at + 1 + bytes[at])); at += bytes[at] + 1; }
    at++;
    return parts;
  };
  while (at < bytes.length && bytes[at] !== 0x3b) {
    if (bytes[at] === 0x21) {
      const label = bytes[at + 1];
      if (label === 0xf9) control = { delay: bytes[at + 4] | (bytes[at + 5] << 8), see: bytes[at + 3] & 1 ? bytes[at + 6] : -1, dispose: (bytes[at + 3] >> 2) & 7 };
      if (label === 0xff && text(at + 3, 11) === "NETSCAPE2.0") read.loops = (bytes[at + 16] | (bytes[at + 17] << 8)) === 0;
      at += 2;
      subBlocks();
    } else if (bytes[at] === 0x2c) {
      const packed = bytes[at + 9];
      at += 10;
      const colours = packed & 0x80 ? table(packed) : global;
      if (!colours) throw new Error("a picture without colours");
      const minCode = bytes[at++];
      lzw(subBlocks(), minCode, width * height).forEach((value, p) => {
        if (value !== control.see) screen.set([colours[value * 3], colours[value * 3 + 1], colours[value * 3 + 2], 255], p * 4);
      });
      read.delays.push(control.delay);
      read.kept.push(control.dispose === 1);
      read.frames.push(screen.slice());
      if (control.dispose === 2) screen.fill(0);   // "restore to background": cleared (see-through) before the next picture
    } else {
      throw new Error(`unexpected block at ${at}`);
    }
  }
  return read;
}

// GIF's LZW: variable-width codes, least significant bit first, a clear code and an end code.
function lzw(data: number[], minCode: number, pixels: number): Uint8Array {
  const out = new Uint8Array(pixels);
  const clear = 1 << minCode;
  let size = minCode + 1;
  let dict: number[][] = [];
  const reset = () => { dict = Array.from({ length: clear + 2 }, (_, i) => [i]); size = minCode + 1; };
  reset();
  let bit = 0;
  let prev: number[] | null = null;
  let n = 0;
  while (n < pixels && bit < data.length * 8) {
    let code = 0;
    for (let i = 0; i < size; i++, bit++) code |= ((data[bit >> 3] >> (bit & 7)) & 1) << i;
    if (code === clear) { reset(); prev = null; continue; }
    if (code === clear + 1) break;
    const entry: number[] = code < dict.length ? dict[code] : [...prev!, prev![0]];
    for (const value of entry) if (n < pixels) out[n++] = value;
    if (prev) dict.push([...prev, entry[0]]);
    if (dict.length === 1 << size && size < 12) size++;
    prev = entry;
  }
  return out;
}
