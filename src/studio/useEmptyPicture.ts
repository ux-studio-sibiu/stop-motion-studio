"use client";

import { useCallback, useRef } from "react";
import { blankPicture } from "@/adapters/images/blank";
import { addFrames, type Command } from "@/core/commands";
import { createFrame, inOrder, newId } from "@/core/model";
import { editorStore } from "@/store/useEditor";
import { thumbs } from "./media";

// Adding an empty picture without taking one (the timeline's next-picture slot): a see-through
// frame after the selected picture (or at the end), one undo step like a capture. It's drawn with
// no background, so the stage shows a checkerboard there and a GIF is see-through; objects,
// drawings and overlays go on it like on any picture.
export function useEmptyPicture(run: (command: Command) => Promise<unknown>) {
  const busy = useRef(false);
  return useCallback(async () => {
    const project = editorStore.getState().project;
    if (!project || busy.current) return;
    busy.current = true;
    try {
      editorStore.getState().pause();
      const picture = await blankPicture(project);
      if (editorStore.getState().project?.id !== project.id) return;   // left the project meanwhile
      const imageId = newId();
      const frame = createFrame(project.id, imageId, { empty: true });
      const after = inOrder(project.frameIds, editorStore.getState().selection).at(-1);
      thumbs.put(imageId, picture.thumb);   // in memory before the save, so the update finds it
      await run(addFrames(project.id, {
        after,
        frames: [frame],
        images: [{ id: imageId, projectId: project.id, blob: picture.image, width: picture.width, height: picture.height, createdAt: Date.now() }],
        thumbs: [{ imageId, projectId: project.id, blob: picture.thumb }],
      }, "Add empty picture"));
    } finally {
      busy.current = false;
    }
  }, [run]);
}
