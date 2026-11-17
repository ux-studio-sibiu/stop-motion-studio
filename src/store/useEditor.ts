"use client";

import { useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createEditorStore, orderedFrames, withPreview, type EditorState } from "./editorStore";

// The studio's one store. There is one studio on screen at a time, so a module-level
// store is simpler than a React context; tests create their own with createEditorStore().
export const editorStore = createEditorStore();

// Read one piece of state: the component re-renders only when that piece changes.
//   const name = useEditor((s) => s.project?.name);
export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStore(editorStore, selector);
}

// For selectors that build a new array or object each time: compares the items, so the
// component doesn't re-render when the contents are the same.
export function useEditorShallow<T>(selector: (state: EditorState) => T): T {
  return useStore(editorStore, useShallow(selector));
}

export function useOrderedFrames() {
  return useEditorShallow(orderedFrames);
}

// The frames in order as they should be drawn now: with any move (step 18), brightness and
// contrast change (step 20) or bubble edit (step 23) that isn't saved yet. For everything that draws pictures.
export function useShownFrames() {
  const saved = useOrderedFrames();
  const transforms = useEditor((state) => state.transformPreview);
  const adjusts = useEditor((state) => state.adjustPreview);
  const elements = useEditor((state) => state.elementsPreview);
  return useMemo(() => withPreview(withPreview(withPreview(saved, "transform", transforms), "adjust", adjusts), "elements", elements), [saved, transforms, adjusts, elements]);
}
