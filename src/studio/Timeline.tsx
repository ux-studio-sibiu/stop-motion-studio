"use client";

import { useEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { Camera, ChevronLeft, ChevronRight, CopyPlus, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { formatSeconds, inOrder, moveIds, neighbourAfterDelete, nudgeGap, pxPerTick, rulerScale, sameOrder, ticksToSeconds, totalTicks } from "@/core/model";
import { MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM, withHoldPreview } from "@/store/editorStore";
import { editorStore, useEditor, useOrderedFrames } from "@/store/useEditor";
import { DragGhost, TimelineFrame, formatHold } from "./TimelineFrame";
import { useReorder } from "./useReorder";
import { useResize, type HoldChange } from "./useResize";
import { useScrub } from "./useScrub";
import { optionId, useTimelineSelection } from "./useTimelineSelection";
import { useTimelineView } from "./useTimelineView";
import { ZOOM_STEP, useTimelineZoom } from "./useTimelineZoom";

type TimelineProps = {
  onDelete: (frameIds: readonly string[]) => void;
  onDuplicate: (frameIds: readonly string[]) => void;
  onResize: (changes: HoldChange[]) => Promise<boolean>;
  onReorder: (before: string[], after: string[], moved: string[]) => void;
};

// The timeline, drawn to time: a picture is as wide as it lasts (hold ticks × px per tick), and a
// faint seconds ruler runs along the top. This component lays it out and maps the keys; the
// behaviour lives in hooks:
//   useTimelineSelection  selecting, the focus, previous / next
//   useTimelineZoom       zoom around a point; useTimelineView remembers zoom and scroll
//   useResize             the grip on a picture's edge, [ and ]
//   useReorder            dragging pictures to a new place
//   useScrub              the playhead, scrubbing along the ruler
export function Timeline({ onDelete, onDuplicate, onResize, onReorder }: TimelineProps) {
  const saved = useOrderedFrames();
  const holdPreview = useEditor((state) => state.holdPreview);
  const frames = useMemo(() => withHoldPreview(saved, holdPreview), [saved, holdPreview]);   // with any resize in progress
  const selection = useEditor((state) => state.selection);
  const fps = useEditor((state) => state.project?.fps ?? 8);
  const projectId = useEditor((state) => state.project?.id);
  const thumbRatio = useEditor((state) => (state.project ? `${state.project.width} / ${state.project.height}` : "16 / 9"));

  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLOListElement>(null);
  const next = useRef<HTMLLIElement>(null);
  useTimelineView(scroller);
  const { zoom, zoomTo } = useTimelineZoom(scroller);

  const order = frames.map((frame) => frame.id);
  const tickWidth = pxPerTick(zoom, fps);
  const seconds = ticksToSeconds(totalTicks(frames), fps);
  const { markSeconds, labelSeconds } = rulerScale(zoom);
  const rulerSeconds = Math.ceil(seconds) + 2;   // a little past the end, under the "next" slot
  const labels = Array.from({ length: Math.floor(rulerSeconds / labelSeconds) + 1 }, (_, i) => i * labelSeconds);

  const select = useTimelineSelection(order, selection);
  const reorder = useReorder(frames, selection, tickWidth, scroller, track, onReorder);

  const onPick = (id: string, event: MouseEvent) => {
    if (reorder.takeClick()) return;   // this click ended a drag
    editorStore.getState().pause();    // picking a picture while it plays stops there
    if (event.shiftKey) select.extendTo(id);
    else if (event.ctrlKey || event.metaKey) select.toggle(id);
    else select.selectOnly(id);
    track.current?.focus({ preventScroll: true });   // so the arrow keys work straight after a click
  };

  const resize = useResize(frames, selection, tickWidth, onResize, onPick);
  const scrub = useScrub(frames, selection, tickWidth, scroller, select.selectOnly);

  // New pictures: keep the end (and the slot for the next one) in view. Not for the pictures an
  // animation opens with: there the saved view (useTimelineView) decides where it's scrolled.
  const seen = useRef<{ projectId?: string; length: number }>({ length: 0 });
  useEffect(() => {
    const opened = seen.current.projectId !== projectId;
    const grew = frames.length > seen.current.length;
    seen.current = { projectId, length: frames.length };
    if (!opened && grew) next.current?.scrollIntoView({ block: "nearest", inline: "end", behavior: "smooth" });
  }, [frames.length, projectId]);

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

  // Ctrl/Cmd + arrow: the selected pictures one place along.
  const moveSelection = (direction: -1 | 1) => {
    if (selection.length === 0) return;
    const moved = inOrder(order, selection);
    const after = moveIds(order, moved, nudgeGap(order, moved, direction));
    if (!sameOrder(order, after)) onReorder(order, after, moved);
  };

  const step = (direction: -1 | 1) => { editorStore.getState().pause(); select.moveFocus(direction, { wrap: true }); };

  // The keys, while the timeline has the keyboard. "Mod" is Ctrl, or Cmd on a Mac; Shift with
  // the arrows, Home and End grows the selection.
  const keys: Record<string, (extend: boolean) => void> = {
    "Mod+ArrowLeft": () => moveSelection(-1),
    "Mod+ArrowRight": () => moveSelection(1),
    "Mod+a": () => select.selectAll(),
    "Mod+d": () => duplicateSelection(),   // instead of the browser's "bookmark this page"
    Escape: () => { if (!resize.cancel()) editorStore.getState().clearSelection(); },   // first Escape cancels a drag
    "[": () => resize.nudge(-1),
    "]": () => resize.nudge(1),
    Delete: () => deleteSelection(),
    Backspace: () => deleteSelection(),
    ArrowLeft: (extend) => select.moveFocus(-1, { extend }),
    ArrowRight: (extend) => select.moveFocus(1, { extend }),
    Home: (extend) => select.moveFocusTo(0, { extend }),
    End: (extend) => select.moveFocusTo(order.length - 1, { extend }),
  };
  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    if (order.length === 0) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const action = keys[`${event.ctrlKey || event.metaKey ? "Mod+" : ""}${key}`];
    if (!action) return;
    event.preventDefault();
    action(event.shiftKey);
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
        <button type="button" className="icon-button is-small" aria-label="Previous picture" title="Previous picture (←)" disabled={order.length === 0} onClick={() => step(-1)}><ChevronLeft size={20} /></button>
        <button type="button" className="icon-button is-small" aria-label="Next picture" title="Next picture (→)" disabled={order.length === 0} onClick={() => step(1)}><ChevronRight size={20} /></button>
        <span className="duration" aria-label="Length of the animation">{seconds < 10 ? `${seconds.toFixed(1)} s` : formatSeconds(seconds)}</span>
      </div>

      <div ref={scroller} className="timeline-scroll">
        {scrub.playFrom !== undefined && <div className={`playhead${scrub.isPlaying ? " is-playing" : ""}`} aria-hidden="true" style={{ left: scrub.playFrom * tickWidth }} />}
        <div className="ruler" aria-hidden="true" title="Drag along here to scrub through the animation" style={{ width: rulerSeconds * zoom, backgroundSize: `${markSeconds * zoom}px 100%` }} {...scrub.rulerHandlers}>
          {labels.map((at) => <span key={at} className="ruler-label" style={{ left: at * zoom }}>{formatSeconds(at)}</span>)}
        </div>

        <ol ref={track} className="track" role="listbox" aria-label="Pictures" aria-orientation="horizontal" aria-multiselectable="true" tabIndex={0} aria-activedescendant={select.focusId ? optionId(select.focusId) : undefined} onKeyDown={onKeyDown} style={{ "--thumb-ratio": thumbRatio } as CSSProperties}>
          {frames.map((frame, index) => (
            <TimelineFrame key={frame.id} frame={frame} number={index + 1} width={frame.hold * tickWidth} selected={selection.includes(frame.id)} insertAfter={!reorder.drag && frame.id === markerId} dragging={reorder.drag?.ids.includes(frame.id) ?? false} onPick={onPick} onPress={reorder.onFramePointerDown}>
              {selection.includes(frame.id) && (
                <span className="grip" aria-hidden="true" title="Drag to make it shorter or longer ([ and ] keys)" onPointerDown={(event) => resize.onGripDown(frame.id, event)} onPointerMove={resize.onGripMove} onPointerUp={(event) => resize.onGripUp(frame.id, event)} onPointerCancel={resize.cancel} onClick={(event) => event.stopPropagation()} />
              )}
              {resize.grabbed === frame.id && <span className="hold-bubble" role="status">{formatHold(frame.hold, fps)}</span>}
            </TimelineFrame>
          ))}
          {reorder.drag && <li className="drop-marker" aria-hidden="true" style={{ left: reorder.drag.markerX }} />}
          <li ref={next} className="next-slot" aria-hidden={frames.length > 0}>
            <Camera size={24} />
            {frames.length === 0 && <span className="next-hint">Your pictures appear here</span>}
          </li>
        </ol>
      </div>
      {reorder.drag && <DragGhost drag={reorder.drag} frames={frames} />}
    </section>
  );
}
