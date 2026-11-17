"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { angleTo, boxCentre, boxCorners, boxPoint, bubbleProps, moveBox, pointInBox, resizeBox, rotateBox, SPEECH_BUBBLE, withProps, type Corner, type Element, type Point } from "@/core/model";
import { editorStore, useEditor } from "@/store/useEditor";
import { saveSoon } from "@/studio/saveSoon";
import { commitObjects, focusObjectText, labelOf, previewObjects, useObjectFrame, type SaveObjects } from "./objectFrame";

const CORNERS: readonly Corner[] = ["nw", "ne", "se", "sw"];   // in boxCorners' order
type Kind = "move" | "resize" | "rotate" | "tail";
type Gesture = { kind: Kind; corner?: Corner; pointerId: number; start: Point; base: Element; startAngle: number; latest: Point; frame: number };

// Placing the objects of the picture on the stage (step 23), while the Objects tab is open and the
// camera is off. A layer over the picture, drawn in project pixels (the SVG's viewBox). The same
// for every kind of object: click one to pick it, drag it to move it, the corners to size it, the
// round handle to turn it; Delete removes it, arrows nudge it. A speech bubble also has a dot for
// its tail, and Enter or a double-click goes to its text in the Objects tab.
// Like moving a picture (step 18), a gesture is a preview in the store until it ends, then one
// command saves it, so each is one undo step.
export function ObjectEditor({ save }: { save: SaveObjects }) {
  const frame = useObjectFrame();
  const selectedId = useEditor((state) => state.selectedElement);
  const width = useEditor((state) => state.project?.width ?? 1280);
  const height = useEditor((state) => state.project?.height ?? 720);
  const element = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  if (!frame) return null;

  const size = { width, height };
  const elements = frame.elements;
  const selected = elements.find((item) => item.id === selectedId);
  const handle = width / 90;   // handle radius, project px

  const toProject = (clientX: number, clientY: number): Point => {
    const box = element.current?.getBoundingClientRect();
    if (!box || box.width === 0) return { x: 0, y: 0 };
    return { x: ((clientX - box.left) / box.width) * width, y: ((clientY - box.top) / box.height) * height };
  };

  // Shows one object changed, without saving.
  const preview = (next: Element) => previewObjects(frame.id, elements.map((item) => (item.id === next.id ? next : item)));
  const commit = (label: string) => commitObjects(frame.id, save, label);

  const changed = (current: Gesture): Element => {
    const { base, start, latest } = current;
    if (current.kind === "move") return { ...base, box: moveBox(base.box, latest.x - start.x, latest.y - start.y, size) };
    if (current.kind === "resize") return { ...base, box: resizeBox(base.box, current.corner!, latest.x - start.x, latest.y - start.y, size) };
    if (current.kind === "rotate") return { ...base, box: rotateBox(base.box, angleTo(boxCentre(base.box, size), latest) - current.startAngle) };
    return withProps(base, { tail: pointInBox(base.box, latest, size) });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = (event.target as globalThis.Element).closest("[data-element]") as SVGElement | null;
    const id = target?.dataset.element;
    const picked = elements.find((item) => item.id === id);
    if (!picked) { editorStore.getState().selectElement(null); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    editorStore.getState().pause();
    editorStore.getState().selectElement(picked.id);
    const kind = (target?.dataset.handle as Kind | undefined) ?? "move";
    const start = toProject(event.clientX, event.clientY);
    gesture.current = { kind, corner: target?.dataset.corner as Corner | undefined, pointerId: event.pointerId, start, base: picked, startAngle: angleTo(boxCentre(picked.box, size), start), latest: start, frame: 0 };
  };

  // Redraw on the next animation frame, not on every pointer event, so dragging stays smooth.
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.latest = toProject(event.clientX, event.clientY);
    if (current.frame) return;
    current.frame = requestAnimationFrame(() => { current.frame = 0; preview(changed(current)); });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (current.frame) cancelAnimationFrame(current.frame);
    current.latest = toProject(event.clientX, event.clientY);
    preview(changed(current));
    const what = labelOf(current.base);
    commit({ move: `Move ${what}`, resize: `Size ${what}`, rotate: `Turn ${what}`, tail: `Move ${what} tail` }[current.kind]);
  };

  const onPointerCancel = () => { gesture.current = null; editorStore.getState().clearElementsPreview([frame.id]); };

  const editText = () => { if (selected?.kind === SPEECH_BUBBLE) focusObjectText(); };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!selected) return;
    const step = event.shiftKey ? 10 : 1;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (move) {
      event.preventDefault();
      preview({ ...selected, box: moveBox(selected.box, move[0], move[1], size) });
      saveSoon("object", selected.id, () => commit(`Move ${labelOf(selected)}`));   // a run of presses is one undo step
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      previewObjects(frame.id, elements.filter((item) => item.id !== selected.id));
      commit(`Delete ${labelOf(selected)}`);
      editorStore.getState().selectElement(null);
    } else if (event.key === "Enter") {
      event.preventDefault();
      editText();
    } else if (event.key === "Escape") {
      editorStore.getState().selectElement(null);
    }
  };

  const points = (corners: Point[]) => corners.map((p) => `${p.x},${p.y}`).join(" ");
  const turnHandle = (object: Element): { from: Point; at: Point } => {
    const [tl, tr] = boxCorners(object.box, size);
    const centre = boxCentre(object.box, size);
    const top = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 };
    const length = Math.hypot(top.x - centre.x, top.y - centre.y) || 1;
    const out = height * 0.06;
    return { from: top, at: { x: top.x + ((top.x - centre.x) / length) * out, y: top.y + ((top.y - centre.y) / length) * out } };
  };

  return (
    <div ref={element} className="nsc-object-editor" tabIndex={0} role="application" aria-label="Objects: drag one to move it; its corners size it, the round handle turns it, a bubble's dot moves its tail; Enter goes to a bubble's text, Delete removes it" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onKeyDown={onKeyDown} onDoubleClick={editText}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {elements.map((item) => <polygon key={item.id} data-element={item.id} className={`object${item.id === selectedId ? " is-selected" : ""}`} points={points(boxCorners(item.box, size))} />)}
        {selected && (() => {
          const turn = turnHandle(selected);
          const tail = selected.kind === SPEECH_BUBBLE && bubbleProps(selected).showTail ? boxPoint(selected.box, bubbleProps(selected).tail, size) : null;
          return (
            <g className="handles">
              {boxCorners(selected.box, size).map((corner, i) => <circle key={CORNERS[i]} data-element={selected.id} data-handle="resize" data-corner={CORNERS[i]} className={`corner is-${CORNERS[i]}`} cx={corner.x} cy={corner.y} r={handle} />)}
              <line className="stem" x1={turn.from.x} y1={turn.from.y} x2={turn.at.x} y2={turn.at.y} />
              <circle data-element={selected.id} data-handle="rotate" className="turn" cx={turn.at.x} cy={turn.at.y} r={handle * 1.3} />
              {tail && <circle data-element={selected.id} data-handle="tail" className="tail" cx={tail.x} cy={tail.y} r={handle} />}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
