"use client";

import { useEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Camera, CopyPlus, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { formatSeconds, formatTicks, inOrder, objectLabel, neighbourAfterDelete, pxPerTick, rulerScale, ticksToSeconds, totalTicks } from "@/core/model";
import { MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM, selectedOverlayId, withPreview } from "@/store/editorStore";
import { editorStore, useEditor, useShownFrames, useShownOverlays } from "@/store/useEditor";
import { deleteOverlay, duplicateOverlayById, type SaveOverlays } from "../overlayEditing";
import { OverlayTrack } from "./OverlayTrack";
import { SoundTrack } from "./SoundTrack";
import type { SaveSounds } from "../soundEditing";
import { DEFAULT_LAYERS, remembered, useRememberedState } from "../remembered";
import { LayersMenu } from "./LayersMenu";
import { DragGhost, TimelineFrame } from "./TimelineFrame";
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
  onNudge: (moved: string[], direction: -1 | 1) => void;   // Ctrl+arrow: one place along, from the saved order
  onOverlays: SaveOverlays;   // the overlay track's changes (step 24)
  onSounds: SaveSounds;       // the sound row's changes (step 29b)
  onAddEmpty: () => void;     // the next-picture slot: adds an empty (see-through) picture
  addPhotos: ReactNode;       // Add photos, placed by Studio between Duplicate and Delete
  undoRedo: ReactNode;        // Undo and Redo, placed by Studio after the zoom (the arrow keys go from picture to picture)
};

// The timeline, drawn to time: a picture is as wide as it lasts (hold ticks × px per tick), and a
// faint seconds ruler runs along the top. This component lays it out and maps the keys; the
// behaviour lives in hooks:
//   useTimelineSelection  selecting, the focus, previous / next
//   useTimelineZoom       zoom around a point; useTimelineView remembers zoom and scroll
//   useResize             the grip on a picture's edge, [ and ]
//   useReorder            dragging pictures to a new place
//   useScrub              the playhead, scrubbing along the ruler
//   OverlayTrack          the objects that live in time, under the pictures (step 24)
//   SoundTrack            the sounds in time, the bottom row (step 29b)
//   LayersMenu            which of those two rows show, remembered
export function Timeline({ onDelete, onDuplicate, onResize, onReorder, onNudge, onOverlays, onSounds, onAddEmpty, addPhotos, undoRedo }: TimelineProps) {
  const shown = useShownFrames();   // with any move, brightness or object change not saved yet, for the thumbnails
  const holdPreview = useEditor((state) => state.holdPreview);
  const frames = useMemo(() => withPreview(shown, "hold", holdPreview), [shown, holdPreview]);   // and any resize in progress
  const selection = useEditor((state) => state.selection);
  // What's selected on the timeline: pictures, or a bar on the overlay track (never both). With a
  // bar, `selection` is only the picture the stage shows, drawn as "on the stage", not selected.
  const overlayId = useEditor(selectedOverlayId);
  const overlay = useShownOverlays().find((item) => item.id === overlayId);
  const fps = useEditor((state) => state.project?.fps ?? 8);
  const projectId = useEditor((state) => state.project?.id);
  const [layers, setLayers] = useRememberedState(remembered.timelineLayers, DEFAULT_LAYERS);   // the extra rows shown (LayersMenu)
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
  // The times labelled: up to the first label at or past the pictures' end (at least 1s), so a short
  // animation still shows its first second, and the scroll never grows by more than one label.
  const labels = Array.from({ length: Math.max(1, Math.ceil(seconds / labelSeconds)) + 1 }, (_, i) => i * labelSeconds);

  const select = useTimelineSelection(order, selection);
  const reorder = useReorder(frames, selection, tickWidth, scroller, track, onReorder);

  const onPick = (id: string, event: MouseEvent) => {
    if (reorder.takeClick()) return;   // this click ended a drag
    const state = editorStore.getState();
    state.pause();    // picking a picture while it plays stops there
    // From the Camera tab (the stage shows the camera there, not the picture), the Picture tab
    // opens, so the picture picked shows on the stage, ready to adjust; the camera turns off with
    // it, even while shooting (the user's call: to pick where new pictures go and keep shooting,
    // select with the keys). The picture's other tabs (Objects, Draw) and Sounds stay as they are.
    if ((state.panelTab ?? "camera") === "camera") state.setPanelTab("picture");
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

  // The toolbar's Duplicate and Delete act on what's selected: the bar, or the pictures.
  const duplicateSelected = () => (overlay ? duplicateOverlayById(overlay.id, onOverlays) : duplicateSelection());
  const deleteSelected = () => (overlay ? deleteOverlay(overlay.id, onOverlays) : deleteSelection());

  // Ctrl/Cmd + arrow: the selected pictures one place along. The command works out the place
  // from the saved order when it runs, so quick presses add up even before the screen catches up.
  const moveSelection = (direction: -1 | 1) => { if (selection.length > 0) onNudge(inOrder(order, selection), direction); };


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
  // ← and → go from picture to picture also when nothing has the keyboard (after a click on the
  // stage's background, say). When something does (the timeline, a field, the picture or an object
  // being moved on the stage), it decides what the arrows do.
  const arrows = useRef({ order, moveFocus: select.moveFocus });
  useEffect(() => { arrows.current = { order, moveFocus: select.moveFocus }; });
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (document.activeElement && document.activeElement !== document.body) return;
      if (arrows.current.order.length === 0) return;
      event.preventDefault();
      editorStore.getState().pause();
      arrows.current.moveFocus(event.key === "ArrowLeft" ? -1 : 1, { extend: event.shiftKey });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
  const count = overlay ? 1 : selection.length;
  const pictures = overlay ? objectLabel(overlay.element) : count > 1 ? `${count} pictures` : "picture";

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="timeline-tools">
        <LayersMenu layers={layers} onChange={setLayers} />
        <span className="tools-gap" />
        <button type="button" className="icon-button is-small" aria-label="Zoom out" disabled={zoom <= MIN_TIMELINE_ZOOM} onClick={() => zoomTo(zoom / ZOOM_STEP)}><ZoomOut size={20} /></button>
        <button type="button" className="icon-button is-small" aria-label="Zoom in" disabled={zoom >= MAX_TIMELINE_ZOOM} onClick={() => zoomTo(zoom * ZOOM_STEP)}><ZoomIn size={20} /></button>
        <span className="tools-gap" />
        {undoRedo}
        <span className="tools-gap" />
        <button type="button" className="icon-button is-small" aria-label={`Duplicate ${pictures}`} title={`Duplicate ${pictures} (Ctrl + D)`} disabled={count === 0} onClick={duplicateSelected}><CopyPlus size={20} /></button>
        {addPhotos}
        <button type="button" className="icon-button is-small" aria-label={`Delete ${pictures}`} title={`Delete ${pictures} (Delete key)`} disabled={count === 0} onClick={deleteSelected}><Trash2 size={20} /></button>
      </div>

      <div ref={scroller} className="timeline-scroll">
        {scrub.marks.map((mark) => <div key={mark.id} className={`playhead${scrub.isPlaying ? " is-playing" : ""}`} aria-hidden="true" style={{ left: `calc(var(--timeline-inset) + ${mark.start * tickWidth}px)`, width: mark.ticks * tickWidth }} />)}
        <div className={`ruler${layers.ruler ? " has-gradations" : ""}`} aria-hidden="true" title="Drag along here to scrub through the animation" style={{ backgroundSize: `${markSeconds * zoom}px 6px, 100% 1px` }} {...scrub.rulerHandlers}>
          {layers.ruler && labels.map((at) => <span key={at} className="ruler-label" style={{ left: at * zoom }}>{formatSeconds(at)}</span>)}
        </div>

        <ol ref={track} className="track" role="listbox" aria-label="Pictures" aria-orientation="horizontal" aria-multiselectable="true" tabIndex={0} aria-activedescendant={select.focusId ? optionId(select.focusId) : undefined} onKeyDown={onKeyDown} style={{ "--thumb-ratio": thumbRatio } as CSSProperties}>
          {frames.map((frame, index) => (
            <TimelineFrame key={frame.id} frame={frame} number={index + 1} width={frame.hold * tickWidth} selected={!overlay && selection.includes(frame.id)} onStage={Boolean(overlay) && selection.includes(frame.id)} dragging={reorder.drag?.ids.includes(frame.id) ?? false} onPick={onPick} onPress={reorder.onFramePointerDown}>
              {!overlay && selection.includes(frame.id) && (
                <span className="grip" aria-hidden="true" title="Drag to make it shorter or longer ([ and ] keys)" onPointerDown={(event) => resize.onGripDown(frame.id, event)} onPointerMove={resize.onGripMove} onPointerUp={(event) => resize.onGripUp(frame.id, event)} onPointerCancel={resize.cancel} onClick={(event) => event.stopPropagation()} />
              )}
              {resize.grabbed === frame.id && <span className="hold-bubble" role="status">{formatTicks(frame.hold, fps)}</span>}
            </TimelineFrame>
          ))}
          {reorder.drag && <li className="drop-marker" aria-hidden="true" style={{ left: reorder.drag.markerX }} />}
          {/* Where the next picture goes; pressed, it adds an empty (see-through) picture there. */}
          <li ref={next} className="next-slot" role="presentation">
            <button type="button" className="next-button" aria-label="Add an empty picture" title="Add an empty picture: see-through, for a title or a drawing" onClick={onAddEmpty}>
              <Camera size={24} aria-hidden="true" />
              {frames.length === 0 && <span className="next-hint">Your pictures appear here</span>}
            </button>
          </li>
        </ol>

        {layers.objects && <OverlayTrack frames={frames} tickWidth={tickWidth} fps={fps} onChange={onOverlays} />}
        {layers.sounds && <SoundTrack frames={frames} tickWidth={tickWidth} fps={fps} onChange={onSounds} />}
      </div>
      {reorder.drag && <DragGhost drag={reorder.drag} frames={frames} />}
    </section>
  );
}
