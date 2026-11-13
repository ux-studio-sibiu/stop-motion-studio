// Small per-device settings: how this child likes the studio set up on this computer (which
// camera, how far the timeline is zoomed). They're not part of any animation, so they live in
// localStorage, not in the projects database, and are never exported or backed up.
//
// localStorage can be missing (server rendering) or throw (blocked storage, private modes),
// so every read falls back to "not set" and every save is best effort.

export const PREFERENCES = {
  cameraDevice: "stop-motion-studio:camera",
  timelineZoom: "stop-motion-studio:timeline-zoom",
} as const;

export type PreferenceKey = (typeof PREFERENCES)[keyof typeof PREFERENCES];

export type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): PreferenceStorage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

export function readText(key: PreferenceKey, storage = browserStorage()): string | undefined {
  try { return storage?.getItem(key) ?? undefined; } catch { return undefined; }
}

// A finite number, or undefined for anything else (missing, empty, "abc", "Infinity").
export function readNumber(key: PreferenceKey, storage = browserStorage()): number | undefined {
  const text = readText(key, storage);
  if (text === undefined || text.trim() === "") return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

// null or undefined forgets the setting.
export function savePreference(key: PreferenceKey, value: string | number | null | undefined, storage = browserStorage()): void {
  try {
    if (value === null || value === undefined) storage?.removeItem(key);
    else storage?.setItem(key, String(value));
  } catch { /* storage blocked or full: just don't remember */ }
}
