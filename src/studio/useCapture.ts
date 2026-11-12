"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { captureFrame } from "@/adapters/camera/capture";
import { appRepository } from "@/adapters/storage/appRepository";
import { createFrame, newId } from "@/core/model";
import { editorStore } from "@/store/useEditor";
import { thumbs } from "./media";

// Taking a picture: grab the live video, save the photo, its thumbnail and a new frame at the
// end of the animation in one transaction. The timeline updates from storage (useProject),
// so a capture shows up the same way whether it was taken here or in another tab.
// Space does the same, unless the child is typing or a button has focus (Space already
// presses that button).
export function useCapture(video: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const [capturing, setCapturing] = useState(false);
  const busy = useRef(false);

  const capture = useCallback(async () => {
    const element = video.current;
    const project = editorStore.getState().project;
    if (!enabled || !element || !project || busy.current) return;

    busy.current = true;
    setCapturing(true);
    try {
      const shot = await captureFrame(element, project);
      if (editorStore.getState().project?.id !== project.id) return;   // left the project meanwhile

      const imageId = newId();
      thumbs.put(imageId, shot.thumb);   // in memory before the save, so the update finds it
      await appRepository().insertFrames(project.id, {
        frames: [createFrame(project.id, imageId)],
        images: [{ id: imageId, projectId: project.id, blob: shot.image, width: shot.width, height: shot.height, createdAt: Date.now() }],
        thumbs: [{ imageId, projectId: project.id, blob: shot.thumb }],
      });
    } catch (error) {
      console.warn("Capture failed", error);   // no frame yet, or the save failed (full storage: step 20)
    } finally {
      busy.current = false;
      setCapturing(false);
    }
  }, [video, enabled]);

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
