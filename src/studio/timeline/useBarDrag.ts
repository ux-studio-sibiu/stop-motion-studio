"use client";

import { useRef, type PointerEvent } from "react";

const DRAG_START = 3;   // px before a press on a bar becomes a drag

export type Edge = "start" | "end";

// Pressing and dragging a bar on one of the timeline's rows in time (objects in time, sounds):
//   - a press that moves less than DRAG_START is a click: onClick;
//   - past that it's a drag: onDrag with how far it's gone, in ticks (fractions: the caller rounds),
//     and on letting go onDrop; a cancelled pointer calls onCancel.
// A press on an element with data-edge="start" or "end" drags that edge instead of the bar.
export function useBarDrag<T>({ tickWidth, onDrag, onDrop, onClick, onCancel }: {
  tickWidth: number;
  onDrag: (base: T, ticks: number, edge: Edge | null) => void;
  onDrop: (base: T, edge: Edge | null) => void;
  onClick: (base: T) => void;
  onCancel: () => void;
}) {
  const drag = useRef<{ pointerId: number; base: T; edge: Edge | null; startX: number; moved: boolean } | null>(null);

  const onPointerDown = (base: T, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const edge = ((event.target as HTMLElement).dataset.edge as Edge | undefined) ?? null;
    drag.current = { pointerId: event.pointerId, base, edge, startX: event.clientX, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    if (!current.moved && Math.abs(dx) < DRAG_START) return;
    current.moved = true;
    onDrag(current.base, dx / tickWidth, current.edge);
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (current.moved) onDrop(current.base, current.edge);
    else onClick(current.base);
  };
  const onPointerCancel = () => { drag.current = null; onCancel(); };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
