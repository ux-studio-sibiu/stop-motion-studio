"use client";

import { useMemo } from "react";
import { boxAt, objectLabel, overlaysDuring, withElement, withOverlay, type Element, type Frame, type Overlay, type Point } from "@/core/model";
import { editorStore, useEditor, useShownOverlays } from "@/store/useEditor";
import { useStagePicture } from "@/studio/StagePicture";
import { commitOverlays, deleteOverlay, previewOverlays, type SaveOverlays } from "@/studio/overlayEditing";
import { startTick } from "@/core/render";
import { commitObjects, previewObjects, type SaveObjects } from "@/studio/pictureObjects";

// What the Objects tab and the stage layer share: the objects on the stage, and how a change to
// one is shown and then saved. An object lives in one of two places:
//   on the picture  Frame.elements (step 23): saved with setObjects
//   in time         an overlay showing now (step 24): saved with setOverlays
// Everything else (the box editing, the settings) is the same for both.

export type { SaveObjects };
export type ObjectSaves = { objects: SaveObjects; overlays: SaveOverlays };

// An object on the stage, and the overlay it lives on, if it lives in time.
export type Placed = { element: Element; overlay?: Overlay };

// The picture on the stage (the rightmost selected, or the last) with any change not saved yet, the
// overlays (likewise), and:
//   placed  the objects on the stage: the picture's, then every overlay showing at any moment of
//           it, bottom first (renderPicture's order)
//   picked  the picked object, wherever it lives: on the stage, or an overlay that isn't on this
//           picture (its settings are still in the Objects tab); `onStage` says which
export function useStageObjects(): { frame: Frame | undefined; overlays: readonly Overlay[]; placed: Placed[]; picked: (Placed & { onStage: boolean }) | undefined } {
  const { frames, index, frame } = useStagePicture();
  const selectedId = useEditor((state) => state.selectedElement);
  const overlays = useShownOverlays();
  const start = startTick(frames, index);
  const end = start + (frame?.hold ?? 0);
  const placed = useMemo(() => {
    if (!frame) return [];
    return [...frame.elements.map((element) => ({ element })), ...overlaysDuring(overlays, start, end).map((overlay) => ({ element: overlay.element, overlay }))];
  }, [frame, start, end, overlays]);
  const onStage = placed.find((item) => item.element.id === selectedId);
  const elsewhere = onStage ? undefined : overlays.find((overlay) => overlay.element.id === selectedId);
  const picked = onStage ? { ...onStage, onStage: true } : elsewhere ? { element: elsewhere.element, overlay: elsewhere, onStage: false } : undefined;
  return { frame, overlays, placed, picked };
}

// Adding and removing an object, the same wherever it's offered (the Objects tab, the stage's keys):
// shown straight away, picked, then saved as one step, like addOverlay and deleteOverlay for the
// overlay track.

// Adds an object to a picture and picks it. `at`: where it was dropped (fractions of the picture),
// its centre goes there; null: a little lower and to the right of the last one, so none hides
// another.
export function addToPicture(frame: Frame, object: Element, at: Point | null, save: SaveObjects): void {
  const step = frame.elements.length % 5;
  const box = at ? boxAt(object.box, at) : { ...object.box, x: object.box.x + step * 0.06, y: object.box.y + step * 0.1 };
  previewObjects(frame.id, [...frame.elements, { ...object, box }]);
  editorStore.getState().selectElement(object.id);
  commitObjects(frame.id, save, `Add ${objectLabel(object)}`);
}

// Removes an object, wherever it lives, as one step; nothing is picked afterwards.
export function removePlaced(frame: Frame, placed: Placed, saves: ObjectSaves): void {
  if (placed.overlay) { deleteOverlay(placed.overlay.id, saves.overlays); return; }
  previewObjects(frame.id, frame.elements.filter((item) => item.id !== placed.element.id));
  commitObjects(frame.id, saves.objects, `Delete ${objectLabel(placed.element)}`);
  editorStore.getState().selectElement(null);
}

// Shows one object changed (`next`) or removed (null), wherever it lives, without saving.
// `frame` and `overlays` are what's shown now.
export function previewPlaced(frame: Frame, overlays: readonly Overlay[], placed: Placed, next: Element | null): void {
  const { overlay } = placed;
  if (overlay) previewOverlays(withOverlay(overlays, overlay.id, next ? { ...overlay, element: next } : null));
  else previewObjects(frame.id, withElement(frame.elements, placed.element.id, next));
}

// Saves what's shown for the place this object lives in, as one step.
export function commitPlaced(frame: Frame, placed: Placed, saves: ObjectSaves, label: string): void {
  if (placed.overlay) commitOverlays(saves.overlays, label);
  else commitObjects(frame.id, saves.objects, label);
}

// Puts the keyboard in the picked object's text box in the Objects tab (Enter or a double-click on
// the stage, or a new object). A new object's box isn't there yet: it takes the keyboard when it
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
