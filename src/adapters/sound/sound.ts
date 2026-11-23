import { soundsFrom, type ScheduledSound, type SoundClip } from "@/core/model";
import { soundById, soundSeconds, type Note } from "@/core/sound";

// The studio's sounds, with Web Audio (steps 29 and 29b): the capture click, previews in the
// Sounds tab, the sound row during playback, and the mix for a video. Every sound is made from
// notes in core (no sound files yet), rendered once into an AudioBuffer and kept.
// Browsers only let a page make sound after the user has pressed something; every first sound
// here follows a press (capture, Play, a sound's preview button), which is when the audio is set up.

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;   // no Web Audio, or it refused: the studio works the same without sound
  }
}

// Plays notes straight away (the capture click).
export function playNotes(notes: readonly Note[]): void {
  const ctx = audio();
  if (ctx) scheduleNotes(ctx, notes, ctx.currentTime);
}

// Plays `notes` from `at` (seconds, on the context's clock) into `destination`, each with a quick
// fade in and out so it doesn't click; a note with `to` glides to it. Works in an
// OfflineAudioContext too, which is how sounds are rendered and tested.
export function scheduleNotes(ctx: BaseAudioContext, notes: readonly Note[], at: number, destination: AudioNode = ctx.destination): void {
  for (const note of notes) {
    const start = at + note.start;
    const end = start + note.duration;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(note.volume, start + Math.min(0.01, note.duration / 4));
    gain.gain.linearRampToValueAtTime(0, end);
    gain.connect(destination);
    const source = note.wave === "noise" ? noise(ctx, note.duration) : ctx.createOscillator();
    if (source instanceof OscillatorNode) {
      source.type = note.wave as OscillatorType;
      source.frequency.setValueAtTime(note.frequency, start);
      if (note.to) source.frequency.exponentialRampToValueAtTime(note.to, end);
    }
    source.connect(gain);
    source.start(start);
    source.stop(end + 0.01);
  }
}

// White noise for `seconds` (a whoosh, a drum).
function noise(ctx: BaseAudioContext, seconds: number): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.ceil(seconds * ctx.sampleRate)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

// A library sound as audio, made once and kept: a made sound is rendered from its notes, a
// recorded one fetched from public/sounds/ and decoded. null for a sound this version doesn't
// know, or a file that can't be loaded (the studio stays silent for it).
const RATE = 44100;
export const SOUND_FILES = "/sounds/";   // where the recorded files are served
const rendered = new Map<string, Promise<AudioBuffer | null>>();
export function soundBuffer(id: string): Promise<AudioBuffer | null> {
  let buffer = rendered.get(id);
  if (!buffer) {
    buffer = (async () => {
      const entry = soundById(id);
      if (!entry || typeof OfflineAudioContext === "undefined") return null;
      if ("file" in entry) {
        const response = await fetch(SOUND_FILES + entry.file);
        if (!response.ok) return null;
        return new OfflineAudioContext(1, 1, RATE).decodeAudioData(await response.arrayBuffer());
      }
      const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(soundSeconds(id) * RATE) + 256), RATE);
      scheduleNotes(offline, entry.notes, 0);
      return offline.startRendering();
    })().catch(() => null);
    rendered.set(id, buffer);
  }
  return buffer;
}

// Plays one sound now, to hear it (the Sounds tab, a sound picked on the row): at most
// PREVIEW_SECONDS of it, fading out there (music is 30 s long), and one at a time: a new preview
// stops the one playing. `previews` counts them, so a sound still loading when another is clicked
// isn't played after all.
export const PREVIEW_SECONDS = 5;
let previewing: AudioBufferSourceNode | null = null;
let previews = 0;

export function previewSound(id: string, volume = 1): void {
  const ctx = audio();
  if (!ctx) return;
  stopPreview();
  const mine = ++previews;
  void soundBuffer(id).then((buffer) => {
    if (!buffer || mine !== previews) return;
    const now = ctx.currentTime;
    previewing = play(ctx, buffer, now, 0, volume, ctx.destination, now + PREVIEW_SECONDS);
  });
}

export function stopPreview(): void {
  try { previewing?.stop(); } catch { /* already ended */ }
  previewing = null;
}

// Plays the sound row during playback: each sound `delay` seconds from now, from `offset` into
// it (soundsFrom). `endsIn`: seconds until the animation ends, where sounds still going fade out.
// Returns a function that stops them all (pause, the end, a loop starting over).
export function playSounds(scheduled: readonly ScheduledSound[], endsIn?: number): () => void {
  const ctx = audio();
  if (!ctx || scheduled.length === 0) return () => {};
  const started = ctx.currentTime + 0.05;   // a moment to start them all on time
  const sources: AudioBufferSourceNode[] = [];
  let stopped = false;
  for (const { clip, delay, offset } of scheduled) {
    void soundBuffer(clip.sound).then((buffer) => {
      if (stopped || !buffer) return;
      // Rendered late (the first time it's used): start where it would be by now.
      const late = Math.max(0, ctx.currentTime - (started + delay));
      sources.push(play(ctx, buffer, Math.max(ctx.currentTime, started + delay), offset + late, clip.volume, ctx.destination, endsIn === undefined ? undefined : started + endsIn));
    });
  }
  return () => {
    stopped = true;
    for (const source of sources) { try { source.stop(); } catch { /* already ended */ } }
  };
}

// The whole sound row mixed into one buffer for a video: `seconds` long (the animation's length),
// stereo, at `sampleRate`. null when there's nothing to hear, so the video has no sound track.
export async function mixSounds(clips: readonly SoundClip[], fps: number, totalTicks: number, sampleRate = 48000): Promise<AudioBuffer | null> {
  const scheduled = soundsFrom(clips, 0, totalTicks, fps, (clip) => soundSeconds(clip.sound));
  if (scheduled.length === 0 || typeof OfflineAudioContext === "undefined") return null;
  const seconds = totalTicks / fps;
  const offline = new OfflineAudioContext(2, Math.max(1, Math.round(seconds * sampleRate)), sampleRate);
  const buffers = await Promise.all(scheduled.map(({ clip }) => soundBuffer(clip.sound)));
  scheduled.forEach(({ clip, delay }, i) => { const buffer = buffers[i]; if (buffer) play(offline, buffer, delay, 0, clip.volume, offline.destination, seconds); });   // fading out at the end
  if (buffers.every((buffer) => !buffer)) return null;
  return offline.startRendering();
}

// How long a sound that runs past the end of the animation takes to fade out, in seconds.
export const END_FADE = 0.5;

// Plays `buffer` from `offset` at `when`. With `end` (on the context's clock: where the animation
// ends), a sound still going then fades out over END_FADE and stops there, instead of being cut
// (music, mostly).
function play(ctx: BaseAudioContext, buffer: AudioBuffer, when: number, offset: number, volume: number, destination: AudioNode, end?: number): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain).connect(destination);
  if (offset >= buffer.duration) return source;
  source.start(when, offset);
  if (end !== undefined && when + (buffer.duration - offset) > end) {
    const fadeFrom = Math.max(when, end - END_FADE);
    gain.gain.setValueAtTime(volume, fadeFrom);
    gain.gain.linearRampToValueAtTime(0, end);
    source.stop(end);
  }
  return source;
}
