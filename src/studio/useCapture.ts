"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { captureFrame } from "@/adapters/camera/capture";
import { addFrames, type Command } from "@/core/commands";
import { createFrame, inOrder, newId } from "@/core/model";
import { editorStore } from "@/store/useEditor";
import { thumbs } from "./media";

// Taking a picture: grab the live video, save the photo, its thumbnail and a new frame right
// after the selected picture (or at the end) in one transaction. It's a command (addFrames), so undo takes it back.
// The timeline updates from storage (useProject), so a capture shows up the same way whether
// it was taken here or in another tab.
// Space does the same, unless the child is typing or a button has focus (Space already
// presses that button).
export function useCapture(video: RefObject<HTMLVideoElement | null>, enabled: boolean, run: (command: Command) => Promise<unknown>) {
  const [capturing, setCapturing] = useState(false);
  const busy = useRef(false);
  const previous = useRef<{ selection: readonly string[]; frameId: string } | null>(null);

  const capture = useCallback(async () => {
    const element = video.current;
    const project = editorStore.getState().project;
    if (!enabled || !element || !project || busy.current) return;

    editorStore.getState().pause();   // the stage goes back to the live camera for the shot
    busy.current = true;
    setCapturing(true);
    try {
      const shot = await captureFrame(element, project);
      if (editorStore.getState().project?.id !== project.id) return;   // left the project meanwhile

      const imageId = newId();
      const frame = createFrame(project.id, imageId);
      const { selection } = editorStore.getState();
      // After the rightmost selected picture. The capture selects itself, but only once storage
      // reports it back; if the selection hasn't changed since the previous capture, that report
      // is still on its way, so go after the previous capture instead.
      const after = previous.current?.selection === selection ? previous.current.frameId : inOrder(project.frameIds, selection).at(-1);
      previous.current = { selection, frameId: frame.id };

      thumbs.put(imageId, shot.thumb);   // in memory before the save, so the update finds it
      await run(addFrames(project.id, {
        after,
        frames: [frame],
        images: [{ id: imageId, projectId: project.id, blob: shot.image, width: shot.width, height: shot.height, createdAt: Date.now() }],
        thumbs: [{ imageId, projectId: project.id, blob: shot.thumb }],
      }));
    } catch (error) {
      console.warn("Capture failed", error);   // no frame yet, or the save failed (full storage: step 20)
    } finally {
      busy.current = false;
      setCapturing(false);
    }
  }, [video, enabled, run]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isTypingTarget(event.target)) return;
      event.preventDefault();   // don't scroll the page
      void capture();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capture]);

  return { capture, capturing };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName);
}
