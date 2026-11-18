"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { editorStore, useEditor } from "@/store/useEditor";

export const ZOOM_STEP = 1.5;

// Zooming the timeline (the buttons, and Ctrl/Cmd + wheel) around a point in time: whatever was
// under the pointer, or the selected picture, or the middle of the view, stays put. The time
// under that point is remembered before the zoom and scrolled back under it right after, before
// the browser paints.
export function useTimelineZoom(scroller: RefObject<HTMLDivElement | null>) {
  const zoom = useEditor((state) => state.timelineZoom);
  const anchor = useRef<{ seconds: number; x: number } | null>(null);

  const zoomAround = (pxPerSecond: number, x: number) => {
    const element = scroller.current;
    if (!element) return;
    anchor.current = { seconds: (element.scrollLeft + x - timelineInset(element)) / editorStore.getState().timelineZoom, x };
    editorStore.getState().setTimelineZoom(pxPerSecond);
  };

  // The buttons keep the selected picture in place, or the middle of the view.
  const zoomTo = (pxPerSecond: number) => {
    const element = scroller.current;
    if (element) zoomAround(pxPerSecond, anchorX(element));
  };

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || !anchor.current) return;
    element.scrollTo({ left: timelineInset(element) + anchor.current.seconds * zoom - anchor.current.x });
    anchor.current = null;
  }, [zoom, scroller]);

  // A native listener, because React's wheel events are passive and can't stop the browser's
  // own page zoom. Plain wheel and trackpad swipes still scroll.
  const latest = useRef(zoomAround);
  useEffect(() => { latest.current = zoomAround; });
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      latest.current(editorStore.getState().timelineZoom * factor, event.clientX - element.getBoundingClientRect().left);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [scroller]);

  return { zoom, zoomTo };
}

function anchorX(element: HTMLDivElement): number {
  const selected = element.querySelector<HTMLElement>(".frame.is-selected");
  if (selected) return selected.offsetLeft + selected.offsetWidth / 2 - element.scrollLeft;
  return element.clientWidth / 2;
}

// The gap before the first picture (the scroller's left padding, --timeline-inset): scroll
// positions include it, times start after it.
export function timelineInset(element: HTMLElement): number {
  return parseFloat(getComputedStyle(element).paddingLeft) || 0;
}
