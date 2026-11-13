import { describe, expect, it } from "vitest";
import { PREFERENCES, readNumber, readText, readTimelineView, savePreference, saveTimelineView, timelineViewKey, type PreferenceStorage } from "@/adapters/preferences/preferences";

function memoryStorage(): PreferenceStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

const broken: PreferenceStorage = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
  removeItem: () => { throw new Error("blocked"); },
};

describe("preferences", () => {
  it("saves and reads text and numbers", () => {
    const storage = memoryStorage();
    savePreference(PREFERENCES.cameraDevice, "cam-1", storage);
    savePreference(PREFERENCES.timelineZoom, 240, storage);
    expect(readText(PREFERENCES.cameraDevice, storage)).toBe("cam-1");
    expect(readNumber(PREFERENCES.timelineZoom, storage)).toBe(240);
  });

  it("forgets a setting saved as null", () => {
    const storage = memoryStorage();
    savePreference(PREFERENCES.cameraDevice, "cam-1", storage);
    savePreference(PREFERENCES.cameraDevice, null, storage);
    expect(readText(PREFERENCES.cameraDevice, storage)).toBeUndefined();
  });

  it("reads anything that isn't a finite number as not set", () => {
    const storage = memoryStorage();
    for (const junk of ["", "  ", "abc", "Infinity", "NaN"]) {
      storage.data.set(PREFERENCES.timelineZoom, junk);
      expect(readNumber(PREFERENCES.timelineZoom, storage), junk).toBeUndefined();
    }
    expect(readNumber(PREFERENCES.timelineZoom, storage)).toBeUndefined();
  });

  it("keeps each animation's timeline view apart", () => {
    const storage = memoryStorage();
    saveTimelineView("p1", { zoom: 360, scrollSeconds: 4.5 }, storage);
    saveTimelineView("p2", { zoom: 80, scrollSeconds: 0 }, storage);
    expect(readTimelineView("p1", storage)).toEqual({ zoom: 360, scrollSeconds: 4.5 });
    expect(readTimelineView("p2", storage)).toEqual({ zoom: 80, scrollSeconds: 0 });
    expect(readTimelineView("p3", storage)).toBeUndefined();
    saveTimelineView("p1", null, storage);
    expect(readTimelineView("p1", storage)).toBeUndefined();
  });

  it("reads a broken or odd timeline view as not saved, or as the start", () => {
    const storage = memoryStorage();
    for (const junk of ["{", "null", "[]", '{"zoom":"big"}', '{"zoom":0}', '{"zoom":-5}']) {
      storage.data.set(timelineViewKey("p1"), junk);
      expect(readTimelineView("p1", storage), junk).toBeUndefined();
    }
    storage.data.set(timelineViewKey("p1"), '{"zoom":200,"scrollSeconds":-3}');
    expect(readTimelineView("p1", storage)).toEqual({ zoom: 200, scrollSeconds: 0 });
    storage.data.set(timelineViewKey("p1"), '{"zoom":200}');
    expect(readTimelineView("p1", storage)).toEqual({ zoom: 200, scrollSeconds: 0 });
  });

  it("never throws when storage is blocked or missing", () => {
    expect(readTimelineView("p1", broken)).toBeUndefined();
    expect(() => saveTimelineView("p1", { zoom: 1, scrollSeconds: 0 }, broken)).not.toThrow();
    expect(readText(PREFERENCES.cameraDevice, broken)).toBeUndefined();
    expect(() => savePreference(PREFERENCES.timelineZoom, 1, broken)).not.toThrow();
    expect(readNumber(PREFERENCES.timelineZoom, null)).toBeUndefined();   // no localStorage (server rendering)
    expect(() => savePreference(PREFERENCES.timelineZoom, 1, null)).not.toThrow();
  });
});
