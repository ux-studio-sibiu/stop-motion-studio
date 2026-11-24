"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { remembered } from "../remembered";
import { trueShapeZoom } from "@/core/model";
import { editorStore, useEditor } from "@/store/useEditor";

const SAVE_DELAY = 250;   // ms after scrolling stops

// Remembers how each animation's timeline was looked at (zoom and scroll position) across
// reloads, on this device. It's a way of looking, not part of the animation, so it's a
// preference (localStorage), not project data. An animation opened here for the first time (a new
// one, a restored backup, a demo) starts at the last zoom chosen anywhere, or, before any was, at
// its pictures' true shape (a picture held one tick as wide as its shape makes it: trueShapeZoom). The scroll position is kept as the time at the left edge, so it lands on the same
// moment even if the zoom differs. The store stays storage-free: this hook restores the view
// once per opened animation, before the first paint, and saves every change.
export function useTimelineView(scroller: RefObject<HTMLDivElement | null>) {
  const projectId = useEditor((state) => state.project?.id);
  const zoom = useEditor((state) => state.timelineZoom);
  const restoredFor = useRef<string | null>(null);
  const pending = useRef<{ seconds: number; zoom: number } | null>(null);

  // A newly opened animation: its own zoom, the last zoom chosen, or its true shape; then its scroll
  // position.
  useLayoutEffect(() => {
    if (!projectId || restoredFor.current === projectId) return;
    restoredFor.current = projectId;
    const view = remembered.timelineView(projectId).read();
    const zoom = view?.zoom ?? remembered.timelineZoom.read() ?? trueShape(scroller.current);
    if (zoom !== undefined) editorStore.getState().setTimelineZoom(zoom);
    pending.current = { seconds: view?.scrollSeconds ?? 0, zoom: editorStore.getState().timelineZoom };   // the zoom as clamped
  }, [projectId, scroller]);

  // Scroll once the timeline is drawn at that zoom (setting the zoom re-renders first).
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || !pending.current || pending.current.zoom !== zoom) return;
    element.scrollTo({ left: pending.current.seconds * zoom });
    pending.current = null;
  });

  // Save: the zoom right away (also as the zoom for new animations), the scroll once it stops.
  useEffect(() => {
    const element = scroller.current;
    if (!element || !projectId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      const { timelineZoom } = editorStore.getState();
      remembered.timelineView(projectId).save({ zoom: timelineZoom, scrollSeconds: element.scrollLeft / timelineZoom });
    };
    const onScroll = () => {
      if (pending.current) return;   // that's the restore itself, not the child scrolling
      clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY);
    };
    const stop = editorStore.subscribe((state, previous) => {
      if (state.timelineZoom === previous.timelineZoom || pending.current) return;
      remembered.timelineZoom.save(state.timelineZoom);
      clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY);   // after the zoom's own scroll adjustment
    });
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      stop();
      element.removeEventListener("scroll", onScroll);
    };
  }, [projectId, scroller]);
}

// The open animation's true-shape zoom at the pictures' height on the timeline now (the track's,
// inside its padding); none before the timeline is laid out.
function trueShape(scroller: HTMLElement | null): number | undefined {
  const project = editorStore.getState().project;
  const track = scroller?.querySelector<HTMLElement>(".track");
  if (!project || !track) return undefined;
  const style = getComputedStyle(track);
  const height = track.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  return height > 0 ? trueShapeZoom(height, project, project.fps) : undefined;
}
