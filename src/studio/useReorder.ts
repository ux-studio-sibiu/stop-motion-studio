"use client";

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { frameStarts, gapAt, inOrder, moveIds, sameOrder, type Frame } from "@/core/model";
import { editorStore } from "@/store/useEditor";

const DRAG_DISTANCE = 8;     // px a mouse or pen moves before a press becomes a drag (less is a click)
const TOUCH_HOLD_MS = 350;   // a finger holds still this long to pick a picture up (moving sooner scrolls)
const EDGE = 48;             // px from the timeline's edge where dragging scrolls it
const MAX_SCROLL = 14;       // px per frame at the very edge

export type Drag = { ids: string[]; x: number; y: number; gap: number; markerX: number };

// Reordering by dragging a picture's body (the grip on its edge resizes instead). A drag
// carries the whole selection if the picture is selected, or just that picture. While dragging
// nothing is saved: the pictures stay in place, faded, a small copy follows the pointer, and a
// marker shows where they'll land. Dropping saves one command; Escape cancels.
export function useReorder(frames: readonly Frame[], selection: readonly string[], tickWidth: number, scroller: RefObject<HTMLDivElement | null>, track: RefObject<HTMLOListElement | null>, onMove: (before: string[], after: string[], moved: string[]) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const pending = useRef<{ pointerId: number; id: string; x: number; y: number; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const live = useRef<Drag | null>(null);          // the drag, for listeners that outlive a render
  const suppressClick = useRef(false);
  const layout = useRef({ frames, tickWidth });    // the latest layout, for the same reason
  useEffect(() => { layout.current = { frames, tickWidth }; });

  // Where a drop at clientX goes, and where to draw the marker (track coordinates).
  const place = (ids: string[], clientX: number) => {
    const { frames, tickWidth } = layout.current;
    const left = track.current?.getBoundingClientRect().left ?? 0;
    const starts = frameStarts(frames);
    const staying = frames.map((frame, i) => ({ id: frame.id, start: starts[i] * tickWidth, width: frame.hold * tickWidth })).filter((slot) => !ids.includes(slot.id));
    const gap = gapAt(staying, clientX - left);
    const last = staying.at(-1);
    const markerX = gap < staying.length ? staying[gap].start : last ? last.start + last.width : 0;
    return { gap, markerX };
  };

  const update = (next: Drag | null) => { live.current = next; setDrag(next); };
  const latest = useRef({ place, update });   // for the auto-scroll loop, which runs between renders
  useEffect(() => { latest.current = { place, update }; });

  const start = (id: string, x: number, y: number) => {
    const { selection } = editorStore.getState();
    const order = layout.current.frames.map((frame) => frame.id);
    const ids = selection.includes(id) ? inOrder(order, selection) : [id];
    if (!selection.includes(id)) editorStore.getState().select([id]);
    suppressClick.current = true;   // the click that ends this press isn't a selection click
    update({ ids, x, y, ...place(ids, x) });
  };

  const finish = (drop: boolean) => {
    const current = live.current;
    if (pending.current?.timer) clearTimeout(pending.current.timer);
    pending.current = null;
    update(null);
    setTimeout(() => { suppressClick.current = false; }, 0);   // only the click ending this press
    if (!current || !drop) return;
    const before = layout.current.frames.map((frame) => frame.id);
    const after = moveIds(before, current.ids, current.gap);
    if (!sameOrder(before, after)) onMove(before, after, current.ids);
  };

  const onFramePointerDown = (id: string, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey) return;   // those are selection clicks
    const press = { pointerId: event.pointerId, id, x: event.clientX, y: event.clientY } as NonNullable<typeof pending.current>;
    if (event.pointerType === "touch") press.timer = setTimeout(() => { if (pending.current === press) start(id, press.x, press.y); }, TOUCH_HOLD_MS);
    pending.current = press;
  };

  // While a press or drag is on, follow the pointer anywhere on the page.
  const active = drag !== null;
  useEffect(() => {
    const onMoveEvent = (event: globalThis.PointerEvent) => {
      const press = pending.current;
      if (!press || press.pointerId !== event.pointerId) return;
      const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      if (!live.current) {
        if (moved < DRAG_DISTANCE) return;
        if (event.pointerType === "touch") { finish(false); return; }   // moved before the hold: it's a scroll
        start(press.id, event.clientX, event.clientY);
        return;
      }
      update({ ...live.current, x: event.clientX, y: event.clientY, ...place(live.current.ids, event.clientX) });
    };
    const onUp = (event: globalThis.PointerEvent) => { if (pending.current?.pointerId === event.pointerId) finish(true); };
    const onCancel = (event: globalThis.PointerEvent) => { if (pending.current?.pointerId === event.pointerId) finish(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && live.current) { event.stopPropagation(); finish(false); } };
    // Once a finger has picked a picture up, its moves drag instead of scrolling the page.
    const onTouchMove = (event: TouchEvent) => { if (live.current) event.preventDefault(); };
    window.addEventListener("pointermove", onMoveEvent);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("pointermove", onMoveEvent);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("touchmove", onTouchMove);
    };
  });

  // Near the timeline's edges, scroll it, faster the closer the pointer is.
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const step = () => {
      const element = scroller.current;
      const current = live.current;
      if (element && current) {
        const box = element.getBoundingClientRect();
        const speed = current.x < box.left + EDGE ? -(box.left + EDGE - current.x) : current.x > box.right - EDGE ? current.x - (box.right - EDGE) : 0;
        if (speed !== 0) {
          element.scrollLeft += Math.max(-MAX_SCROLL, Math.min(MAX_SCROLL, speed / 3));
          latest.current.update({ ...current, ...latest.current.place(current.ids, current.x) });
        }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, scroller]);

  // A click right after a drag would select just one picture: skip it.
  const takeClick = () => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  };

  return { drag, onFramePointerDown, takeClick };
}
