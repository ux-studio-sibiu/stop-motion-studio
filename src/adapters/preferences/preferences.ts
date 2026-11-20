// Remembered UI state: how this child left the studio on this computer (which camera, the zoom,
// the open tab...). Not part of any animation, so it lives in localStorage, not in the projects
// database, and is never exported or backed up. Every setting is a typed Preference, declared in
// one registry (src/studio/remembered.ts).
//
// localStorage can be missing (server rendering) or throw (blocked storage, private modes), and
// anything can be in it, so every read is checked by the preference's own parser and falls back
// to "not set", and every save is best effort.

export type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type Preference<T> = {
  key: string;
  read: (storage?: PreferenceStorage | null) => T | undefined;
  // null forgets it.
  save: (value: T | null, storage?: PreferenceStorage | null) => void;
};

export const PREFIX = "stop-motion-studio:";

function browserStorage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

// One remembered setting. Saved as JSON; read back through `parse`, which says what's valid. Text
// that isn't JSON (settings saved before step 18) is handed to `parse` as a plain string.
export function definePreference<T>(name: string, parse: (raw: unknown) => T | undefined): Preference<T> {
  const key = PREFIX + name;
  return {
    key,
    read: (storage = browserStorage()) => {
      let text: string | null | undefined;
      try { text = storage?.getItem(key); } catch { return undefined; }
      if (text === null || text === undefined || text === "") return undefined;
      let raw: unknown;
      try { raw = JSON.parse(text); } catch { raw = text; }
      return parse(raw);
    },
    save: (value, storage = browserStorage()) => {
      try {
        if (value === null || value === undefined) storage?.removeItem(key);
        else storage?.setItem(key, JSON.stringify(value));
      } catch { /* storage blocked or full: just don't remember */ }
    },
  };
}

// Forgets every setting under names the studio no longer uses (a whole family: "stage-view"
// removes "stage-view:<id>" for every animation), so a removed feature leaves nothing behind.
export function forgetRetired(names: readonly string[], storage: (PreferenceStorage & Pick<Storage, "length" | "key">) | null = browserStorage()): void {
  try {
    if (!storage) return;
    const prefixes = names.map((name) => PREFIX + name);
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => key !== null);
    for (const key of keys) if (prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) storage.removeItem(key);
  } catch { /* storage blocked: nothing to forget */ }
}

// The same setting for each animation, one entry per animation id ("view:<id>").
export function definePreferenceFamily<T>(name: string, parse: (raw: unknown) => T | undefined): (id: string) => Preference<T> {
  return (id) => definePreference(`${name}:${id}`, parse);
}

// Parsers for definePreference: the value if it's the right kind, otherwise undefined.
export const asString = (raw: unknown): string | undefined => (typeof raw === "string" && raw !== "" ? raw : typeof raw === "number" ? String(raw) : undefined);
export const asBoolean = (raw: unknown): boolean | undefined => (raw === true || raw === 1 || raw === "1" ? true : raw === false || raw === 0 || raw === "0" ? false : undefined);
export const asNumber = (raw: unknown): number | undefined => (typeof raw === "number" && Number.isFinite(raw) ? raw : undefined);
export const asStringList = (raw: unknown): string[] | undefined => (Array.isArray(raw) && raw.every((item) => typeof item === "string") ? raw : undefined);
// One of a fixed set of names (a size, a quality): typed, so the caller needn't check it again.
export const asOneOf = <T extends string>(options: readonly T[]) => (raw: unknown): T | undefined => (typeof raw === "string" && (options as readonly string[]).includes(raw) ? (raw as T) : undefined);
export const asObject = (raw: unknown): Record<string, unknown> | undefined => (raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined);

// How one animation's timeline was last looked at: its zoom (px per second) and the time at the
// left edge of the view, in seconds (not pixels, so it lands on the same moment at any zoom).
export type TimelineView = { zoom: number; scrollSeconds: number };

export function asTimelineView(raw: unknown): TimelineView | undefined {
  const value = asObject(raw);
  const zoom = asNumber(value?.zoom);
  if (zoom === undefined || zoom <= 0) return undefined;
  return { zoom, scrollSeconds: Math.max(0, asNumber(value?.scrollSeconds) ?? 0) };
}
