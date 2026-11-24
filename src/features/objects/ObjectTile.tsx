"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Point } from "@/core/model";

const DRAG_START = 6;   // px the pointer moves before a press becomes a drag

// Where a dragged object was dropped:
//   picture  on the picture on the stage (ObjectEditor's layer), at a point in fractions of it
//   track    on the timeline's overlay track, at a tick: it lives in time from there (step 24)
export type Place = { on: "picture"; at: Point } | { on: "track"; tick: number };

// One kind of object in the Objects tab, as an icon to drag onto the picture on the stage or onto
// the overlay track. `onPlace` gets where it was dropped, or null when it was pressed with the
// keyboard (Enter or Space) instead: then it goes to a spot of the caller's choosing. A click with
// the mouse or a tap adds nothing: objects are dragged where they go. A drop anywhere else
// does nothing. Pointer events, not HTML drag and drop, so it works with a finger on a tablet too;
// the icon follows the pointer meanwhile, and the place it would land lights up.
export function ObjectTile({ label, icon, disabled = false, title, onPlace }: { label: string; icon: ReactNode; disabled?: boolean; title?: string; onPlace: (place: Place | null) => void }) {
  const [ghost, setGhost] = useState<Point | null>(null);
  const drag = useRef<{ pointerId: number; start: Point; moved: boolean } | null>(null);
  const dragged = useRef(false);   // the click that follows a drag isn't a click

  // The two drop targets. The track says how wide a tick is (data-tick-width); its left edge is tick 0.
  const targets = () => ({ picture: document.querySelector<HTMLElement>(".nsc-object-editor"), track: document.querySelector<HTMLElement>("[data-overlay-track]") });
  const inside = (element: HTMLElement | null, x: number, y: number) => {
    const box = element?.getBoundingClientRect();
    return box && box.width > 0 && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom ? box : null;
  };
  const dropAt = (x: number, y: number): Place | null => {
    const { picture, track } = targets();
    const onPicture = inside(picture, x, y);
    if (onPicture) return { on: "picture", at: { x: (x - onPicture.left) / onPicture.width, y: (y - onPicture.top) / onPicture.height } };
    const onTrack = inside(track, x, y);
    const tickWidth = Number(track?.dataset.tickWidth);
    if (onTrack && tickWidth > 0) return { on: "track", tick: Math.max(0, Math.floor((x - onTrack.left) / tickWidth)) };
    return null;
  };
  const showDrop = (place: Place | null) => {
    const { picture, track } = targets();
    if (picture) picture.dataset.dropping = String(place?.on === "picture");
    if (track) track.dataset.dropping = String(place?.on === "track");
  };

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
    showDrop(dropAt(event.clientX, event.clientY));
  };
  const end = (event: PointerEvent<HTMLButtonElement>, drop: boolean) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    setGhost(null);
    showDrop(null);
    if (!current.moved) return;
    dragged.current = true;
    const at = drop ? dropAt(event.clientX, event.clientY) : null;
    if (at) onPlace(at);
  };

  return (
    <>
      <button type="button" className={`tile${ghost ? " is-dragging" : ""}`} aria-label={label} title={title ?? `${label}: drag it onto the picture`} disabled={disabled}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={(event) => end(event, true)} onPointerCancel={(event) => end(event, false)}
        onClick={(event) => {
          if (dragged.current) { dragged.current = false; return; }
          if (event.detail === 0) onPlace(null);   // the keyboard's press (a pointer's click counts 1 or more)
        }}>
        {icon}
      </button>
      {ghost && createPortal(<div className="nsc-drag-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">{icon}</div>, document.body)}
    </>
  );
}
