import { describe, expect, it } from "vitest";
import { SHUTTER, notesLength } from "./sounds";

describe("the shutter sound", () => {
  it("is short (a fraction of a second) and audible, never loud", () => {
    expect(notesLength(SHUTTER)).toBeGreaterThan(0);
    expect(notesLength(SHUTTER)).toBeLessThan(0.3);
    for (const note of SHUTTER) {
      expect(note.frequency).toBeGreaterThanOrEqual(100);
      expect(note.frequency).toBeLessThanOrEqual(4000);
      expect(note.volume).toBeGreaterThan(0);
      expect(note.volume).toBeLessThanOrEqual(0.5);
    }
  });

  it("measures how long notes last", () => {
    expect(notesLength([])).toBe(0);
    expect(notesLength([{ frequency: 440, start: 0.2, duration: 0.3, wave: "sine", volume: 0.1 }])).toBeCloseTo(0.5);
  });
});
