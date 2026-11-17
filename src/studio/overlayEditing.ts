"use client";

import { duplicateOverlay, objectLabel, overlaysOf, sameOverlays, withOverlay, type Overlay } from "@/core/model";
import { shownOverlays } from "@/store/editorStore";
import { editorStore } from "@/store/useEditor";
import { settleSoon } from "./saveSoon";

// Changing the overlays (step 24), shared by the timeline's overlay track and the Objects tab: show
// the change while it's in progress (the store's overlaysPreview), then save it as one step.

// Saves the overlay list, from what it was to what it becomes, as one undoable step (the studio's
// setOverlays command).
export type SaveOverlays = (from: readonly Overlay[], to: readonly Overlay[], label: string) => Promise<boolean>;

// What's saved (not the preview): where every change starts from.
export function savedOverlays(): Overlay[] {
  return overlaysOf(editorStore.getState().project);
}

export function previewOverlays(overlays: readonly Overlay[]): void {
  editorStore.getState().previewOverlays(overlays);
}

// Saves what's shown, from what's saved, as one step; nothing if nothing changed. A burst still
// waiting to be saved (typing, nudges) is part of what's shown, so it goes along.
export function commitOverlays(save: SaveOverlays, label: string): void {
  settleSoon("object");
  const state = editorStore.getState();
  const to = state.overlaysPreview;
  const from = savedOverlays();
  if (!to || sameOverlays(from, to)) { state.clearOverlaysPreview(); return; }
  void save(from, to, label).then((ok) => { if (!ok) editorStore.getState().clearOverlaysPreview(); });
}

// What the timeline's toolbar and keys do to the selected overlay: the same code wherever they're
// offered, so trying them in another place is moving a button.

// Deletes an overlay, as one step. The timeline's selection goes back to the pictures.
export function deleteOverlay(overlayId: string, save: SaveOverlays): void {
  const shown = shownOverlays(editorStore.getState());
  const overlay = shown.find((item) => item.id === overlayId);
  if (!overlay) return;
  previewOverlays(withOverlay(shown, overlayId, null));
  commitOverlays(save, `Delete ${objectLabel(overlay.element)}`);
  editorStore.getState().selectElement(null);
}

// Adds an overlay, as one step, and selects it: shown straight away, then saved.
export function addOverlay(overlay: Overlay, save: SaveOverlays, label: string): void {
  previewOverlays([...shownOverlays(editorStore.getState()), overlay]);
  editorStore.getState().selectOverlay(overlay.id);
  commitOverlays(save, label);
}

// Copies an overlay to start where it ends (duplicateOverlay), as one step, and selects the copy.
// Shown (and selected) straight away, then saved, like every other edit.
export function duplicateOverlayById(overlayId: string, save: SaveOverlays): void {
  const shown = shownOverlays(editorStore.getState());
  const overlay = shown.find((item) => item.id === overlayId);
  if (!overlay) return;
  const copy = duplicateOverlay(overlay);
  previewOverlays([...shown, copy]);
  editorStore.getState().selectOverlay(copy.id);
  commitOverlays(save, `Duplicate ${objectLabel(overlay.element)}`);
}

// Picks an overlay on the timeline: the Objects tab shows its settings, the stage the picture where
// it starts (selectOverlay).
export function pickOverlay(overlayId: string): void {
  const state = editorStore.getState();
  state.pause();
  state.setPanelTab("objects");
  state.selectOverlay(overlayId);
}
