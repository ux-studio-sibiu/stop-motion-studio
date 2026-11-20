"use client";

import { useMemo, type CSSProperties, type KeyboardEvent } from "react";
import { laneCount, moveOverlay, objectLabel, objectText, overlayEnd, overlayLanes, resizeOverlay, formatTicks, totalTicks, withOverlay, type Frame, type Overlay } from "@/core/model";
import { selectedOverlayId } from "@/store/editorStore";
import { editorStore, useEditor, useShownOverlays } from "@/store/useEditor";
import { ObjectIcon } from "../ObjectIcon";
import { commitOverlays, deleteOverlay, duplicateOverlayById, pickOverlay, previewOverlays, savedOverlays, type SaveOverlays } from "../overlayEditing";
import { saveSoon } from "../saveSoon";
import { useBarDrag } from "./useBarDrag";

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
  const rows = laneCount(lanes);
  const length = Math.max(totalTicks(frames), ...overlays.map(overlayEnd));

  const shown = (id: string) => overlays.find((overlay) => overlay.id === id);

  const bar = useBarDrag<Overlay>({
    tickWidth,
    onDrag: (base, ticks, edge) => previewOverlays(withOverlay(savedOverlays(), base.id, edge ? resizeOverlay(base, edge, ticks) : moveOverlay(base, ticks))),
    onDrop: (base, edge) => { const name = objectLabel(base.element); commitOverlays(onChange, edge ? `Change when ${name} shows` : `Move ${name} in time`); },
    onClick: (base) => pickOverlay(base.id),
    onCancel: () => editorStore.getState().clearOverlaysPreview(),
  });

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
    <div className="overlay-track" data-overlay-track data-tick-width={tickWidth} role="group" aria-label="Objects Layer" style={{ width: Math.max(1, length + 8) * tickWidth, "--lanes": rows } as CSSProperties}>
      {overlays.length === 0 && frames.length > 0 && <span className="track-hint">Drop an object here to show it over several pictures</span>}
      {overlays.map((overlay) => {
        const name = objectLabel(overlay.element);
        const text = objectText(overlay.element);
        return (
          <div key={overlay.id} role="button" tabIndex={0} className={`overlay-bar${overlay.id === selectedId ? " is-selected" : ""}`} style={{ left: overlay.start * tickWidth, width: overlay.length * tickWidth, "--lane": lanes[overlay.id] ?? 0 } as CSSProperties}
            aria-label={`${name[0].toUpperCase()}${name.slice(1)}${text ? ` "${text}"` : ""}, from ${seconds(overlay.start)} to ${seconds(overlayEnd(overlay))}`} aria-pressed={overlay.id === selectedId}
            title="Drag to move it in time, its ends to change when it starts and ends"
            onPointerDown={(event) => bar.onPointerDown(overlay, event)} onPointerMove={bar.onPointerMove} onPointerUp={bar.onPointerUp} onPointerCancel={bar.onPointerCancel} onKeyDown={(event) => onKeyDown(overlay, event)}>
            <span className="edge is-start" data-edge="start" aria-hidden="true" />
            <span className="bar-label" aria-hidden="true"><ObjectIcon kind={overlay.element.kind} size={14} /><span>{text || name}</span></span>
            <span className="edge is-end" data-edge="end" aria-hidden="true" />
          </div>
        );
      })}
    </div>
  );
}
