"use client";

import { useEffect, useRef, type PointerEvent, type RefObject } from "react";
import { frameIndexAt, frameStarts, inOrder, totalTicks, type Frame } from "@/core/model";
import { editorStore, useEditor } from "@/store/useEditor";
import { timelineInset } from "./useTimelineZoom";

// The playhead on the timeline: where playback is while playing; otherwise where Play will start
// (the first selected picture). Dragging along the ruler scrubs: it stops playback and selects
// the picture under the pointer, which the stage then shows. While playing, the timeline pages
// along to keep the playhead in view.
export function useScrub(frames: readonly Frame[], selection: readonly string[], tickWidth: number, scroller: RefObject<HTMLDivElement | null>, selectOnly: (id: string) => void) {
  const isPlaying = useEditor((state) => state.isPlaying);
  const playhead = useEditor((state) => state.playhead);
  const order = frames.map((frame) => frame.id);
  const firstSelected = inOrder(order, selection)[0];
  const playFrom = isPlaying ? playhead : firstSelected ? frameStarts(frames)[order.indexOf(firstSelected)] : undefined;
  const scrubbing = useRef<number | null>(null);

  const scrubTo = (clientX: number, ruler: HTMLElement) => {
    const total = totalTicks(frames);
    if (total === 0) return;
    const tick = Math.min(total - 1, Math.max(0, Math.floor((clientX - ruler.getBoundingClientRect().left) / tickWidth)));
    editorStore.getState().seek(tick);
    selectOnly(frames[frameIndexAt(frames, tick)].id);
  };

  const rulerHandlers = {
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

  useEffect(() => {
    const element = scroller.current;
    if (!isPlaying || !element) return;
    const x = timelineInset(element) + playhead * tickWidth;
    if (x < element.scrollLeft || x > element.scrollLeft + element.clientWidth - 48) element.scrollTo({ left: Math.max(0, x - 48) });
  }, [isPlaying, playhead, tickWidth, scroller]);

  return { isPlaying, playFrom, rulerHandlers };
}
