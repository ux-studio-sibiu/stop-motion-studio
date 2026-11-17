"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Point } from "@/core/model";

const DRAG_START = 6;   // px the pointer moves before a press becomes a drag

// One kind of object in the Objects tab, as an icon to drag onto the picture on the stage
// (ObjectEditor's layer). `onPlace` gets where it was dropped, as fractions of the picture, or
// null when it was clicked or pressed with the keyboard instead: then it goes to a spot of the
// caller's choosing. A drop outside the picture does nothing. Pointer events, not HTML drag and
// drop, so it works with a finger on a tablet too; the icon follows the pointer meanwhile.
export function ObjectTile({ label, icon, disabled = false, title, onPlace }: { label: string; icon: ReactNode; disabled?: boolean; title?: string; onPlace: (at: Point | null) => void }) {
  const [ghost, setGhost] = useState<Point | null>(null);
  const drag = useRef<{ pointerId: number; start: Point; moved: boolean } | null>(null);
  const dragged = useRef(false);   // the click that follows a drag isn't a click

  const stage = () => document.querySelector<HTMLElement>(".nsc-object-editor");
  const dropAt = (x: number, y: number): Point | null => {
    const box = stage()?.getBoundingClientRect();
    if (!box || box.width === 0 || x < box.left || x > box.right || y < box.top || y > box.bottom) return null;
    return { x: (x - box.left) / box.width, y: (y - box.top) / box.height };
  };
  const showDrop = (on: boolean) => { const layer = stage(); if (layer) layer.dataset.dropping = on ? "true" : "false"; };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.moved && Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) < DRAG_START) return;
    current.moved = true;
    setGhost({ x: event.clientX, y: event.clientY });
    showDrop(dropAt(event.clientX, event.clientY) !== null);
  };
  const end = (event: PointerEvent<HTMLButtonElement>, drop: boolean) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    setGhost(null);
    showDrop(false);
    if (!current.moved) return;
    dragged.current = true;
    const at = drop ? dropAt(event.clientX, event.clientY) : null;
    if (at) onPlace(at);
  };

  return (
    <>
      <button type="button" className={`tile${ghost ? " is-dragging" : ""}`} aria-label={label} title={title ?? `${label}: drag it onto the picture`} disabled={disabled}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={(event) => end(event, true)} onPointerCancel={(event) => end(event, false)}
        onClick={() => { if (dragged.current) { dragged.current = false; return; } onPlace(null); }}>
        {icon}
      </button>
      {ghost && createPortal(<div className="nsc-drag-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">{icon}</div>, document.body)}
    </>
  );
}
