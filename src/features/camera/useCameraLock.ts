"use client";

import { useEffect, useMemo } from "react";
import { cameraLockSupport, setCameraLock } from "@/adapters/camera/camera";
import { remembered, useRememberedState } from "@/studio/remembered";

// The camera's lock (adapters/camera: focus, exposure and white balance held where they are, so the
// pictures don't flicker): what this camera can lock, the switch (remembered), and the lock applied
// again whenever the camera starts or changes.
export function useCameraLock(stream: MediaStream | null) {
  const [wanted, setLocked] = useRememberedState(remembered.cameraLock, false);
  const track = stream?.getVideoTracks()[0] ?? null;
  const support = useMemo(() => cameraLockSupport(track), [track]);
  const can = support.focus || support.exposure || support.whiteBalance;

  useEffect(() => {
    if (track && can) void setCameraLock(track, wanted);
  }, [track, can, wanted]);

  return { live: track !== null, can, locked: wanted && can, setLocked };
}
