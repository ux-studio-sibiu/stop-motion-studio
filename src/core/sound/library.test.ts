import { describe, expect, it } from "vitest";
import { MADE_SOUNDS, RECORDED_SOUNDS, SOUND_CATEGORIES, SOUND_LIBRARY, notesLength, soundById, soundSeconds } from ".";

describe("the sound library", () => {
  it("has unique ids named after their category, unique names, and every category has sounds", () => {
    const ids = SOUND_LIBRARY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = SOUND_LIBRARY.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);   // a child can tell them apart in the tab
    for (const entry of SOUND_LIBRARY) expect(entry.id.startsWith(`${entry.category.toLowerCase()}/`)).toBe(true);
    for (const category of SOUND_CATEGORIES) expect(SOUND_LIBRARY.some((entry) => entry.category === category), category).toBe(true);
  });

  it("has short, audible made sounds that are never loud", () => {
    for (const entry of MADE_SOUNDS) {
      if (!("notes" in entry)) throw new Error(`${entry.id} has no notes`);
      expect(notesLength(entry.notes), entry.id).toBeGreaterThan(0);
      expect(notesLength(entry.notes), entry.id).toBeLessThanOrEqual(1.5);
      for (const note of entry.notes) {
        expect(note.volume, entry.id).toBeGreaterThan(0);
        expect(note.volume, entry.id).toBeLessThanOrEqual(0.5);
        expect(note.frequency, entry.id).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it("has recorded sounds of at most 25 s, each its own file", () => {
    expect(RECORDED_SOUNDS.length).toBeGreaterThanOrEqual(50);
    const files = RECORDED_SOUNDS.map((entry) => entry.file);
    expect(new Set(files).size).toBe(files.length);
    for (const entry of RECORDED_SOUNDS) {
      expect(entry.file, entry.id).toMatch(/^bsb-\d+\.ogg$/);
      expect(entry.seconds, entry.id).toBeGreaterThan(0);
      expect(entry.seconds, entry.id).toBeLessThanOrEqual(25);
    }
  });

  it("finds a sound by id and knows how long it lasts; an unknown one lasts a second", () => {
    expect(soundById("cartoon/boing")?.name).toBe("Boing");
    expect(soundById("nope")).toBeUndefined();
    expect(soundSeconds("cartoon/boing")).toBeCloseTo(0.7);
    expect(soundSeconds("animals/cat-meow")).toBeCloseTo(2.37);   // a recorded one: its file's length
    expect(soundSeconds("from/a-newer-studio")).toBe(1);
  });
});
