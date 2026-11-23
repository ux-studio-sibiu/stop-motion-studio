"use client";

import { useRef, type PointerEvent } from "react";
import { frameIndexAt, totalTicks, type Frame } from "@/core/model";
import { editorStore } from "@/store/useEditor";

// Scrubbing: dragging along the ruler stops playback and selects the picture under the pointer,
// which the stage then shows. (The playhead itself, which is the selection: Playhead.tsx.)
export function useScrub(frames: readonly Frame[], tickWidth: number, selectOnly: (id: string) => void) {
  const scrubbing = useRef<number | null>(null);

  const scrubTo = (clientX: number, ruler: HTMLElement) => {
    const total = totalTicks(frames);
    if (total === 0) return;
    const tick = Math.min(total - 1, Math.max(0, Math.floor((clientX - ruler.getBoundingClientRect().left) / tickWidth)));
    editorStore.getState().seek(tick);
    selectOnly(frames[frameIndexAt(frames, tick)].id);
  };

  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || frames.length === 0) return;
      editorStore.getState().pause();
      event.currentTarget.setPointerCapture(event.pointerId);
      scrubbing.current = event.pointerId;
      scrubTo(event.clientX, event.currentTarget);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => { if (scrubbing.current === event.pointerId) scrubTo(event.clientX, event.currentTarget); },
    onPointerUp: () => { scrubbing.current = null; },
    onPointerCancel: () => { scrubbing.current = null; },
  };
}
