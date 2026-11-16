"use client";

import { deleteFrames, duplicateFrames, reorderFrames, setFps, setHold, setSafeMargin, setTransforms, type Command } from "@/core/commands";
import { editorStore } from "@/store/useEditor";
import type { TransformChange } from "./transformEditing";
import type { HoldChange } from "./useResize";

// Every change the studio's parts can make to the open animation, as one object. Each runs one
// command through the undo history (useHistory), so it can be undone, and resolves to whether it
// was saved. Without an open project they do nothing (and resolve false).
//
// A new kind of edit is one more line here; the parts that offer it get it as a prop.
export function useStudioCommands(projectId: string | null, run: (command: Command) => Promise<boolean>) {
  const on = (make: (id: string) => Command): Promise<boolean> => (projectId ? run(make(projectId)) : Promise.resolve(false));

  return {
    deletePictures: (ids: readonly string[]) => on((id) => deleteFrames(id, ids)),
    duplicatePictures: (ids: readonly string[]) => {
      const { frames, project } = editorStore.getState();
      return on((id) => duplicateFrames(id, ids.flatMap((frameId) => frames[frameId] ?? []), project?.frameIds ?? []));
    },
    resizePictures: (changes: HoldChange[]) => on((id) => setHold(id, changes)),
    reorderPictures: (before: string[], after: string[], moved: string[]) => on((id) => reorderFrames(id, before, after, moved)),
    transformPictures: (changes: TransformChange[], label: string) => on((id) => setTransforms(id, changes, label)),
    setSpeed: (from: number, to: number) => (from === to ? Promise.resolve(false) : on((id) => setFps(id, from, to))),
    setSafeMargin: (from: number, to: number) => on((id) => setSafeMargin(id, from, to)),
  };
}
