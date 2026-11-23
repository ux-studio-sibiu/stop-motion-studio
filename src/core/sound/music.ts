import type { SoundCategory } from "./library";

// Background music (step 29b): tunes from FreePD (public domain, by Kevin MacLeod and others),
// copied from the Internet Archive's mirror of the closed site (archive.org/details/freepd). Each
// is the start of the track, cut to 30 s at MP3 frame boundaries (no re-encoding); the two made as
// loops are whole. Files music-<title>.mp3 in public/sounds/.
// A tune goes on the Sound Layer like any sound, but quieter at first (`volume`), so the sound
// effects stay heard over it, and it fades out where the animation ends.
export type MusicTrack = { id: string; name: string; category: SoundCategory; file: string; seconds: number; volume: number };

const tune = (slug: string, name: string, title: string, seconds: number): MusicTrack =>
  ({ id: `background/${slug}`, name, category: "Background", file: `music-${title}.mp3`, seconds, volume: 0.5 });

export const BACKGROUND_MUSIC: readonly MusicTrack[] = [
  tune("llama", "Llama", "llama-in-pajama", 30.01),
  tune("silly", "Silly", "silly-boy", 30.01),
  tune("bananas", "Bananas", "going-bananas", 30.01),
  tune("mischief", "Mischief", "comic-game-loop-mischief", 42.74),
  tune("ukulele", "Ukulele", "happy-whistling-ukulele", 30.01),
  tune("sunshine", "Sunshine", "funshine", 30.01),
  tune("adventure", "Adventure", "adventure", 30.01),
  tune("hero", "Hero", "heroic-adventure", 30.01),
  tune("creepy", "Creepy", "creepy-hallow", 30.01),
  tune("attic", "Attic", "footsteps-in-the-attic", 30.01),
  tune("piano", "Piano", "lovely-piano-song", 30.01),
  tune("forest", "Forest", "forest-frolic-loop", 37.36),
  tune("baguette", "Baguette", "le-baguette", 30.01),
  tune("chiptune", "Chiptune", "bit-bit-loop", 30.01),
  tune("hippety", "Hippety", "hippety-hop", 30.01),
];
