import { describe, expect, it } from "vitest";
import { cleanSoundClip, createSoundClip, moveSoundClip, sameSounds, soundLanes, soundTicks, soundsFrom, soundsOf, withSoundClip, type SoundClip } from ".";

const clip = (id: string, start: number, sound = "cartoon/boing", volume = 1): SoundClip => ({ id, start, sound, volume });

describe("sound clips", () => {
  it("reads only real clips from a project, none from older ones", () => {
    expect(soundsOf({})).toEqual([]);
    expect(soundsOf(null)).toEqual([]);
    const good = clip("a", 2);
    expect(soundsOf({ sounds: [good, { id: 3 }, null, { id: "x", sound: "" }] as unknown as SoundClip[] })).toEqual([good]);
  });

  it("keeps whole ticks from the start and a volume that's on offer", () => {
    expect(cleanSoundClip(clip("a", -3.6, "x", 2))).toEqual(clip("a", 0, "x", 1));
    expect(cleanSoundClip(clip("a", 2.4, "x", 0.5))).toEqual(clip("a", 2, "x", 0.5));
    expect(createSoundClip("magic/zap", 5)).toMatchObject({ start: 5, sound: "magic/zap", volume: 1 });
    expect(moveSoundClip(clip("a", 2), -5).start).toBe(0);
  });

  it("covers as many ticks as the sound lasts, at least one", () => {
    expect(soundTicks(0.45, 8)).toBe(4);
    expect(soundTicks(0.5, 8)).toBe(4);
    expect(soundTicks(0.01, 8)).toBe(1);
    expect(soundTicks(0.5, 24)).toBe(12);
  });

  it("replaces, removes and compares", () => {
    const a = clip("a", 0);
    const b = clip("b", 4);
    expect(withSoundClip([a, b], "a", null)).toEqual([b]);
    expect(withSoundClip([a, b], "b", clip("b", 6))).toEqual([a, clip("b", 6)]);
    expect(sameSounds([a], [clip("a", 0)])).toBe(true);
    expect(sameSounds([a], [clip("a", 1)])).toBe(false);
  });

  it("puts overlapping sounds in separate rows", () => {
    const lanes = soundLanes([clip("a", 0), clip("b", 2), clip("c", 4)], () => 4);
    expect(lanes).toEqual({ a: 0, b: 1, c: 0 });
  });

  it("works out what to play from a tick: a sound already going plays from part-way, finished ones and those past the end don't", () => {
    const seconds = () => 1;   // every sound a second long
    const all = [clip("late", 16), clip("going", 4), clip("done", 0), clip("past-end", 40)];
    // From tick 8 at 8 fps (1 s): "done" ended at 1 s; "going" started at 0.5 s; "late" is at 2 s.
    expect(soundsFrom(all, 8, 32, 8, seconds)).toEqual([
      { clip: all[1], delay: 0, offset: 0.5 },
      { clip: all[0], delay: 1, offset: 0 },
    ]);
    expect(soundsFrom(all, 0, 32, 8, seconds).map((s) => s.clip.id)).toEqual(["done", "going", "late"]);
  });
});
