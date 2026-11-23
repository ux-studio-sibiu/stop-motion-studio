import { newId } from "./ids";
import { timeLanes } from "./lanes";
import type { Project } from "./types";

// Sound effects in time (step 29b), on the timeline's bottom row. A clip starts at tick `start`
// and plays its sound once, whatever pictures are there then: anchored to time like overlays
// (PLAN.md §3). Its length is the sound's own, in seconds, so only the start is stored: changing
// the speed changes how many pictures it covers, never how long it sounds.
//   sound   a library entry ("cartoon/boing", core/sound/library.ts); a sound this version
//           doesn't know is kept, and shown as unknown (from a newer studio)
//   volume  one of VOLUMES: quiet, normal or loud
export type SoundClip = { id: string; start: number; sound: string; volume: number };

export const VOLUMES = [0.5, 1, 1.5] as const;
export const VOLUME_NAMES: Readonly<Record<number, string>> = { 0.5: "Quiet", 1: "Normal", 1.5: "Loud" };

// `volume` one of VOLUMES (music starts quiet); anything else becomes normal.
export function createSoundClip(sound: string, start: number, volume = 1): SoundClip {
  return cleanSoundClip({ id: newId(), start, sound, volume });
}

// Whole ticks, never before the start; a volume that isn't one of VOLUMES becomes normal.
export function cleanSoundClip(clip: SoundClip): SoundClip {
  const start = Number.isFinite(clip.start) ? Math.max(0, Math.round(clip.start)) : 0;
  const volume = (VOLUMES as readonly number[]).includes(clip.volume) ? clip.volume : 1;
  return { id: clip.id, start, sound: clip.sound, volume };
}

// A project's sounds, whatever is stored: none for projects from before step 29b, and anything
// that isn't a clip left out.
export function soundsOf(project: Pick<Project, "sounds"> | null | undefined): SoundClip[] {
  const stored: unknown = project?.sounds;
  if (!Array.isArray(stored)) return [];
  return stored.filter((item): item is SoundClip => typeof item?.id === "string" && typeof item?.sound === "string" && item.sound !== "").map(cleanSoundClip);
}

// How many ticks a sound of `seconds` covers at `fps`: at least one, so every clip can be grabbed.
export function soundTicks(seconds: number, fps: number): number {
  return Math.max(1, Math.ceil(seconds * fps - 1e-9));
}

export function moveSoundClip(clip: SoundClip, ticks: number): SoundClip {
  return cleanSoundClip({ ...clip, start: clip.start + Math.round(ticks) });
}

// With one clip replaced (by id) or removed (`null`).
export function withSoundClip(clips: readonly SoundClip[], id: string, next: SoundClip | null): SoundClip[] {
  return clips.flatMap((clip) => (clip.id !== id ? [clip] : next ? [next] : []));
}

export function sameSounds(a: readonly SoundClip[], b: readonly SoundClip[]): boolean {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b);
}

// Rows to draw the sound row in, so overlapping sounds don't hide each other (timeLanes). `ticks`
// is how long each one is. By id.
export function soundLanes(clips: readonly SoundClip[], ticks: (clip: SoundClip) => number): Record<string, number> {
  return timeLanes(clips.map((clip) => ({ id: clip.id, start: clip.start, end: clip.start + ticks(clip) })));
}

// What to play from tick `from`, as seconds: each clip that hasn't finished by then, `delay`
// seconds from now, starting `offset` seconds into the sound (a clip already going plays from
// part-way). Clips starting at `until` (ticks) or later are left out: playback and export stop
// at the end of the pictures. Sorted by delay. `seconds` is each clip's sound length.
export type ScheduledSound = { clip: SoundClip; delay: number; offset: number };
export function soundsFrom(clips: readonly SoundClip[], from: number, until: number, fps: number, seconds: (clip: SoundClip) => number): ScheduledSound[] {
  const now = from / fps;
  return clips
    .filter((clip) => clip.start < until)
    .map((clip) => ({ clip, at: clip.start / fps, length: seconds(clip) }))
    .filter(({ at, length }) => at + length > now)
    .map(({ clip, at }) => ({ clip, delay: Math.max(0, at - now), offset: Math.max(0, now - at) }))
    .sort((a, b) => a.delay - b.delay);
}
