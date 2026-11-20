"use client";

import { useEffect, useSyncExternalStore } from "react";
import { asBoolean, asNumber, asObject, asOneOf, asString, asStringList, asTimelineView, definePreference, definePreferenceFamily, forgetRetired, type Preference } from "@/adapters/preferences/preferences";
import { GIF_QUALITIES, GIF_SIZES } from "@/core/export";
import { selectedOverlayId, type EditorState, type OnionSkin } from "@/store/editorStore";
import { editorStore } from "@/store/useEditor";

// Everything the studio remembers between visits, on this device, in one place. Anything a child
// would expect to find as they left it after a reload belongs here, by default. Moment-to-moment
// state (an open dropdown, the playhead, a drag) doesn't.
//
// To remember something new: add a line here, then use useRememberedState (state of a component)
// or useRememberedStore (a field of the editor store).
export const remembered = {
  cameraDevice: definePreference("camera", asString),                   // which camera
  cameraOff: definePreference("camera-off", asBoolean),                 // the child turned the camera off
  panelTab: definePreference("panel-tab", asString),                    // the side panel's open tab
  loop: definePreference("loop", asBoolean),                            // playback loops
  onionSkin: definePreference("onion-skin", asObject),                  // see-through settings (the store checks the values)
  timelineZoom: definePreference("timeline-zoom", asNumber),            // the zoom a new animation starts at
  timelineView: definePreferenceFamily("view", asTimelineView),         // each animation's zoom and scroll
  selection: definePreferenceFamily("selection", asStringList),         // each animation's selected pictures
  overlaySelection: definePreferenceFamily("overlay-selection", asString),   // each animation's selected bar on the overlay track
  drawTool: definePreference("draw-tool", asString),                   // the Draw tab: pencil or eraser (step 24b)
  drawColour: definePreference("draw-colour", asString),               //   the pencil colour
  drawWidth: definePreference("draw-width", asString),                 //   the pencil width
  gifSize: definePreference("gif-size", asOneOf(GIF_SIZES)),                     // Save as GIF: small, medium or full size (step 25)
  gifQuality: definePreference("gif-quality", asOneOf(GIF_QUALITIES)),               //   and low, medium or high quality
  captureSound: definePreference("capture-sound", asBoolean),          // the shutter click when a picture is taken (step 29)
  timelineLayers: definePreference("timeline-layers", asTimelineLayers),   // which of the timeline's extra rows show (objects in time, sounds)
};

// The timeline's extra rows under the pictures, each shown or hidden from the timeline's Layers
// button. Both show at first; a missing one counts as shown.
export type TimelineLayers = { objects: boolean; sounds: boolean };
export const ALL_LAYERS: TimelineLayers = { objects: true, sounds: true };
function asTimelineLayers(raw: unknown): TimelineLayers | undefined {
  const value = asObject(raw);
  return value && { objects: value.objects !== false, sounds: value.sounds !== false };
}

// Settings the studio used to remember and no longer does, cleared once when it opens:
//   stage-view  each animation's stage zoom and pan (the view zoom was removed after step 28)
const RETIRED = ["stage-view"];

// Forgets everything remembered about one animation, when it's deleted: every per-animation entry
// above (each preference family), so one added later is forgotten too without another line.
export function forgetAnimation(id: string): void {
  for (const entry of Object.values(remembered)) if (typeof entry === "function") entry(id).save(null);
}

// Remembered values as an external store for React (useSyncExternalStore): read once per key and
// kept, until this tab saves a new one.
const listeners = new Set<() => void>();
const cache = new Map<string, { value: unknown }>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function current<T>(preference: Preference<T>): T | undefined {
  if (!cache.has(preference.key)) cache.set(preference.key, { value: preference.read() });
  return cache.get(preference.key)!.value as T | undefined;
}

// Like useState, but the value comes back after a reload. `valid` can refuse a remembered value
// that no longer makes sense (a tab that was removed); the fallback is used then. The server
// render (no storage) and the first browser render use the fallback, then the remembered value.
export function useRememberedState<T>(preference: Preference<T>, fallback: T, valid: (value: T) => boolean = () => true) {
  const saved = useSyncExternalStore(subscribe, () => current(preference), () => undefined);
  const value = saved !== undefined && valid(saved) ? saved : fallback;
  const set = (next: T) => saveRemembered(preference, next);
  return [value, set] as const;
}

// Saves a remembered value from outside a component (adding a sound turns its timeline row on);
// every useRememberedState of it updates.
export function saveRemembered<T>(preference: Preference<T>, value: T): void {
  preference.save(value);
  cache.delete(preference.key);
  listeners.forEach((listener) => listener());
}

// Keeps a field of the editor store remembered: restores it once when the studio opens, saves it
// whenever it changes. `apply` puts a remembered value back (through the store's own setter, which
// keeps it in range).
export function useRememberedStore<T>(preference: Preference<T>, pick: (state: EditorState) => T, apply: (value: T) => void) {
  useEffect(() => {
    const saved = preference.read();
    if (saved !== undefined) apply(saved);
    return editorStore.subscribe((state, previous) => {
      const value = pick(state);
      if (value !== pick(previous)) preference.save(value);
    });
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps -- set up once per studio
}

// The selected pictures of each animation, or its selected overlay bar (step 24): restored the first
// time an animation's pictures are there (the ones that still exist), saved whenever they change.
export function useRememberedSelection() {
  useEffect(() => {
    let restoredFor: string | undefined;
    return editorStore.subscribe((state, previous) => {
      const id = state.project?.id;
      if (!id) return;
      if (restoredFor !== id && Object.keys(state.frames).length > 0) {
        restoredFor = id;
        const saved = remembered.selection(id).read();
        if (saved?.length && state.selection.length === 0) state.select(saved);   // select() drops pictures that are gone
        const overlay = remembered.overlaySelection(id).read();
        if (overlay) editorStore.getState().selectOverlay(overlay);               // nothing if it's gone
        return;
      }
      if (restoredFor !== id) return;
      if (state.selection !== previous.selection) remembered.selection(id).save(state.selection.length ? [...state.selection] : null);
      const overlay = selectedOverlayId(state);
      if (overlay !== selectedOverlayId(previous)) remembered.overlaySelection(id).save(overlay);
    });
  }, []);
}

// The studio's remembered store fields, set up once by the studio: see-through, loop, the open
// side-panel tab, and each animation's selection.
export function useRememberedStudio() {
  useEffect(() => forgetRetired(RETIRED), []);
  useRememberedStore(remembered.onionSkin, (state) => state.onionSkin, (value) => editorStore.getState().setOnionSkin(value as Partial<OnionSkin>));
  useRememberedStore(remembered.loop, (state) => state.loop, (value) => editorStore.getState().setLoop(value));
  useRememberedStore(remembered.panelTab, (state) => state.panelTab ?? "", (value) => editorStore.getState().setPanelTab(value));
  useRememberedSelection();
}

