"use client";

import { useEffect, type RefObject } from "react";
import { frameIndexAt, frameStarts, inOrder, type Frame } from "@/core/model";
import { useEditor } from "@/store/useEditor";
import { timelineInset } from "./useTimelineZoom";

// The playhead on the timeline, which is the selection too: stopped, a red block behind each
// selected picture (the first is where Play starts, the last where new pictures go); while playing,
// one block on the picture playback is on, jumping from picture to picture, as the stage does. While
// playing, the timeline pages along to keep it in view.
// Its own component (step 31): it follows the playhead, which changes many times a second while
// playing, and only it redraws then, not the pictures.
export function Playhead({ frames, selection, tickWidth, scroller }: { frames: readonly Frame[]; selection: readonly string[]; tickWidth: number; scroller: RefObject<HTMLDivElement | null> }) {
  const isPlaying = useEditor((state) => state.isPlaying);
  const playhead = useEditor((state) => state.playhead);

  useEffect(() => {
    const element = scroller.current;
    if (!isPlaying || !element) return;
    const x = timelineInset(element) + playhead * tickWidth;
    if (x < element.scrollLeft || x > element.scrollLeft + element.clientWidth - 48) element.scrollTo({ left: Math.max(0, x - 48) });
  }, [isPlaying, playhead, tickWidth, scroller]);

  const starts = frameStarts(frames);
  const order = frames.map((frame) => frame.id);
  const marked = isPlaying ? (frames.length > 0 ? [frameIndexAt(frames, playhead)] : []) : inOrder(order, selection).map((id) => order.indexOf(id));
  return marked.filter((at) => frames[at]).map((at) => (
    <div key={frames[at].id} className={`playhead${isPlaying ? " is-playing" : ""}`} aria-hidden="true" style={{ left: `calc(var(--timeline-inset) + ${starts[at] * tickWidth}px)`, width: frames[at].hold * tickWidth }} />
  ));
}
