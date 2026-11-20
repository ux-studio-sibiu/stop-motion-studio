"use client";

import { useLayoutEffect, useRef, type PointerEvent } from "react";
import { useStageObjects, type ObjectSaves } from "./objectEditing";
import { ObjectSettings } from "./ObjectSettings";

const GAP = 12;      // between the object and the panel, px
const MARGIN = 8;    // the panel stays this far inside the window

type Rect = { left: number; top: number; right: number; bottom: number };

// The picked object's settings in a small panel floating by it, instead of in the side panel. It
// goes where it doesn't cover the object: below it, else above, else beside it (right, then left),
// else below anyway; and, until it's dragged, never over the toolbar or the side panel (so Undo and
// the object tiles stay in reach): between the top of the stage and the bottom of the window, left
// of the side panel, and off the timeline's buttons (clearOf). It follows the object as it moves
// or sizes. Its header drags it somewhere
// else, and it keeps that distance from the object until another object is picked. An object
// picked on the overlay track that isn't on this picture has no place on the stage: the panel
// sits by the top of the stage then.
// Fixed to the window, so the stage's clipping doesn't touch it; it's placed on every
// animation frame while shown (the object's box on screen changes with many things).
export function ObjectFloat({ saves }: { saves: ObjectSaves }) {
  const { picked } = useStageObjects();
  const id = picked?.element.id;
  const onStage = picked?.onStage ?? false;
  const panel = useRef<HTMLDivElement>(null);
  const moved = useRef({ id: undefined as string | undefined, x: 0, y: 0 });   // the drag offset, for one object
  const drag = useRef<{ pointerId: number; x: number; y: number; baseX: number; baseY: number } | null>(null);

  useLayoutEffect(() => {
    if (!id) return;
    if (moved.current.id !== id) moved.current = { id, x: 0, y: 0 };
    let frame = 0;
    const place = () => {
      frame = requestAnimationFrame(place);
      const box = panel.current;
      const stage = document.querySelector(".stage-frame")?.getBoundingClientRect();
      if (!box || !stage) return;
      const object = (onStage ? document.querySelector(`.nsc-object-editor .object[data-element="${CSS.escape(id)}"]`)?.getBoundingClientRect() : undefined) ?? new DOMRect(stage.left, stage.top, stage.width, 0);
      const { offsetWidth: width, offsetHeight: height } = box;
      const side = document.querySelector(".nsc-side-panel")?.getBoundingClientRect();
      const area = { left: MARGIN, top: stage.top, right: side?.width ? side.left - MARGIN : innerWidth - MARGIN, bottom: innerHeight - MARGIN };
      const tools = document.querySelector(".timeline-tools")?.getBoundingClientRect();
      const at = clearOf(tools, object, placeBy(object, area, width, height), area, width, height);
      const left = clamp(clamp(at.left, area.left, area.right - width) + moved.current.x, MARGIN, innerWidth - width - MARGIN);
      const top = clamp(clamp(at.top, area.top, area.bottom - height) + moved.current.y, MARGIN, innerHeight - height - MARGIN);
      box.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      box.style.visibility = "visible";
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [id, onStage]);

  if (!id) return null;

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, baseX: moved.current.x, baseY: moved.current.y };
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    moved.current = { id, x: current.baseX + event.clientX - current.x, y: current.baseY + event.clientY - current.y };
  };
  const onPointerUp = () => { drag.current = null; };

  return (
    <div ref={panel} className="nsc-object-float" style={{ visibility: "hidden" }}>
      <ObjectSettings saves={saves} header={{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, title: "Drag to move" }} />
    </div>
  );
}

// Where the panel (width × height) goes by the object, before any drag: the first place that fits
// in the area.
function placeBy(object: Rect, area: Rect, width: number, height: number): { left: number; top: number } {
  const centredX = (object.left + object.right) / 2 - width / 2;
  const centredY = (object.top + object.bottom) / 2 - height / 2;
  const below = { left: centredX, top: object.bottom + GAP };
  const above = { left: centredX, top: object.top - GAP - height };
  const right = { left: object.right + GAP, top: centredY };
  const left = { left: object.left - GAP - width, top: centredY };
  if (below.top + height <= area.bottom) return below;
  if (above.top >= area.top) return above;
  if (right.left + width <= area.right) return right;
  if (left.left >= area.left) return left;
  return below;
}

// Moved off the timeline's buttons when it would cover them (Duplicate, Delete, Add photos stay in
// reach): to their right if it fits there, else up above them, unless that covers the object (a
// big panel in a small window): then it stays. To the right first, so it stays
// below the object.
function clearOf(tools: Rect | undefined, object: Rect, at: { left: number; top: number }, area: Rect, width: number, height: number): { left: number; top: number } {
  if (!tools || tools.right <= tools.left) return at;
  const covers = (box: Rect, left: number, top: number) => left < box.right && left + width > box.left && top < box.bottom && top + height > box.top;
  if (!covers(tools, at.left, at.top)) return at;
  if (tools.right + GAP + width <= area.right) return { left: tools.right + GAP, top: at.top };
  const up = Math.max(area.top, tools.top - GAP - height);
  return covers(object, at.left, up) ? at : { left: at.left, top: up };   // never over the object itself: that matters more
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
