import { describe, expect, it } from "vitest";
import { asBoolean, asNumber, asObject, asString, asStringList, asTimelineView, definePreference, definePreferenceFamily, PREFIX, type PreferenceStorage } from "@/adapters/preferences/preferences";

function memoryStorage(): PreferenceStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: (key) => { data.delete(key); } };
}

const broken: PreferenceStorage = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
  removeItem: () => { throw new Error("blocked"); },
};

describe("definePreference", () => {
  it("saves a value and reads it back, and forgets it on null", () => {
    const storage = memoryStorage();
    const tab = definePreference("panel-tab", asString);
    expect(tab.key).toBe(`${PREFIX}panel-tab`);
    tab.save("picture", storage);
    expect(tab.read(storage)).toBe("picture");
    tab.save(null, storage);
    expect(tab.read(storage)).toBeUndefined();
  });

  it("reads anything its parser doesn't accept as not set", () => {
    const storage = memoryStorage();
    const zoom = definePreference("timeline-zoom", asNumber);
    for (const junk of ["", "abc", "[1]", '{"a":1}', "NaN"]) {
      storage.data.set(zoom.key, junk);
      expect(zoom.read(storage), junk).toBeUndefined();
    }
  });

  it("still reads settings saved before as plain text", () => {
    const storage = memoryStorage();
    storage.data.set(`${PREFIX}camera`, "f3a9c1device");   // a camera id, not JSON
    storage.data.set(`${PREFIX}camera-off`, "1");
    storage.data.set(`${PREFIX}timeline-zoom`, "240");
    expect(definePreference("camera", asString).read(storage)).toBe("f3a9c1device");
    expect(definePreference("camera-off", asBoolean).read(storage)).toBe(true);
    expect(definePreference("timeline-zoom", asNumber).read(storage)).toBe(240);
  });

  it("never throws when storage is blocked or missing", () => {
    const pref = definePreference("loop", asBoolean);
    expect(pref.read(broken)).toBeUndefined();
    expect(() => pref.save(true, broken)).not.toThrow();
    expect(pref.read(null)).toBeUndefined();
    expect(() => pref.save(true, null)).not.toThrow();
  });

  it("keeps one entry per animation in a family", () => {
    const storage = memoryStorage();
    const selection = definePreferenceFamily("selection", asStringList);
    selection("p1").save(["a", "b"], storage);
    selection("p2").save(["c"], storage);
    expect(selection("p1").read(storage)).toEqual(["a", "b"]);
    expect(selection("p2").read(storage)).toEqual(["c"]);
    expect(selection("p1").key).toBe(`${PREFIX}selection:p1`);
  });
});

describe("parsers", () => {
  it("accept only their kind of value", () => {
    expect([asString("x"), asString(""), asString(5), asString(true)]).toEqual(["x", undefined, "5", undefined]);
    expect([asBoolean(true), asBoolean(0), asBoolean("1"), asBoolean("yes")]).toEqual([true, false, true, undefined]);
    expect([asNumber(2.5), asNumber("2"), asNumber(Number.POSITIVE_INFINITY)]).toEqual([2.5, undefined, undefined]);
    expect([asStringList(["a"]), asStringList(["a", 1]), asStringList("a")]).toEqual([["a"], undefined, undefined]);
    expect([asObject({ a: 1 }), asObject([1]), asObject(null)]).toEqual([{ a: 1 }, undefined, undefined]);
  });

  it("read a timeline view, defaulting the scroll and refusing a bad zoom", () => {
    expect(asTimelineView({ zoom: 360, scrollSeconds: 4.5 })).toEqual({ zoom: 360, scrollSeconds: 4.5 });
    expect(asTimelineView({ zoom: 200 })).toEqual({ zoom: 200, scrollSeconds: 0 });
    expect(asTimelineView({ zoom: 200, scrollSeconds: -3 })).toEqual({ zoom: 200, scrollSeconds: 0 });
    for (const junk of [null, [], { zoom: "big" }, { zoom: 0 }, { zoom: -5 }]) expect(asTimelineView(junk)).toBeUndefined();
  });
});
