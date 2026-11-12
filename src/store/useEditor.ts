"use client";

import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createEditorStore, orderedFrames, type EditorState } from "./editorStore";

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
