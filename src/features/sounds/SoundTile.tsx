"use client";

import { Music } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { previewSound } from "@/adapters/sound/sound";
import { editorStore } from "@/store/useEditor";
import { DEFAULT_LAYERS, remembered, saveRemembered } from "@/studio/remembered";

const DRAG_START = 6;   // px the pointer moves before a press becomes a drag

// Where a sound was dropped: on the stage (at the picture it shows), or on the Sound Layer at a tick.
export type SoundPlace = { on: "stage" } | { on: "track"; tick: number };

// One sound in the Sounds tab, as a small pill: a click (or Enter) plays it, so a child can hear it
// first; dragging it onto the stage or onto the Sound Layer adds it there (onPlace). As soon as a
// drag starts, a hidden Sound Layer is shown, so it can be dropped on too. Pointer events, not HTML
// drag and drop, so it works with a finger on a tablet; the pill follows the pointer meanwhile and
// the place it would land lights up.
export function SoundTile({ id, name, disabled = false, onPlace }: { id: string; name: string; disabled?: boolean; onPlace: (place: SoundPlace) => void }) {
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const dragged = useRef(false);   // the click that follows a drag isn't a click

  const targets = () => ({ stage: document.querySelector<HTMLElement>(".stage-frame"), track: document.querySelector<HTMLElement>(".sound-track") });
  const inside = (element: HTMLElement | null, x: number, y: number) => {
    const box = element?.getBoundingClientRect();
    return box && box.width > 0 && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom ? box : null;
  };
  const dropAt = (x: number, y: number): SoundPlace | null => {
    const { stage, track } = targets();
    if (inside(stage, x, y)) return { on: "stage" };
    const onTrack = inside(track, x, y);
    const tickWidth = Number(track?.dataset.tickWidth);
    if (onTrack && tickWidth > 0) return { on: "track", tick: Math.max(0, Math.floor((x - onTrack.left) / tickWidth)) };
    return null;
  };
  const showDrop = (place: SoundPlace | null) => {
    const { stage, track } = targets();
    if (stage) stage.dataset.soundDropping = String(place?.on === "stage");
    if (track) track.dataset.dropping = String(place?.on === "track");
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_START) return;
    if (!current.moved) {   // the drag starts: make sure the Sound Layer is there to drop on
      const id = editorStore.getState().project?.id;   // this animation's rows
      const layers = (id && remembered.timelineLayers(id).read()) || DEFAULT_LAYERS;
      if (id && !layers.sounds) saveRemembered(remembered.timelineLayers(id), { ...layers, sounds: true });
    }
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
      <button type="button" className={`icon-button is-small sound-tile${ghost ? " is-dragging" : ""}`} title={`${name}: click to hear it, drag it onto the stage or the Sound Layer to add it`} disabled={disabled}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={(event) => end(event, true)} onPointerCancel={(event) => end(event, false)}
        onClick={() => { if (dragged.current) { dragged.current = false; return; } previewSound(id); }}>
        <Music size={14} aria-hidden="true" />{name}
      </button>
      {ghost && <span className="nsc-sound-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true"><Music size={14} />{name}</span>}
    </>
  );
}
