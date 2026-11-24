"use client";

import { useEffect, useSyncExternalStore } from "react";
import { asBoolean, asNumber, asObject, asOneOf, asString, asStringList, asTimelineView, definePreference, definePreferenceFamily, forgetRetired, type Preference } from "@/adapters/preferences/preferences";
import { GIF_QUALITIES, GIF_SIZES } from "@/core/export";
import { clampFraming, type Framing } from "@/core/render";
import { DEFAULT_LOOP, DEFAULT_ONION_SKIN, selectedOverlayId, type EditorState, type OnionSkin } from "@/store/editorStore";
import { editorStore } from "@/store/useEditor";

// Everything the studio remembers between visits, on this device, in one place. Anything a child
// would expect to find as they left it after a reload belongs here, by default. Moment-to-moment
// state (an open dropdown, the playhead, a drag) doesn't.
//
// To remember something new: add a line here, then use useRememberedState (state of a component)
// or useRememberedStore (a field of the editor store).
// Two kinds: the computer's and the child's own (the camera, the capture sound, the pencil in
// hand), one for all animations (definePreference); and each animation's own, how it was left
// (definePreferenceFamily, by its id): its tab, its playback and see-through, its timeline, its
// GIF settings. A new animation starts with each of those at its default.
export const remembered = {
  cameraDevice: definePreference("camera", asString),                   // which camera
  cameraOff: definePreference("camera-off", asBoolean),                 // the child turned the camera off
  panelTab: definePreferenceFamily("panel-tab", asString),              // each animation's open side-panel tab
  loop: definePreferenceFamily("loop", asBoolean),                      // each animation's playback loops, or not
  onionSkin: definePreferenceFamily("onion-skin", asObject),            // each animation's see-through settings (the store checks the values)
  timelineZoom: definePreference("timeline-zoom", asNumber),            // the zoom a new animation starts at
  timelineView: definePreferenceFamily("view", asTimelineView),         // each animation's zoom and scroll
  selection: definePreferenceFamily("selection", asStringList),         // each animation's selected pictures
  overlaySelection: definePreferenceFamily("overlay-selection", asString),   // each animation's selected bar on the overlay track
  drawTool: definePreference("draw-tool", asString),                   // the Draw tab: pencil or eraser (step 24b)
  drawColour: definePreference("draw-colour", asString),               //   the pencil colour
  drawWidth: definePreference("draw-width", asString),                 //   the pencil width
  gifSize: definePreferenceFamily("gif-size", asOneOf(GIF_SIZES)),               // each animation's GIF: small, medium or full size (step 25)
  gifQuality: definePreferenceFamily("gif-quality", asOneOf(GIF_QUALITIES)),      //   and low, medium or high quality
  captureSound: definePreference("capture-sound", asBoolean),          // the shutter click when a picture is taken (step 29)
  timelineLayers: definePreferenceFamily("timeline-layers", asTimelineLayers),   // each animation's timeline: which extra rows show (objects in time, sounds), and the ruler's gradations
  cameraFraming: definePreferenceFamily("camera-framing", asFraming),  // each animation's camera zoom and where it's framed, so every picture matches
  cameraLock: definePreference("camera-lock", asBoolean),              // the camera's focus, exposure and white balance locked
};

// A remembered camera framing, its values put back in range.
function asFraming(raw: unknown): Framing | undefined {
  const value = asObject(raw);
  return value && clampFraming({ zoom: Number(value.zoom), x: Number(value.x), y: Number(value.y) });
}

// The timeline's extra rows under the pictures, each shown or hidden from the timeline's Layers
// button. Both show at first; a missing one counts as shown.
// And the ruler's gradations (its second marks and times), hidden at first.
export type TimelineLayers = { objects: boolean; sounds: boolean; ruler: boolean };
export const DEFAULT_LAYERS: TimelineLayers = { objects: true, sounds: true, ruler: false };
function asTimelineLayers(raw: unknown): TimelineLayers | undefined {
  const value = asObject(raw);
  return value && { objects: value.objects !== false, sounds: value.sounds !== false, ruler: value.ruler === true };
}

// Settings the studio used to remember and no longer does, cleared once when it opens:
//   stage-view  each animation's stage zoom and pan (the view zoom was removed after step 28)
//   home-decor  the home page's cut-outs as arranged in its Decorate panel (both removed)
const RETIRED = ["stage-view", "home-decor"];
// One for all animations until they became each animation's own: the old single values, cleared by
// their exact name (forgetRetired would take the animations' own entries, name:id, with them).
const RETIRED_GLOBALS = ["panel-tab", "loop", "onion-skin", "gif-size", "gif-quality", "timeline-layers"];

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
// null: nothing to remember it by (no animation open yet, the design page): the fallback, not kept.
export function useRememberedState<T>(preference: Preference<T> | null, fallback: T, valid: (value: T) => boolean = () => true) {
  const saved = useSyncExternalStore(subscribe, () => (preference ? current(preference) : undefined), () => undefined);
  const value = saved !== undefined && valid(saved) ? saved : fallback;
  const set = (next: T) => { if (preference) saveRemembered(preference, next); };
  return [value, set] as const;
}

// Saves a remembered value from outside a component (adding a sound turns its timeline row on);
// every useRememberedState of it updates.
export function saveRemembered<T>(preference: Preference<T>, value: T): void {
  preference.save(value);
  cache.delete(preference.key);
  listeners.forEach((listener) => listener());
}

// Keeps a field of the editor store remembered for each animation: when an animation opens, its
// own value is put back, and saved under it whenever it changes. `apply` puts a remembered value
// back through the store's own setter (which keeps it in range), or the default with undefined: an
// animation that never changed it (a new one).
export function useRememberedStore<T>(family: (id: string) => Preference<T>, pick: (state: EditorState) => T | null, apply: (value: T | undefined) => void) {
  useEffect(() => {
    let openFor: string | undefined;
    let restoring = false;
    const follow = (state: EditorState, previous: EditorState) => {
      const id = state.project?.id;
      if (!id) { openFor = undefined; return; }
      if (id !== openFor) {   // another animation: its own value (putting it back isn't a change to save)
        openFor = id;
        restoring = true;
        try { apply(family(id).read()); } finally { restoring = false; }
        return;
      }
      if (!restoring && pick(state) !== pick(previous)) family(id).save(pick(state));
    };
    follow(editorStore.getState(), editorStore.getState());   // one already open
    return editorStore.subscribe(follow);
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

// The studio's remembered store fields, set up once by the studio, each animation's own: its
// see-through, loop, open side-panel tab, and selection.
export function useRememberedStudio() {
  useEffect(() => {
    forgetRetired(RETIRED);
    for (const name of RETIRED_GLOBALS) definePreference(name, asString).save(null);
  }, []);
  useRememberedStore(remembered.onionSkin, (state) => state.onionSkin, (value) => editorStore.getState().setOnionSkin((value as Partial<OnionSkin> | undefined) ?? DEFAULT_ONION_SKIN));
  useRememberedStore(remembered.loop, (state) => state.loop, (value) => editorStore.getState().setLoop(value ?? DEFAULT_LOOP));
  useRememberedStore(remembered.panelTab, (state) => state.panelTab, (value) => editorStore.getState().setPanelTab(value ?? null));   // none: the first tab, Camera
  useRememberedSelection();
}

