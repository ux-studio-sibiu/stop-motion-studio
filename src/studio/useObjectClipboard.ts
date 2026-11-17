"use client";

import { useEffect, useRef } from "react";
import { shownIndex, DRAWING, objectLabel, pasteInto, type Element } from "@/core/model";
import { orderedFrames, shownOverlays, withPreview, type EditorState } from "@/store/editorStore";
import { editorStore } from "@/store/useEditor";
import { isTextEntry } from "./keyboard";
import { savedObjects } from "./pictureObjects";
import { settleSoon } from "./saveSoon";

// Saves several pictures' objects as one undoable step (the studio's setObjectsOf command).
export type SaveObjectsOf = (changes: { frameId: string; from: readonly Element[]; to: readonly Element[] }[], label: string) => Promise<boolean>;

// Copy and paste of objects between pictures (step 24b):
//   Ctrl+C  copies the picked object (Objects tab), or the picture's drawing (Draw tab)
//   Ctrl+V  pastes it, in the same place, onto every selected picture (or the one on the stage), as
//           one undo step; a drawing joins a picture's drawing. The copy on the stage is picked.
// Text fields keep their own copy and paste. Nothing happens while playing, or with nothing to copy.
export function useObjectClipboard(save: SaveObjectsOf) {
  const latest = useRef(save);   // the studio's commands are new each render; the listener stays
  useEffect(() => { latest.current = save; });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || isTextEntry(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "c" && !window.getSelection()?.toString() && copy()) event.preventDefault();
      else if (key === "v" && paste(latest.current)) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

// The pictures as shown (with changes not saved yet), and the one on the stage.
function shown(state: EditorState) {
  const frames = withPreview(orderedFrames(state), "elements", state.elementsPreview);
  return { frames, onStage: frames[shownIndex(frames.map((frame) => frame.id), state.selection)] };
}

// What Ctrl+C copies now: in the Draw tab the picture's drawing; in the Objects tab the picked
// object, on the picture or on the overlay track. Whether something was copied.
function copy(): boolean {
  const state = editorStore.getState();
  if (state.isPlaying) return false;
  const { onStage } = shown(state);
  let element: Element | undefined;
  if (state.panelTab === "draw") element = onStage?.elements.find((item) => item.kind === DRAWING);
  else if (state.panelTab === "objects" && state.selectedElement) element = onStage?.elements.find((item) => item.id === state.selectedElement) ?? shownOverlays(state).find((overlay) => overlay.element.id === state.selectedElement)?.element;
  if (!element) return false;
  state.setClipboard(element);
  return true;
}

// Pastes the clipboard onto the selected pictures (or the one on the stage): shown straight away,
// then saved as one step. Whether there was something to paste.
function paste(save: SaveObjectsOf): boolean {
  const state = editorStore.getState();
  const copied = state.clipboard;
  if (!copied || state.isPlaying || !state.project) return false;
  const { frames, onStage } = shown(state);
  const targets = state.selection.length ? frames.filter((frame) => state.selection.includes(frame.id)) : onStage ? [onStage] : [];
  if (targets.length === 0) return false;
  settleSoon("object");
  const size = { width: state.project.width, height: state.project.height };
  const pastes = targets.map((frame) => ({ frame, ...pasteInto(frame.elements, copied, size) }));
  state.previewElements(Object.fromEntries(pastes.map(({ frame, elements }) => [frame.id, elements])));
  const picked = pastes.find(({ frame }) => frame.id === onStage?.id) ?? pastes[0];
  state.selectElement(picked.pasted.id);
  const label = `Paste ${objectLabel(copied)}${targets.length > 1 ? ` on ${targets.length} pictures` : ""}`;
  const changes = pastes.map(({ frame, elements }) => ({ frameId: frame.id, from: savedObjects(frame.id), to: elements }));
  void save(changes, label).then((ok) => { if (!ok) editorStore.getState().clearElementsPreview(targets.map((frame) => frame.id)); });
  return true;
}
