"use client";

import type { MouseEvent, PointerEvent, ReactNode } from "react";
import type { Frame } from "@/core/model";
import { Thumb } from "./Thumb";
import type { Drag } from "./useReorder";
import { optionId } from "./useTimelineSelection";

const LABEL_MIN_WIDTH = 24;   // narrower pictures don't show their number

// One picture, as wide as it lasts. The slot (the <li>) is exactly that wide; inside it the
// picture leaves a small gap at its end, so pictures look separate while every one still starts
// exactly at its time on the ruler. The thumbnail (Thumb: the picture as the stage shows it) is
// shown once: a short picture shows the middle of it, a long one shows it at the start and a dotted outline for the
// rest of its time. Children: the resize grip and its bubble, when selected.
type TimelineFrameProps = {
  frame: Frame;
  number: number;
  width: number;
  selected: boolean;
  onStage?: boolean;   // the picture the stage shows while an overlay is the selection (step 24)
  insertAfter: boolean;
  dragging: boolean;
  onPick: (id: string, event: MouseEvent) => void;
  onPress: (id: string, event: PointerEvent<HTMLElement>) => void;
  children?: ReactNode;
};

export function TimelineFrame({ frame, number, width, selected, onStage = false, insertAfter, dragging, onPick, onPress, children }: TimelineFrameProps) {
  const className = `frame${selected ? " is-selected" : ""}${onStage ? " is-on-stage" : ""}${insertAfter ? " is-insert-point" : ""}${dragging ? " is-dragging" : ""}${frame.empty ? " is-empty" : ""}`;   // is-empty: a checkerboard behind the see-through picture
  return (
    <li id={optionId(frame.id)} role="option" aria-selected={selected} aria-current={onStage || undefined} aria-label={`Picture ${number}`} className={className} style={{ width }} onClick={(event) => onPick(frame.id, event)} onPointerDown={(event) => onPress(frame.id, event)}>
      <span className="picture">
        <Thumb frame={frame} />
        {width >= LABEL_MIN_WIDTH && <span className="frame-number">{number}</span>}
      </span>
      {children}
    </li>
  );
}

// The small copy that follows the pointer while reordering: always thumbnail-sized, however
// long the pictures are, with a count when several move together.
export function DragGhost({ drag, frames }: { drag: Drag; frames: readonly Frame[] }) {
  const first = frames.find((frame) => frame.id === drag.ids[0]);
  return (
    <div className="drag-ghost" aria-hidden="true" style={{ left: drag.x, top: drag.y }}>
      {first && <Thumb frame={first} />}
      {drag.ids.length > 1 && <span className="drag-count">{drag.ids.length}</span>}
    </div>
  );
}

