"use client";

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { Camera, ZoomIn, ZoomOut } from "lucide-react";
import { formatSeconds, pxPerTick, rulerScale, ticksToSeconds, totalTicks, type Frame } from "@/core/model";
import { MAX_TIMELINE_ZOOM, MIN_TIMELINE_ZOOM } from "@/store/editorStore";
import { editorStore, useEditor, useOrderedFrames } from "@/store/useEditor";
import { thumbs } from "./media";

const ZOOM_STEP = 1.5;
const LABEL_MIN_WIDTH = 24;   // narrower pictures don't show their number

// The timeline, drawn to time: a picture is as wide as it lasts (hold ticks × px per tick),
// and a faint seconds ruler runs along the top. Zoom changes px per second; it's a way of
// looking, not part of the animation, so it lives in the store and isn't saved.
export function Timeline() {
  const frames = useOrderedFrames();
  const selection = useEditor((state) => state.selection);
  const fps = useEditor((state) => state.project?.fps ?? 8);
  const zoom = useEditor((state) => state.timelineZoom);

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

  // A new selection: bring it into view.
  const selectedId = selection[selection.length - 1];
  useEffect(() => {
    if (selectedId) document.getElementById(optionId(selectedId))?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId]);

  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    if (frames.length === 0) return;
    const current = frames.findIndex((frame) => frame.id === selectedId);
    const target = {
      ArrowRight: current < 0 ? 0 : Math.min(frames.length - 1, current + 1),
      ArrowLeft: current < 0 ? frames.length - 1 : Math.max(0, current - 1),
      Home: 0,
      End: frames.length - 1,
    }[event.key];
    if (target === undefined) {
      if (event.key === "Escape") editorStore.getState().clearSelection();
      return;
    }
    event.preventDefault();
    editorStore.getState().select([frames[target].id]);
  };

  const select = (id: string) => {
    editorStore.getState().select([id]);
    track.current?.focus({ preventScroll: true });   // so the arrow keys work straight after a click
  };

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="timeline-tools">
        <button type="button" className="icon-button is-small" aria-label="Zoom out" disabled={zoom <= MIN_TIMELINE_ZOOM} onClick={() => zoomTo(zoom / ZOOM_STEP)}><ZoomOut size={20} /></button>
        <button type="button" className="icon-button is-small" aria-label="Zoom in" disabled={zoom >= MAX_TIMELINE_ZOOM} onClick={() => zoomTo(zoom * ZOOM_STEP)}><ZoomIn size={20} /></button>
        <span className="duration" aria-label="Length of the animation">{seconds < 10 ? `${seconds.toFixed(1)} s` : formatSeconds(seconds)}</span>
      </div>

      <div ref={scroller} className="timeline-scroll">
        <div className="ruler" aria-hidden="true" style={{ width: rulerSeconds * zoom, backgroundSize: `${markSeconds * zoom}px 100%` }}>
          {labels.map((at) => <span key={at} className="ruler-label" style={{ left: at * zoom }}>{formatSeconds(at)}</span>)}
        </div>

        <ol ref={track} className="track" role="listbox" aria-label="Pictures" aria-orientation="horizontal" tabIndex={0} aria-activedescendant={selectedId ? optionId(selectedId) : undefined} onKeyDown={onKeyDown}>
          {frames.map((frame, index) => <FrameThumb key={frame.id} frame={frame} number={index + 1} width={frame.hold * tickWidth} selected={selection.includes(frame.id)} onSelect={select} />)}
          <li ref={next} className="next-slot" aria-hidden={frames.length > 0}>
            <Camera size={24} />
            {frames.length === 0 && <span className="next-hint">Your pictures appear here</span>}
          </li>
        </ol>
      </div>
    </section>
  );
}

// One picture, as wide as it lasts. Its thumbnail is a background repeated along the width:
// a short picture shows the middle of it (cover-cropped), a long one shows it several times.
function FrameThumb({ frame, number, width, selected, onSelect }: { frame: Frame; number: number; width: number; selected: boolean; onSelect: (id: string) => void }) {
  const url = thumbs.url(frame.imageId);
  return (
    <li id={optionId(frame.id)} role="option" aria-selected={selected} aria-label={`Picture ${number}`} className={`frame${selected ? " is-selected" : ""}`} style={{ width, backgroundImage: url ? `url("${url}")` : undefined }} onClick={() => onSelect(frame.id)}>
      {width >= LABEL_MIN_WIDTH && <span className="frame-number">{number}</span>}
    </li>
  );
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
