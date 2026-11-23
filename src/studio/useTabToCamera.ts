"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { editorStore } from "@/store/useEditor";
import type { Camera } from "./useCamera";

const WAIT = 10_000;   // ms: a picture asked for longer ago than this (the camera was refused, say) is dropped
const SETTLE = 400;    // ms after the first frame: a camera's first frames are often dark while it adjusts

// Tab while the camera isn't taking pictures (another tab is open, or the camera is off): the
// Camera tab opens, the camera turns on, and as soon as it shows a picture, one is taken, as Tab
// does with the camera on (useCapture). Opening the Camera tab turns the camera on by itself;
// in the Camera tab with the camera turned off, it's started here.
// `capture` is a ref (useCapture's, set by the studio), since useCapture needs this hook's Tab first.
export function useTabToCamera(camera: Camera, canCapture: boolean, video: RefObject<HTMLVideoElement | null>, capture: RefObject<() => Promise<void>>) {
  const askedAt = useRef(0);   // when Tab asked for a picture before the camera could take one
  const now = useRef(camera);
  useEffect(() => { now.current = camera; });

  const tabToCamera = useCallback(() => {
    askedAt.current = Date.now();
    const state = editorStore.getState();
    if ((state.panelTab ?? "camera") !== "camera") state.setPanelTab("camera");
    else if (now.current.status !== "live" && now.current.status !== "asking") now.current.start();
  }, []);

  useEffect(() => {
    if (!canCapture || !askedAt.current) return;
    const fresh = Date.now() - askedAt.current < WAIT;
    askedAt.current = 0;
    if (!fresh) return;
    let cancelled = false;
    void firstFrame(video.current).then((ready) => {
      if (!cancelled && ready) setTimeout(() => { if (!cancelled) void capture.current(); }, SETTLE);
    });
    return () => { cancelled = true; };
  }, [canCapture, capture, video]);   // capture: the ref, the same each time

  return tabToCamera;
}

// Resolves when the video shows a picture (true), or after a few seconds without one (false).
function firstFrame(element: HTMLVideoElement | null): Promise<boolean> {
  if (!element) return Promise.resolve(false);
  if (element.videoWidth && element.readyState >= 2) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ready: boolean) => { element.removeEventListener("loadeddata", onData); clearTimeout(timer); resolve(ready); };
    const onData = () => done(Boolean(element.videoWidth));
    const timer = setTimeout(() => done(Boolean(element.videoWidth)), 4000);
    element.addEventListener("loadeddata", onData);
  });
}
