import { describe, expect, it } from "vitest";
import { cleanSoundClip, clipTicks, createSoundClip, moveSoundClip, resizeSoundClip, sameSounds, soundLanes, soundTicks, soundsFrom, soundsOf, withSoundClip, type SoundClip } from ".";

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
      { clip: all[1], delay: 0, offset: 0.5, duration: 0.5 },
      { clip: all[0], delay: 1, offset: 0, duration: 1 },
    ]);
    expect(soundsFrom(all, 0, 32, 8, seconds).map((s) => s.clip.id)).toEqual(["done", "going", "late"]);
  });

  // A clip's own length (resized on the timeline): in ticks, like an overlay's. Without one it lasts
  // as long as its sound.
  it("keeps a length of whole ticks, at least one, when it has one", () => {
    expect(cleanSoundClip({ ...clip("a", 0), length: 4.6 }).length).toBe(5);
    expect(cleanSoundClip({ ...clip("a", 0), length: 0 }).length).toBe(1);
    expect("length" in cleanSoundClip({ ...clip("a", 0), length: Number.NaN })).toBe(false);
    expect("length" in cleanSoundClip(clip("a", 0))).toBe(false);
  });

  it("lasts its own length if it has one, otherwise its sound's", () => {
    expect(clipTicks(clip("a", 0), 8, 1)).toBe(8);   // a 1 s sound at 8 fps
    expect(clipTicks({ ...clip("a", 0), length: 3 }, 8, 1)).toBe(3);
  });

  it("resizes from either end: the end changes its length, the start moves it and keeps its end", () => {
    const boing = clip("a", 4);   // its sound lasts 8 ticks
    expect(resizeSoundClip(boing, "end", -3, 8)).toMatchObject({ start: 4, length: 5 });
    expect(resizeSoundClip(boing, "end", 6, 8)).toMatchObject({ start: 4, length: 14 });   // longer than the sound: it starts again
    expect(resizeSoundClip(boing, "start", 2, 8)).toMatchObject({ start: 6, length: 6 });
    expect(resizeSoundClip(boing, "start", -10, 8)).toMatchObject({ start: 0, length: 12 });   // not before the animation's start
    expect(resizeSoundClip(boing, "end", -20, 8).length).toBe(1);
    expect(resizeSoundClip(boing, "start", 20, 8)).toMatchObject({ start: 11, length: 1 });
  });

  it("plays only its own length: cut short, a sound stops there; made longer, it goes on", () => {
    const seconds = () => 1;
    const cut = { ...clip("cut", 0), length: 4 };    // half a second of a 1 s sound, at 8 fps
    const long = { ...clip("long", 0), length: 20 }; // 2.5 s
    expect(soundsFrom([cut, long], 2, 32, 8, seconds)).toEqual([
      { clip: cut, delay: 0, offset: 0.25, duration: 0.25 },
      { clip: long, delay: 0, offset: 0.25, duration: 2.25 },
    ]);
    expect(soundsFrom([cut], 4, 32, 8, seconds)).toEqual([]);   // over at 0.5 s, though its sound goes on
  });
});
