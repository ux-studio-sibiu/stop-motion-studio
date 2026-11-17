"use client";

import { bubbleProps, sameElements, SPEECH_BUBBLE, type Element, type Frame } from "@/core/model";
import { editorStore, useEditor, useShownFrames } from "@/store/useEditor";
import { settleSoon } from "@/studio/saveSoon";
import { shownIndex } from "@/studio/StagePicture";

// What the Objects tab and the stage layer share: the picture being edited, and how a change to
// its objects is shown and then saved.

// Saves a picture's objects, from what they were to what they become, as one undoable step (the
// studio's setObjects command).
export type SaveObjects = (frameId: string, from: readonly Element[], to: readonly Element[], label: string) => Promise<boolean>;

// The picture whose objects are being edited: the one on the stage (the rightmost selected, or the
// last), with any change not saved yet.
export function useObjectFrame(): Frame | undefined {
  const frames = useShownFrames();
  const selection = useEditor((state) => state.selection);
  return frames[shownIndex(frames.map((frame) => frame.id), selection)];
}

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

// One object changed: shown, then saved as one step.
export function changeObject(frameId: string, shown: readonly Element[], next: Element, save: SaveObjects, label: string): void {
  previewObjects(frameId, shown.map((item) => (item.id === next.id ? next : item)));
  commitObjects(frameId, save, label);
}

// What an object is called in undo labels and buttons.
export function labelOf(element: Pick<Element, "kind" | "props">): string {
  if (element.kind !== SPEECH_BUBBLE) return "object";
  return { speech: "speech bubble", thought: "thought bubble", spiked: "spiked bubble" }[bubbleProps(element).variant];
}

// Puts the keyboard in the picked object's text box in the Objects tab (Enter or a double-click on
// the stage, or a new bubble). A new bubble's box isn't there yet: it takes the keyboard when it
// appears (takeTextFocus).
let textFocusWanted = false;
export function focusObjectText(): void {
  const box = document.querySelector<HTMLTextAreaElement>("[data-object-text]");
  if (box) box.focus();
  else textFocusWanted = true;
}
export function takeTextFocus(): boolean {
  const wanted = textFocusWanted;
  textFocusWanted = false;
  return wanted;
}
