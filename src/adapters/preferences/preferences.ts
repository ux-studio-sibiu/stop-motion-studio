// Small per-device settings: how this child likes the studio set up on this computer (which
// camera, how far the timeline is zoomed). They're not part of any animation, so they live in
// localStorage, not in the projects database, and are never exported or backed up.
//
// localStorage can be missing (server rendering) or throw (blocked storage, private modes),
// so every read falls back to "not set" and every save is best effort.

export const PREFERENCES = {
  cameraDevice: "stop-motion-studio:camera",
  cameraOff: "stop-motion-studio:camera-off",   // "1" once the child turned the camera off
  timelineZoom: "stop-motion-studio:timeline-zoom",
  onionSkin: "stop-motion-studio:onion-skin",   // JSON: { on, opacity, count }
} as const;

export type PreferenceKey = (typeof PREFERENCES)[keyof typeof PREFERENCES] | `stop-motion-studio:view:${string}`;

// How one animation's timeline was last looked at: its zoom (px per second) and the time at the
// left edge of the view, in seconds (not pixels, so it lands on the same moment at any zoom).
export type TimelineView = { zoom: number; scrollSeconds: number };

export function timelineViewKey(projectId: string): PreferenceKey {
  return `stop-motion-studio:view:${projectId}`;
}

export function readTimelineView(projectId: string, storage = browserStorage()): TimelineView | undefined {
  const text = readText(timelineViewKey(projectId), storage);
  if (!text) return undefined;
  try {
    const { zoom, scrollSeconds } = JSON.parse(text) as Partial<TimelineView>;
    if (typeof zoom !== "number" || !Number.isFinite(zoom) || zoom <= 0) return undefined;
    return { zoom, scrollSeconds: typeof scrollSeconds === "number" && Number.isFinite(scrollSeconds) ? Math.max(0, scrollSeconds) : 0 };
  } catch {
    return undefined;   // not JSON: as if never saved
  }
}

// null forgets it (a deleted animation).
export function saveTimelineView(projectId: string, view: TimelineView | null, storage = browserStorage()): void {
  savePreference(timelineViewKey(projectId), view && JSON.stringify(view), storage);
}

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

// A saved object (settings with several values), or undefined if it's missing, not JSON, or not
// an object. The caller still checks the values: storage is the user's, anything can be in it.
export function readJson(key: PreferenceKey, storage = browserStorage()): Record<string, unknown> | undefined {
  const text = readText(key, storage);
  if (!text) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

export function saveJson(key: PreferenceKey, value: object | null, storage = browserStorage()): void {
  savePreference(key, value && JSON.stringify(value), storage);
}

// null or undefined forgets the setting.
export function savePreference(key: PreferenceKey, value: string | number | null | undefined, storage = browserStorage()): void {
  try {
    if (value === null || value === undefined) storage?.removeItem(key);
    else storage?.setItem(key, String(value));
  } catch { /* storage blocked or full: just don't remember */ }
}
