"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { captureFrame } from "@/adapters/camera/capture";
import { createFrame, newId } from "@/core/model";
import { editorStore } from "@/store/useEditor";
import { images, thumbs } from "./media";

// Taking a picture: grab the live video, store the photo and its thumbnail in the caches,
// add a frame at the end of the animation. Space does the same, unless the child is typing
// or a button has focus (Space already presses that button).
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
      images.put(imageId, shot.image);
      thumbs.put(imageId, shot.thumb);
      editorStore.getState().insertFrames([createFrame(project.id, imageId)]);
    } catch (error) {
      console.warn("Capture failed", error);   // e.g. the video had no frame yet; the next press works
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
