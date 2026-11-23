import { describe, expect, it } from "vitest";
import { SHUTTER, SOUND_LIBRARY, notesLength, soundSeconds } from "@/core/sound";
import { createSoundClip } from "@/core/model";
import { mixSounds, playNotes, scheduleNotes, soundBuffer } from "@/adapters/sound/sound";

// The sounds, rendered offline in Chromium: they really make sound, stop when they should, and
// land at the right time in a video's mix.

const RATE = 22050;

const loudest = (samples: Float32Array, rate: number, from: number, to: number) => {
  let peak = 0;
  for (let i = Math.floor(from * rate); i < Math.min(samples.length, to * rate); i++) peak = Math.max(peak, Math.abs(samples[i]));
  return peak;
};

describe("sounds", () => {
  it("the shutter is heard, then silent once it ends", async () => {
    const audio = new OfflineAudioContext(1, RATE, RATE);   // one second
    scheduleNotes(audio, SHUTTER, 0);
    const samples = (await audio.startRendering()).getChannelData(0);
    const end = notesLength(SHUTTER);
    expect(loudest(samples, RATE, 0, end)).toBeGreaterThan(0.05);
    expect(loudest(samples, RATE, end + 0.02, 1)).toBe(0);
  });

  it("playing never throws, even before the page was pressed", () => {
    expect(() => playNotes(SHUTTER)).not.toThrow();
  });

  it("every library sound, made or recorded, loads as audio as long as it says, and is heard", async () => {
    for (const entry of SOUND_LIBRARY) {
      const buffer = await soundBuffer(entry.id);
      expect(buffer, entry.id).not.toBeNull();
      if ("file" in entry) expect(Math.abs(buffer!.duration - entry.seconds), entry.id).toBeLessThan(0.1);   // the length the timeline uses is the file's
      else expect(buffer!.duration, entry.id).toBeGreaterThanOrEqual(soundSeconds(entry.id));
      expect(loudest(buffer!.getChannelData(0), buffer!.sampleRate, 0, buffer!.duration), entry.id).toBeGreaterThan(0.02);
    }
    expect(await soundBuffer("from/a-newer-studio")).toBeNull();
  });

  it("mixes the sound row for a video: each sound at its time, at its volume, as long as the animation", async () => {
    // 8 fps, 16 ticks = 2 s. A pop at tick 8 (1 s); a loud one at tick 12 (1.5 s); one past the end.
    const pop = createSoundClip("cartoon/pop", 8);
    const loud = { ...createSoundClip("cartoon/pop", 12), volume: 1.5 };
    const late = createSoundClip("cartoon/pop", 20);
    const mix = await mixSounds([pop, loud, late], 8, 16, RATE);
    expect(mix).not.toBeNull();
    expect(mix!.duration).toBeCloseTo(2, 2);
    const samples = mix!.getChannelData(0);
    expect(loudest(samples, RATE, 0, 0.98)).toBe(0);              // silent until the first
    const first = loudest(samples, RATE, 1, 1.1);
    const second = loudest(samples, RATE, 1.5, 1.6);
    expect(first).toBeGreaterThan(0.05);
    expect(second).toBeGreaterThan(first * 1.3);                    // louder
    expect(await mixSounds([late], 8, 16, RATE)).toBeNull();         // nothing in the animation's time
  });

  it("fades out music still playing where the animation ends, instead of cutting it", async () => {
    // A 30 s tune in a 3 s animation (24 ticks at 8 per second): full until 2.5 s, then fading to nothing.
    const mix = await mixSounds([createSoundClip("background/ukulele", 0)], 8, 24, RATE);
    const samples = mix!.getChannelData(0);
    const steady = loudest(samples, RATE, 1, 2.4);
    expect(steady).toBeGreaterThan(0.05);
    expect(loudest(samples, RATE, 2.95, 3)).toBeLessThan(steady * 0.25);   // nearly silent by the end
  });
});
