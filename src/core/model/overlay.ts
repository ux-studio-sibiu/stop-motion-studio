import { cloneElements, type Element } from "./element";
import { newId } from "./ids";
import { timeLanes } from "./lanes";
import type { Project } from "./types";

// Overlays (step 24): objects that live in time instead of on a picture, on the timeline's second
// track. One shows from tick `start` for `length` ticks, whatever pictures are there then:
// moving, resizing or deleting pictures doesn't move it, and changing the speed keeps it over the
// same pictures (ticks, like a picture's hold; PLAN.md §3). `element` is an ordinary object (a
// speech bubble, text, a shape), drawn and edited on the stage like one on a picture.
// `track` is always 1 for now; more tracks are a number away.
export type Overlay = { id: string; track: number; start: number; length: number; element: Element };

export function createOverlay(element: Element, start: number, length: number): Overlay {
  return cleanOverlay({ id: newId(), track: 1, start, length, element });
}

// Whole ticks, never before the start, at least one tick long.
export function cleanOverlay(overlay: Overlay): Overlay {
  const start = Number.isFinite(overlay.start) ? Math.max(0, Math.round(overlay.start)) : 0;
  const length = Number.isFinite(overlay.length) ? Math.max(1, Math.round(overlay.length)) : 1;
  return { ...overlay, track: 1, start, length };
}

// A project's overlays, whatever is stored: none for projects from before step 24, and anything
// that isn't an overlay left out.
export function overlaysOf(project: Pick<Project, "overlays"> | null | undefined): Overlay[] {
  const stored: unknown = project?.overlays;
  if (!Array.isArray(stored)) return [];
  return stored.filter((item): item is Overlay => typeof item?.id === "string" && typeof item?.element?.kind === "string" && typeof item?.element?.box === "object").map(cleanOverlay);
}

export function overlayEnd(overlay: Pick<Overlay, "start" | "length">): number {
  return overlay.start + overlay.length;
}

// The overlays showing at `tick`, bottom first: stacked by start (a later one on top), then in
// the order they were added. What playback and export draw.
export function activeOverlays(overlays: readonly Overlay[], tick: number): Overlay[] {
  return overlaysDuring(overlays, tick, tick + 1);
}

// The overlays showing at any moment from tick `start` up to `end`, stacked the same way: what a
// picture shows when it's looked at on its own (the stage when not playing), so an overlay that
// starts or ends partway through it is there to see and edit.
export function overlaysDuring(overlays: readonly Overlay[], start: number, end: number): Overlay[] {
  return overlays.map((overlay, index) => ({ overlay, index })).filter(({ overlay }) => overlay.start < end && start < overlayEnd(overlay)).sort((a, b) => a.overlay.start - b.overlay.start || a.index - b.index).map(({ overlay }) => overlay);
}

// Moved along in time by whole ticks, never before the start.
export function moveOverlay(overlay: Overlay, ticks: number): Overlay {
  return cleanOverlay({ ...overlay, start: overlay.start + Math.round(ticks) });
}

// One edge dragged by whole ticks: the start edge changes when it begins (its end stays), the end
// edge how long it lasts. Never shorter than a tick, never before the start of the animation.
export function resizeOverlay(overlay: Overlay, edge: "start" | "end", ticks: number): Overlay {
  const delta = Math.round(ticks);
  if (edge === "end") return cleanOverlay({ ...overlay, length: Math.max(1, overlay.length + delta) });
  const end = overlayEnd(overlay);
  const start = Math.min(end - 1, Math.max(0, overlay.start + delta));
  return cleanOverlay({ ...overlay, start, length: end - start });
}

// Rows to draw the track in, so overlapping overlays don't hide each other (timeLanes; they're
// still one track). By id.
export function overlayLanes(overlays: readonly Overlay[]): Record<string, number> {
  return timeLanes(overlays.map((overlay) => ({ id: overlay.id, start: overlay.start, end: overlayEnd(overlay) })));
}

// A copy that starts where the original ends, so it follows it on the track without hiding it (a
// title that carries on). Its own id, and its object its own id too.
export function duplicateOverlay(overlay: Overlay): Overlay {
  const [element] = cloneElements([overlay.element]);
  return cleanOverlay({ ...overlay, id: newId(), start: overlayEnd(overlay), element: { ...element, id: newId() } });
}

// With one overlay replaced (by id) or removed (`null`).
export function withOverlay(overlays: readonly Overlay[], id: string, next: Overlay | null): Overlay[] {
  return overlays.flatMap((overlay) => (overlay.id !== id ? [overlay] : next ? [next] : []));
}

export function cloneOverlays(overlays: readonly Overlay[]): Overlay[] {
  return overlays.map((overlay) => ({ ...overlay, element: cloneElements([overlay.element])[0] }));
}

export function sameOverlays(a: readonly Overlay[], b: readonly Overlay[]): boolean {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b);
}
