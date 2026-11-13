"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { clampHold, resizeHolds, ticksFromPx, type Frame } from "@/core/model";
import { editorStore } from "@/store/useEditor";

export type HoldChange = { id: string; from: number; to: number };

const TAP_DISTANCE = 4;   // px: moving less than this on the grip is a tap, not a resize

// Resizing pictures' length: dragging the grip on a selected picture's right edge, or [ and ]
// for the selection. While dragging, the new lengths are only a preview in the store
// (holdPreview), so the timeline follows the pointer without touching storage; letting go
// saves one command for the whole drag. Escape (or a cancelled pointer) puts it back.
//
// `frames` are the frames as shown (with any preview), so a key press right after another one
// builds on it, even before the first one is saved.
export function useResize(frames: readonly Frame[], selection: readonly string[], tickWidth: number, onResize: (changes: HoldChange[]) => Promise<boolean>, onTap: (id: string, event: PointerEvent<HTMLElement>) => void) {
  const drag = useRef<{ pointerId: number; startX: number; base: Pick<Frame, "id" | "hold">[] } | null>(null);
  const [grabbed, setGrabbed] = useState<string | null>(null);

  const selected = () => frames.filter((frame) => selection.includes(frame.id)).map(({ id, hold }) => ({ id, hold }));

  const save = (changes: HoldChange[], ids: string[]) => {
    if (changes.length === 0) { editorStore.getState().clearHoldPreview(ids); return; }
    void onResize(changes).then((saved) => { if (!saved) editorStore.getState().clearHoldPreview(ids); });
  };

  const end = () => {
    const current = drag.current;
    drag.current = null;
    setGrabbed(null);
    return current;
  };

  const onGripDown = (id: string, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);   // keep the moves even off the grip
    const base = selection.includes(id) ? selected() : frames.filter((frame) => frame.id === id).map(({ id, hold }) => ({ id, hold }));
    drag.current = { pointerId: event.pointerId, startX: event.clientX, base };
    setGrabbed(id);
  };

  const onGripMove = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const delta = ticksFromPx(event.clientX - current.startX, tickWidth);
    editorStore.getState().previewHolds(Object.fromEntries(current.base.map(({ id, hold }) => [id, clampHold(hold + delta)])));
  };

  const onGripUp = (id: string, event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    end();
    const ids = current.base.map((frame) => frame.id);
    // Barely moved: a tap. On a narrow picture the grip covers most of it, so pass the tap on
    // (with Shift or Ctrl) as a click on the picture.
    if (Math.abs(event.clientX - current.startX) < TAP_DISTANCE) {
      editorStore.getState().clearHoldPreview(ids);
      onTap(id, event);
      return;
    }
    const delta = ticksFromPx(event.clientX - current.startX, tickWidth);
    save(resizeHolds(current.base, delta), ids);
  };

  // Escape while dragging, or the browser took the pointer away (a scroll, a system gesture).
  const cancel = () => {
    const current = end();
    if (current) editorStore.getState().clearHoldPreview(current.base.map(({ id }) => id));
    return current !== null;
  };

  // [ and ]: one tick shorter or longer, every selected picture.
  const nudge = (delta: number) => {
    const base = selected();
    const changes = resizeHolds(base, delta);
    if (changes.length === 0) return;
    editorStore.getState().previewHolds(Object.fromEntries(changes.map(({ id, to }) => [id, to])));
    save(changes, changes.map(({ id }) => id));
  };

  // Escape cancels a drag wherever the keyboard focus is (pressing the grip doesn't move it).
  useEffect(() => {
    if (!grabbed) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || !drag.current) return;
      const ids = drag.current.base.map(({ id }) => id);
      drag.current = null;
      setGrabbed(null);
      editorStore.getState().clearHoldPreview(ids);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grabbed]);

  return { grabbed, onGripDown, onGripMove, onGripUp, cancel, nudge };
}
