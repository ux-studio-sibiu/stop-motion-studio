"use client";

import { useMemo, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { moveOverlay, objectLabel, objectText, overlayEnd, overlayLanes, resizeOverlay, formatTicks, totalTicks, withOverlay, type Frame, type Overlay } from "@/core/model";
import { selectedOverlayId } from "@/store/editorStore";
import { editorStore, useEditor, useShownOverlays } from "@/store/useEditor";
import { ObjectIcon } from "../ObjectIcon";
import { commitOverlays, deleteOverlay, duplicateOverlayById, pickOverlay, previewOverlays, savedOverlays, type SaveOverlays } from "../overlayEditing";
import { saveSoon } from "../saveSoon";

const DRAG_START = 3;   // px before a press on a bar becomes a drag
type Edge = "start" | "end";
type Drag = { pointerId: number; base: Overlay; edge: Edge | null; startX: number; moved: boolean };

// The overlay track (step 24): under the pictures, on the same time scale, the objects that live
// in time. Each is a bar from when it starts to when it ends:
//   - drag the bar to move it in time, its ends to change when it starts or ends: whole ticks, one
//     undo step each;
//   - click it to pick it: it becomes the timeline's selection instead of the pictures (the toolbar's
//     Duplicate and Delete then act on it), the stage goes to the picture where it starts, and the
//     Objects tab shows its settings (it's edited on the stage like any object);
//   - with the keyboard on a bar: ← → move it, Shift with them makes it shorter or longer, Delete
//     removes it, Ctrl+D duplicates it.
// Overlapping overlays are drawn in rows so none hides another (overlayLanes); they're still one
// track. It's also where Objects tab icons are dropped to make an overlay (data-overlay-track,
// with the tick width for working out the time).
export function OverlayTrack({ frames, tickWidth, fps, onChange }: { frames: readonly Frame[]; tickWidth: number; fps: number; onChange: SaveOverlays }) {
  const overlays = useShownOverlays();
  const selectedId = useEditor(selectedOverlayId);
  const lanes = useMemo(() => overlayLanes(overlays), [overlays]);
  const rows = Math.max(1, ...Object.values(lanes).map((lane) => lane + 1));
  const drag = useRef<Drag | null>(null);
  const length = Math.max(totalTicks(frames), ...overlays.map(overlayEnd));

  const shown = (id: string) => overlays.find((overlay) => overlay.id === id);

  const onPointerDown = (overlay: Overlay, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const edge = ((event.target as HTMLElement).dataset.edge as Edge | undefined) ?? null;
    drag.current = { pointerId: event.pointerId, base: overlay, edge, startX: event.clientX, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    if (!current.moved && Math.abs(dx) < DRAG_START) return;
    current.moved = true;
    const ticks = dx / tickWidth;
    const next = current.edge ? resizeOverlay(current.base, current.edge, ticks) : moveOverlay(current.base, ticks);
    previewOverlays(withOverlay(savedOverlays(), current.base.id, next));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    const name = objectLabel(current.base.element);
    if (current.moved) commitOverlays(onChange, current.edge ? `Change when ${name} shows` : `Move ${name} in time`);
    else pickOverlay(current.base.id);
  };
  const onPointerCancel = () => { drag.current = null; editorStore.getState().clearOverlaysPreview(); };

  const onKeyDown = (overlay: Overlay, event: KeyboardEvent<HTMLDivElement>) => {
    const name = objectLabel(overlay.element);
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (step) {
      event.preventDefault();
      const now = shown(overlay.id) ?? overlay;
      const next = event.shiftKey ? resizeOverlay(now, "end", step) : moveOverlay(now, step);
      previewOverlays(withOverlay(overlays, overlay.id, next));
      saveSoon("object", `overlay:${overlay.id}:${event.shiftKey}`, () => commitOverlays(onChange, event.shiftKey ? `Change when ${name} shows` : `Move ${name} in time`));   // a run of presses is one step
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteOverlay(overlay.id, onChange);
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
      event.preventDefault();   // instead of the browser's "bookmark this page"
      duplicateOverlayById(overlay.id, onChange);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pickOverlay(overlay.id);
    }
  };

  const seconds = (ticks: number) => formatTicks(ticks, fps);
  return (
    <div className="overlay-track" data-overlay-track data-tick-width={tickWidth} role="group" aria-label="Objects in time" style={{ width: Math.max(1, length + 8) * tickWidth, "--lanes": rows } as CSSProperties}>
      {overlays.length === 0 && frames.length > 0 && <span className="overlay-hint">Drop an object here to show it over several pictures</span>}
      {overlays.map((overlay) => {
        const name = objectLabel(overlay.element);
        const text = objectText(overlay.element);
        return (
          <div key={overlay.id} role="button" tabIndex={0} className={`overlay-bar${overlay.id === selectedId ? " is-selected" : ""}`} style={{ left: overlay.start * tickWidth, width: overlay.length * tickWidth, "--lane": lanes[overlay.id] ?? 0 } as CSSProperties}
            aria-label={`${name[0].toUpperCase()}${name.slice(1)}${text ? ` "${text}"` : ""}, from ${seconds(overlay.start)} to ${seconds(overlayEnd(overlay))}`} aria-pressed={overlay.id === selectedId}
            title="Drag to move it in time, its ends to change when it starts and ends"
            onPointerDown={(event) => onPointerDown(overlay, event)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onKeyDown={(event) => onKeyDown(overlay, event)}>
            <span className="edge is-start" data-edge="start" aria-hidden="true" />
            <span className="bar-label" aria-hidden="true"><ObjectIcon kind={overlay.element.kind} size={14} /><span>{text || name}</span></span>
            <span className="edge is-end" data-edge="end" aria-hidden="true" />
          </div>
        );
      })}
    </div>
  );
}
