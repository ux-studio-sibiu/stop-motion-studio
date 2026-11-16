"use client";

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { panView, zoomView, type StageView } from "@/core/render";
import { editorStore, useEditor } from "@/store/useEditor";

type Pan = { pointerId: number; start: { x: number; y: number }; view: StageView; box: { width: number; height: number } };

// Looking closer at the stage (step 19), on the editing layer (`element`): Ctrl + wheel (also
// what a trackpad pinch sends) zooms around the pointer; when zoomed in, Space-drag or the middle
// button pans. Only the view changes, never the picture (PLAN.md §1, "Two zooms").
// The pointer handlers return true when they handled the event, so the editor leaves it alone.
export function useStagePan(element: RefObject<HTMLDivElement | null>) {
  const zoomed = useEditor((state) => state.stageView.zoom > 1);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const pan = useRef<Pan | null>(null);

  // Space held: a drag pans instead of moving the picture.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === " ") setSpaceHeld(event.type === "keydown"); };
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // A native listener, because React's wheel events can't stop the page from zooming.
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;   // the plain wheel sizes the picture (StageEditor)
      event.preventDefault();
      const visible = node.closest(".stage-frame")?.getBoundingClientRect();
      if (!visible) return;
      const view = editorStore.getState().stageView;
      const focus = { x: (event.clientX - visible.left) / visible.width, y: (event.clientY - visible.top) / visible.height };
      editorStore.getState().setStageView(zoomView(view, view.zoom * Math.exp(-event.deltaY * 0.01), focus));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [element]);

  return {
    panning: zoomed && spaceHeld,   // for the grab cursor

    start(event: PointerEvent<HTMLDivElement>): boolean {
      if (!zoomed || !(event.button === 1 || (event.button === 0 && spaceHeld))) return false;
      event.preventDefault();   // the middle button would start the browser's autoscroll
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true });
      pan.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, view: editorStore.getState().stageView, box: event.currentTarget.getBoundingClientRect() };
      return true;
    },

    move(event: PointerEvent<HTMLDivElement>): boolean {
      const current = pan.current;
      if (!current || current.pointerId !== event.pointerId) return false;
      const { start, view, box } = current;
      editorStore.getState().setStageView(panView(view, -(event.clientX - start.x) / box.width, -(event.clientY - start.y) / box.height));
      return true;
    },

    end(event: PointerEvent<HTMLDivElement>): boolean {
      if (!pan.current || pan.current.pointerId !== event.pointerId) return false;
      pan.current = null;
      return true;
    },
  };
}
