"use client";

import { sameElements, type Element } from "@/core/model";
import { editorStore } from "@/store/useEditor";
import { settleSoon } from "./saveSoon";

// Changing a picture's objects (steps 23-24b), shared by the Objects tab and the Draw tab: show the
// change while it's in progress (the store's elements preview), then save it as one step. The same
// for the overlay track is overlayEditing.ts.

// Saves a picture's objects, from what they were to what they become, as one undoable step (the
// studio's setObjects command).
export type SaveObjects = (frameId: string, from: readonly Element[], to: readonly Element[], label: string) => Promise<boolean>;

// What's saved for a picture's objects (not the preview): where every change starts from.
export function savedObjects(frameId: string): Element[] {
  return editorStore.getState().frames[frameId]?.elements ?? [];
}

// Shows a picture's objects changed, without saving.
export function previewObjects(frameId: string, elements: readonly Element[]): void {
  editorStore.getState().previewElements({ [frameId]: [...elements] });
}

// Saves what's shown for a picture, from what's saved, as one step; nothing if nothing changed.
// A burst still waiting to be saved (typing, nudges) is part of what's shown, so it goes along.
export function commitObjects(frameId: string, save: SaveObjects, label: string): void {
  settleSoon("object");
  const state = editorStore.getState();
  const from = savedObjects(frameId);
  const to = state.elementsPreview[frameId];
  if (!to || sameElements(from, to)) { state.clearElementsPreview([frameId]); return; }
  void save(frameId, from, to, label).then((ok) => { if (!ok) editorStore.getState().clearElementsPreview([frameId]); });
}
