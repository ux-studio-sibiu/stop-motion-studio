"use client";

import { deleteFrames, duplicateFrames, reorderFrames, setAdjusts, setElements, setElementsOf, setFps, setHold, setOverlays, setSafeMargin, setTransforms, type Command } from "@/core/commands";
import type { Adjust, Element, Overlay, Transform } from "@/core/model";
import { editorStore } from "@/store/useEditor";
import type { HoldChange } from "./timeline/useResize";

// Every change the studio's parts can make to the open animation, as one object. Each runs one
// command through the undo history (useHistory), so it can be undone, and resolves to whether it
// was saved. Without an open project they do nothing (and resolve false).
//
// A new kind of edit is one more line here; the parts that offer it get it as a prop.
export type TransformChange = { id: string; from: Transform; to: Transform };
export type AdjustChange = { id: string; from: Adjust; to: Adjust };
export type StudioCommands = ReturnType<typeof useStudioCommands>;

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
    adjustPictures: (changes: AdjustChange[], label: string) => on((id) => setAdjusts(id, changes, label)),
    setObjects: (frameId: string, from: readonly Element[], to: readonly Element[], label: string) => on((id) => setElements(id, frameId, from, to, label)),
    setObjectsOf: (changes: { frameId: string; from: readonly Element[]; to: readonly Element[] }[], label: string) => on((id) => setElementsOf(id, changes, label)),
    setOverlays: (from: readonly Overlay[], to: readonly Overlay[], label: string) => on((id) => setOverlays(id, from, to, label)),
    setSpeed: (from: number, to: number) => (from === to ? Promise.resolve(false) : on((id) => setFps(id, from, to))),
    setSafeMargin: (from: number, to: number) => on((id) => setSafeMargin(id, from, to)),
  };
}
