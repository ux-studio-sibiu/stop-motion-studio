"use client";

import { useEffect, useLayoutEffect } from "react";
import { PREFERENCES, readNumber, savePreference } from "@/adapters/preferences/preferences";
import { editorStore } from "@/store/useEditor";

// Remembers how far the timeline is zoomed, on this device, across reloads and projects.
// Zoom is a way of looking, not part of an animation, so it's a preference, not project data.
// The store stays storage-free: this hook restores the saved zoom once, before the first paint
// (so the timeline doesn't jump), then saves every change. The store clamps a stored value
// that's out of range.
export function useZoomPreference() {
  useLayoutEffect(() => {
    const saved = readNumber(PREFERENCES.timelineZoom);
    if (saved !== undefined) editorStore.getState().setTimelineZoom(saved);
  }, []);

  useEffect(() => editorStore.subscribe((state, previous) => {
    if (state.timelineZoom !== previous.timelineZoom) savePreference(PREFERENCES.timelineZoom, state.timelineZoom);
  }), []);
}
