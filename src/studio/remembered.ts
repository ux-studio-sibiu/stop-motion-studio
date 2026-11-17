"use client";

import { useEffect, useSyncExternalStore } from "react";
import { asBoolean, asNumber, asObject, asString, asStringList, asTimelineView, definePreference, definePreferenceFamily, type Preference } from "@/adapters/preferences/preferences";
import type { StageView } from "@/core/render";
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
  stageView: definePreferenceFamily("stage-view", asObject),            // each animation's stage zoom and pan (the store checks)
};

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
  const set = (next: T) => {
    preference.save(next);
    cache.delete(preference.key);
    listeners.forEach((listener) => listener());
  };
  return [value, set] as const;
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
// side-panel tab, and each animation's selection and stage view.
export function useRememberedStudio() {
  useRememberedStore(remembered.onionSkin, (state) => state.onionSkin, (value) => editorStore.getState().setOnionSkin(value as Partial<OnionSkin>));
  useRememberedStore(remembered.loop, (state) => state.loop, (value) => editorStore.getState().setLoop(value));
  useRememberedStore(remembered.panelTab, (state) => state.panelTab ?? "", (value) => editorStore.getState().setPanelTab(value));
  useRememberedSelection();
  useRememberedStageView();
}

// Each animation's stage zoom and pan: restored when it opens, saved (a moment after it stops
// changing) whenever it changes, and straight away if the page is left before that.
export function useRememberedStageView() {
  useEffect(() => {
    let restoredFor: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: (() => void) | undefined;
    const flush = () => { clearTimeout(timer); pending?.(); pending = undefined; };
    const stop = editorStore.subscribe((state, previous) => {
      const id = state.project?.id;
      if (!id) return;
      if (restoredFor !== id) {
        restoredFor = id;
        const saved = remembered.stageView(id).read();
        if (saved) state.setStageView(saved as Partial<StageView>);
        return;
      }
      if (state.stageView === previous.stageView) return;
      clearTimeout(timer);
      const { zoom, x, y } = state.stageView;
      pending = () => remembered.stageView(id).save(zoom === 1 ? null : { zoom, x, y });
      timer = setTimeout(flush, 250);
    });
    window.addEventListener("pagehide", flush);
    return () => { flush(); stop(); window.removeEventListener("pagehide", flush); };
  }, []);
}