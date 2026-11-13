"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Camera, CopyPlus, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { formatSeconds, inOrder, neighbourAfterDelete, pxPerTick, rulerScale, selectRange, ticksToSeconds, toggleInSelection, totalTicks, type Frame } from "@/core/model";
import { MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM, withHoldPreview } from "@/store/editorStore";
import { editorStore, useEditor, useOrderedFrames } from "@/store/useEditor";
import { thumbs } from "./media";
import { useResize, type HoldChange } from "./useResize";
import { useZoomPreference } from "./useZoomPreference";

const ZOOM_STEP = 1.5;
const LABEL_MIN_WIDTH = 24;   // narrower pictures don't show their number

// The timeline, drawn to time: a picture is as wide as it lasts (hold ticks × px per tick),
// and a faint seconds ruler runs along the top. Zoom changes px per second; it's a way of
// looking, not part of the animation, so it lives in the store and is remembered per device
// (useZoomPreference), not saved in the project.
export function Timeline({ onDelete, onDuplicate, onResize }: { onDelete: (frameIds: readonly string[]) => void; onDuplicate: (frameIds: readonly string[]) => void; onResize: (changes: HoldChange[]) => Promise<boolean> }) {
  const saved = useOrderedFrames();
  const holdPreview = useEditor((state) => state.holdPreview);
  const frames = useMemo(() => withHoldPreview(saved, holdPreview), [saved, holdPreview]);   // with any resize in progress
  const selection = useEditor((state) => state.selection);
  const fps = useEditor((state) => state.project?.fps ?? 8);
  const zoom = useEditor((state) => state.timelineZoom);
  const thumbRatio = useEditor((state) => (state.project ? `${state.project.width} / ${state.project.height}` : "16 / 9"));
  useZoomPreference();

  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLOListElement>(null);
  const next = useRef<HTMLLIElement>(null);
  const anchor = useRef<{ seconds: number; x: number } | null>(null);

  const tickWidth = pxPerTick(zoom, fps);
  const seconds = ticksToSeconds(totalTicks(frames), fps);
  const { markSeconds, labelSeconds } = rulerScale(zoom);
  const rulerSeconds = Math.ceil(seconds) + 2;   // a little past the end, under the "next" slot
  const labels = Array.from({ length: Math.floor(rulerSeconds / labelSeconds) + 1 }, (_, i) => i * labelSeconds);

  // Zoom around a point in time: whatever was under the pointer (or the selection) stays put.
  const zoomTo = (pxPerSecond: number, x?: number) => {
    const element = scroller.current;
    if (!element) return;
    const at = x ?? anchorX(element);
    anchor.current = { seconds: (element.scrollLeft + at) / zoom, x: at };
    editorStore.getState().setTimelineZoom(pxPerSecond);
  };

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || !anchor.current) return;
    element.scrollLeft = anchor.current.seconds * zoom - anchor.current.x;
    anchor.current = null;
  }, [zoom]);

  // Ctrl/Cmd + wheel zooms. A native listener, because React's wheel events are passive and
  // can't stop the browser's own page zoom.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const current = editorStore.getState().timelineZoom;
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomAt(current * factor, event.clientX - element.getBoundingClientRect().left);
    };
    const zoomAt = (pxPerSecond: number, x: number) => {
      anchor.current = { seconds: (element.scrollLeft + x) / editorStore.getState().timelineZoom, x };
      editorStore.getState().setTimelineZoom(pxPerSecond);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  // New pictures: keep the end (and the slot for the next one) in view.
  useEffect(() => {
    next.current?.scrollIntoView({ block: "nearest", inline: "end", behavior: "smooth" });
  }, [frames.length]);

  // Selection: a click selects one picture, Shift+click a range from the anchor (where the
  // range started), Ctrl/Cmd+click adds or removes one. The focus is the end that moves
  // (arrow keys, the screen reader's "current" picture). The selection can also change from
  // elsewhere (a capture or undo selects pictures), so both fall back to the selection's end.
  const order = frames.map((frame) => frame.id);
  const [cursor, setCursor] = useState<{ anchor: string; focus: string } | null>(null);
  const focusId = cursor && selection.includes(cursor.focus) ? cursor.focus : selection.at(-1);
  const anchorId = cursor && selection.includes(cursor.anchor) ? cursor.anchor : focusId;

  const selectOnly = (id: string) => { editorStore.getState().select([id]); setCursor({ anchor: id, focus: id }); };
  const extendTo = (id: string) => { editorStore.getState().select(selectRange(order, anchorId, id)); setCursor({ anchor: anchorId ?? id, focus: id }); };
  const toggle = (id: string) => { editorStore.getState().select(toggleInSelection(order, selection, id)); setCursor({ anchor: id, focus: id }); };

  // A new focus: bring it into view.
  useEffect(() => {
    if (focusId) document.getElementById(optionId(focusId))?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusId]);

  // Delete moves the selection to the neighbour straight away, before the save comes back, so
  // pressing Delete quickly several times deletes one picture after another. Pictures being
  // deleted but still on screen are skipped as neighbours.
  const deleting = useRef(new Set<string>());
  const deleteSelection = () => {
    if (selection.length === 0) return;
    const shown = new Set(order);
    for (const id of deleting.current) if (!shown.has(id)) deleting.current.delete(id);
    const remaining = order.filter((id) => !deleting.current.has(id));
    selection.forEach((id) => deleting.current.add(id));
    const neighbour = neighbourAfterDelete(remaining, selection);
    editorStore.getState().select(neighbour ? [neighbour] : []);
    onDelete(selection);
  };

  const duplicateSelection = () => { if (selection.length > 0) onDuplicate(selection); };

  const onPick = (id: string, event: MouseEvent) => {
    if (event.shiftKey) extendTo(id);
    else if (event.ctrlKey || event.metaKey) toggle(id);
    else selectOnly(id);
    track.current?.focus({ preventScroll: true });   // so the arrow keys work straight after a click
  };

  const resize = useResize(frames, selection, tickWidth, onResize, onPick);

  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    if (order.length === 0) return;
    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (command && key === "a") {
      event.preventDefault();
      editorStore.getState().select(order);
      setCursor({ anchor: order[0], focus: order[order.length - 1] });
      return;
    }
    if (command && key === "d") {
      event.preventDefault();   // not the browser's "bookmark this page"
      duplicateSelection();
      return;
    }
    if (event.key === "Escape") {
      if (!resize.cancel()) editorStore.getState().clearSelection();   // first Escape cancels a drag
      return;
    }
    if (event.key === "[" || event.key === "]") {
      event.preventDefault();
      resize.nudge(event.key === "]" ? 1 : -1);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelection();
      return;
    }
    const current = focusId ? order.indexOf(focusId) : -1;
    const target = {
      ArrowRight: current < 0 ? 0 : Math.min(order.length - 1, current + 1),
      ArrowLeft: current < 0 ? order.length - 1 : Math.max(0, current - 1),
      Home: 0,
      End: order.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    if (event.shiftKey) extendTo(order[target]); else selectOnly(order[target]);
  };

  // The next capture goes after the rightmost selected picture. When that isn't the last one,
  // a marker on its right edge shows where.
  const insertAfter = inOrder(order, selection).at(-1);
  const markerId = insertAfter !== order[order.length - 1] ? insertAfter : undefined;
  const count = selection.length;
  const pictures = count > 1 ? `${count} pictures` : "picture";

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="timeline-tools">
        <button type="button" className="icon-button is-small" aria-label="Zoom out" disabled={zoom <= MIN_TIMELINE_ZOOM} onClick={() => zoomTo(zoom / ZOOM_STEP)}><ZoomOut size={20} /></button>
        <button type="button" className="icon-button is-small" aria-label="Zoom in" disabled={zoom >= MAX_TIMELINE_ZOOM} onClick={() => zoomTo(zoom * ZOOM_STEP)}><ZoomIn size={20} /></button>
        <span className="tools-gap" />
        <button type="button" className="icon-button is-small" aria-label={`Duplicate ${pictures}`} title={`Duplicate ${pictures} (Ctrl + D)`} disabled={count === 0} onClick={duplicateSelection}><CopyPlus size={20} /></button>
        <button type="button" className="icon-button is-small" aria-label={`Delete ${pictures}`} title={`Delete ${pictures} (Delete key)`} disabled={count === 0} onClick={deleteSelection}><Trash2 size={20} /></button>
        <span className="duration" aria-label="Length of the animation">{seconds < 10 ? `${seconds.toFixed(1)} s` : formatSeconds(seconds)}</span>
      </div>

      <div ref={scroller} className="timeline-scroll">
        <div className="ruler" aria-hidden="true" style={{ width: rulerSeconds * zoom, backgroundSize: `${markSeconds * zoom}px 100%` }}>
          {labels.map((at) => <span key={at} className="ruler-label" style={{ left: at * zoom }}>{formatSeconds(at)}</span>)}
        </div>

        <ol ref={track} className="track" role="listbox" aria-label="Pictures" aria-orientation="horizontal" aria-multiselectable="true" tabIndex={0} aria-activedescendant={focusId ? optionId(focusId) : undefined} onKeyDown={onKeyDown} style={{ "--thumb-ratio": thumbRatio } as CSSProperties}>
          {frames.map((frame, index) => (
            <FrameThumb key={frame.id} frame={frame} number={index + 1} width={frame.hold * tickWidth} selected={selection.includes(frame.id)} insertAfter={frame.id === markerId} onPick={onPick}>
              {selection.includes(frame.id) && (
                <span className="grip" aria-hidden="true" title="Drag to make it shorter or longer ([ and ] keys)" onPointerDown={(event) => resize.onGripDown(frame.id, event)} onPointerMove={resize.onGripMove} onPointerUp={(event) => resize.onGripUp(frame.id, event)} onPointerCancel={resize.cancel} onClick={(event) => event.stopPropagation()} />
              )}
              {resize.grabbed === frame.id && <span className="hold-bubble" role="status">{formatHold(frame.hold, fps)}</span>}
            </FrameThumb>
          ))}
          <li ref={next} className="next-slot" aria-hidden={frames.length > 0}>
            <Camera size={24} />
            {frames.length === 0 && <span className="next-hint">Your pictures appear here</span>}
          </li>
        </ol>
      </div>
    </section>
  );
}

// One picture, as wide as it lasts. The slot (the <li>) is exactly that wide; inside it the
// picture leaves a small gap at its end, so pictures look separate while every one still starts
// exactly at its time on the ruler. The thumbnail is shown once: a short picture shows the
// middle of it (cover-cropped), a long one shows it at the start and a dotted outline for the
// rest of its time.
// Children: the resize grip and its bubble, when selected.
function FrameThumb({ frame, number, width, selected, insertAfter, onPick, children }: { frame: Frame; number: number; width: number; selected: boolean; insertAfter: boolean; onPick: (id: string, event: MouseEvent) => void; children?: ReactNode }) {
  const url = thumbs.url(frame.imageId);
  const className = `frame${selected ? " is-selected" : ""}${insertAfter ? " is-insert-point" : ""}`;
  return (
    <li id={optionId(frame.id)} role="option" aria-selected={selected} aria-label={`Picture ${number}`} className={className} style={{ width }} onClick={(event) => onPick(frame.id, event)}>
      <span className="picture">
        <span className="thumb" style={{ backgroundImage: url ? `url("${url}")` : undefined }} />
        {width >= LABEL_MIN_WIDTH && <span className="frame-number">{number}</span>}
      </span>
      {children}
    </li>
  );
}

// A picture's length for the drag bubble: "1.5 s", "0.13 s", "2 s".
function formatHold(hold: number, fps: number): string {
  return `${Number(ticksToSeconds(hold, fps).toFixed(2))} s`;
}

function optionId(frameId: string): string {
  return `frame-${frameId}`;
}

// Zoom buttons keep the selected picture in place, or the middle of the view.
function anchorX(element: HTMLDivElement): number {
  const selected = element.querySelector<HTMLElement>(".frame.is-selected");
  if (selected) return selected.offsetLeft + selected.offsetWidth / 2 - element.scrollLeft;
  return element.clientWidth / 2;
}
