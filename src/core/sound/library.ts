import { RECORDED_SOUNDS } from "./recorded";
import { notesLength, type Note } from "./sounds";

// The sound effects a child can put on the timeline (step 29b), by category. Two kinds:
//   made      by the synthesiser from notes (MADE_SOUNDS, below): nothing to load
//   recorded  a file in public/sounds/ (recorded.ts), with its length in seconds
// Both are read the same way (soundSeconds, and soundBuffer in the adapter). Ids are
// "category/name" and are what a project stores, so they never change once shipped.

export type SoundEntry = { id: string; name: string; category: SoundCategory } & ({ notes: readonly Note[] } | { file: string; seconds: number });
export type SoundCategory = "Cartoon" | "Whooshes" | "Bangs" | "Magic" | "Animals" | "People" | "Footsteps" | "Vehicles" | "Machines" | "Home" | "Nature" | "Water" | "Music";
export const SOUND_CATEGORIES: readonly SoundCategory[] = ["Cartoon", "Whooshes", "Bangs", "Magic", "Animals", "People", "Footsteps", "Vehicles", "Machines", "Home", "Nature", "Water", "Music"];

const note = (frequency: number, start: number, duration: number, wave: Note["wave"], volume: number, to?: number): Note => ({ frequency, start, duration, wave, volume, ...(to ? { to } : {}) });

// Several notes one after another, each `step` seconds.
const tune = (frequencies: readonly number[], step: number, wave: Note["wave"], volume: number, last = step): Note[] =>
  frequencies.map((frequency, i) => note(frequency, i * step, i === frequencies.length - 1 ? last : step, wave, volume));

export const MADE_SOUNDS: readonly SoundEntry[] = [
  { id: "cartoon/boing", name: "Boing", category: "Cartoon", notes: [note(180, 0, 0.45, "sine", 0.4, 520), note(520, 0.45, 0.25, "sine", 0.2, 300)] },
  { id: "cartoon/pop", name: "Pop", category: "Cartoon", notes: [note(900, 0, 0.06, "sine", 0.45, 250)] },
  { id: "cartoon/bonk", name: "Bonk", category: "Cartoon", notes: [note(220, 0, 0.12, "triangle", 0.5, 110), note(160, 0, 0.05, "noise", 0.25)] },
  { id: "cartoon/whistle-up", name: "Rise", category: "Cartoon", notes: [note(400, 0, 0.6, "sine", 0.3, 1600)] },
  { id: "cartoon/whistle-down", name: "Fall", category: "Cartoon", notes: [note(1600, 0, 0.7, "sine", 0.3, 300)] },
  { id: "cartoon/whoosh", name: "Whoosh", category: "Cartoon", notes: [note(400, 0, 0.45, "noise", 0.35)] },
  { id: "cartoon/splat", name: "Splat", category: "Cartoon", notes: [note(120, 0, 0.25, "noise", 0.45), note(140, 0, 0.15, "triangle", 0.3, 60)] },
  { id: "magic/sparkle", name: "Sparkle", category: "Magic", notes: tune([1568, 2093, 1760, 2637, 2349, 3136], 0.06, "sine", 0.18, 0.3) },
  { id: "magic/poof", name: "Poof", category: "Magic", notes: [note(800, 0, 0.5, "noise", 0.3), note(600, 0.02, 0.4, "sine", 0.15, 1800)] },
  { id: "magic/zap", name: "Zap", category: "Magic", notes: [note(1800, 0, 0.25, "sawtooth", 0.15, 200)] },
  { id: "machines/laser", name: "Laser", category: "Machines", notes: [note(2000, 0, 0.2, "square", 0.12, 400)] },
  { id: "machines/robot", name: "Robot", category: "Machines", notes: tune([440, 660, 330, 550], 0.09, "square", 0.12) },
  { id: "machines/beep", name: "Beep", category: "Machines", notes: [note(1000, 0, 0.18, "sine", 0.3)] },
  { id: "machines/horn", name: "Honk", category: "Machines", notes: [note(370, 0, 0.35, "sawtooth", 0.18), note(466, 0, 0.35, "sawtooth", 0.14)] },
  { id: "music/ta-da", name: "Ta-da", category: "Music", notes: [note(523, 0, 0.12, "triangle", 0.3), note(784, 0.14, 0.5, "triangle", 0.3), note(659, 0.14, 0.5, "triangle", 0.25)] },
  { id: "music/ding", name: "Ding", category: "Music", notes: [note(1319, 0, 0.8, "sine", 0.3), note(2637, 0, 0.4, "sine", 0.08)] },
  { id: "music/oh-no", name: "Oh no", category: "Music", notes: tune([392, 370, 349, 330], 0.25, "triangle", 0.3, 0.6) },
  { id: "music/drum-roll", name: "Drumroll", category: "Music", notes: [...Array.from({ length: 16 }, (_, i) => note(200, i * 0.05, 0.04, "noise", 0.25)), note(150, 0.8, 0.3, "noise", 0.45)] },
];

// Every sound in the Sounds tab: the made ones first, then the recorded ones.
export const SOUND_LIBRARY: readonly SoundEntry[] = [...MADE_SOUNDS, ...RECORDED_SOUNDS];

export function soundById(id: string): SoundEntry | undefined {
  return SOUND_LIBRARY.find((entry) => entry.id === id);
}

// How long a sound lasts, in seconds; a sound this version doesn't know counts as one second.
export function soundSeconds(id: string): number {
  const entry = soundById(id);
  if (!entry) return 1;
  return "notes" in entry ? notesLength(entry.notes) : entry.seconds;
}
