"use client";

import { useEffect, useState } from "react";
import { selectRange, toggleInSelection } from "@/core/model";
import { editorStore } from "@/store/useEditor";

// Selecting pictures on the timeline. A click selects one, Shift+click a range from the anchor
// (where the range started), Ctrl/Cmd+click adds or removes one. The focus is the end that moves
// (arrow keys, the screen reader's "current" picture). The selection can also change from
// elsewhere (a capture or an undo selects pictures), so both fall back to the selection's end.
export function useTimelineSelection(order: readonly string[], selection: readonly string[]) {
  const [cursor, setCursor] = useState<{ anchor: string; focus: string } | null>(null);
  const focusId = cursor && selection.includes(cursor.focus) ? cursor.focus : selection.at(-1);
  const anchorId = cursor && selection.includes(cursor.anchor) ? cursor.anchor : focusId;
  const select = editorStore.getState().select;

  const selectOnly = (id: string) => { select([id]); setCursor({ anchor: id, focus: id }); };
  const extendTo = (id: string) => { select(selectRange(order, anchorId, id)); setCursor({ anchor: anchorId ?? id, focus: id }); };
  const toggle = (id: string) => { select(toggleInSelection(order, selection, id)); setCursor({ anchor: id, focus: id }); };
  const selectAll = () => { if (order.length) { select(order); setCursor({ anchor: order[0], focus: order[order.length - 1] }); } };

  // Arrow keys: one along, stopping at the ends. Previous / next buttons: one along, round to
  // the other end. With nothing selected, forwards starts at the first picture, backwards at the last.
  const moveFocus = (direction: -1 | 1, { wrap = false, extend = false } = {}) => {
    if (order.length === 0) return;
    const current = focusId ? order.indexOf(focusId) : -1;
    const target = current < 0 ? (direction > 0 ? 0 : order.length - 1)
      : wrap ? (current + direction + order.length) % order.length
      : Math.min(order.length - 1, Math.max(0, current + direction));
    if (extend) extendTo(order[target]); else selectOnly(order[target]);
  };

  const moveFocusTo = (index: number, { extend = false } = {}) => {
    const id = order[index];
    if (!id) return;
    if (extend) extendTo(id); else selectOnly(id);
  };

  // A new focus: bring it into view.
  useEffect(() => {
    if (focusId) document.getElementById(optionId(focusId))?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusId]);

  return { focusId, selectOnly, extendTo, toggle, selectAll, moveFocus, moveFocusTo };
}

// The element id of a picture on the timeline (for aria-activedescendant).
export function optionId(frameId: string): string {
  return `frame-${frameId}`;
}
