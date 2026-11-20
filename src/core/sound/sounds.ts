// The studio's own sounds, as notes for a tiny synthesiser (no sound files): the shutter click
// when a picture is taken (step 29), and the starter sound effects (library.ts, step 29b).
//   frequency  Hz at the start; `to` glides to another (a boing, a slide whistle)
//   wave       an oscillator's shape, or "noise" (a whoosh, a drum)
//   start, duration in seconds; volume 0-1

export type Note = { frequency: number; to?: number; start: number; duration: number; wave: "sine" | "square" | "triangle" | "sawtooth" | "noise"; volume: number };

export const SHUTTER: readonly Note[] = [
  { frequency: 1400, start: 0, duration: 0.04, wave: "square", volume: 0.12 },
  { frequency: 700, start: 0.05, duration: 0.06, wave: "square", volume: 0.1 },
];

// When the notes end, in seconds from their start.
export const notesLength = (notes: readonly Note[]): number => Math.max(0, ...notes.map((note) => note.start + note.duration));
