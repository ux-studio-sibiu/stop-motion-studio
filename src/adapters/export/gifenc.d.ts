// Types for gifenc (it ships none): only the parts the GIF writer uses.
declare module "gifenc" {
  export type Palette = number[][];
  export type GifFormat = "rgb565" | "rgb444" | "rgba4444";
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: { format?: GifFormat }): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: GifFormat): Uint8Array;
  export type GifStream = {
    writeFrame(index: Uint8Array, width: number, height: number, options?: { palette?: Palette; delay?: number; repeat?: number; first?: boolean; transparent?: boolean; transparentIndex?: number; dispose?: number }): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
  };
  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifStream;
}
