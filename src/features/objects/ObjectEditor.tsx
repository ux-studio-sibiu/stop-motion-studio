"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { angleTo, boxCentre, boxCorners, boxPoint, bubbleProps, hasText, moveBox, objectLabel, pointInBox, resizeBox, rotateBox, SPEECH_BUBBLE, withProps, type Corner, type Element, type Point } from "@/core/model";
import { editorStore, useEditor } from "@/store/useEditor";
import { saveSoon } from "@/studio/saveSoon";
import { commitPlaced, focusObjectText, previewPlaced, removePlaced, useStageObjects, type ObjectSaves, type Placed } from "./objectEditing";
import { frameRunner, toProjectPoint, type FrameRunner } from "@/studio/stagePointer";

const CORNERS: readonly Corner[] = ["nw", "ne", "se", "sw"];   // in boxCorners' order
type Kind = "move" | "resize" | "rotate" | "tail";
type Gesture = { kind: Kind; corner?: Corner; pointerId: number; start: Point; base: Placed; startAngle: number; latest: Point; redraw: FrameRunner };

// Placing the objects on the stage (steps 23-24), while the Objects tab is open and the camera is
// off: the picture's own objects, and the overlays showing at its time. A layer over the picture,
// drawn in project pixels (the SVG's viewBox). The same for every kind of object, wherever it
// lives: click one to pick it, drag it to move it, the corners to size it, the round handle to turn
// it; Delete removes it, arrows nudge it. A speech bubble also has a dot for its tail, and Enter or
// a double-click goes to the text in the Objects tab.
// Like moving a picture (step 18), a gesture is a preview in the store until it ends, then one
// command saves it, so each is one undo step.
export function ObjectEditor({ saves }: { saves: ObjectSaves }) {
  const { frame, overlays, placed } = useStageObjects();
  const selectedId = useEditor((state) => state.selectedElement);
  const width = useEditor((state) => state.project?.width ?? 1280);
  const height = useEditor((state) => state.project?.height ?? 720);
  const layer = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  if (!frame) return null;

  const size = { width, height };
  const selected = placed.find((item) => item.element.id === selectedId);
  const handle = width / 90;   // handle radius, project px

  const toProject = (clientX: number, clientY: number): Point => toProjectPoint(layer.current, clientX, clientY, size);

  // Shows one object changed, without saving; saves what's shown as one step.
  const preview = (item: Placed, next: Element | null) => previewPlaced(frame, overlays, item, next);
  const commit = (item: Placed, label: string) => commitPlaced(frame, item, saves, label);

  const changed = (current: Gesture): Element => {
    const { start, latest } = current;
    const base = current.base.element;
    if (current.kind === "move") return { ...base, box: moveBox(base.box, latest.x - start.x, latest.y - start.y, size) };
    if (current.kind === "resize") return { ...base, box: resizeBox(base.box, current.corner!, latest.x - start.x, latest.y - start.y, size) };
    if (current.kind === "rotate") return { ...base, box: rotateBox(base.box, angleTo(boxCentre(base.box, size), latest) - current.startAngle) };
    return withProps(base, { tail: pointInBox(base.box, latest, size) });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = (event.target as globalThis.Element).closest("[data-element]") as SVGElement | null;
    const id = target?.dataset.element;
    const picked = placed.find((item) => item.element.id === id);
    if (!picked) { editorStore.getState().selectElement(null); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    editorStore.getState().pause();
    editorStore.getState().selectElement(picked.element.id);
    const kind = (target?.dataset.handle as Kind | undefined) ?? "move";
    const start = toProject(event.clientX, event.clientY);
    gesture.current = { kind, corner: target?.dataset.corner as Corner | undefined, pointerId: event.pointerId, start, base: picked, startAngle: angleTo(boxCentre(picked.element.box, size), start), latest: start, redraw: frameRunner() };
  };

  // Redraw on the next animation frame, not on every pointer event, so dragging stays smooth.
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.latest = toProject(event.clientX, event.clientY);
    current.redraw.request(() => preview(current.base, changed(current)));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    current.redraw.cancel();
    current.latest = toProject(event.clientX, event.clientY);
    preview(current.base, changed(current));
    const what = objectLabel(current.base.element);
    commit(current.base, { move: `Move ${what}`, resize: `Size ${what}`, rotate: `Turn ${what}`, tail: `Move ${what} tail` }[current.kind]);
  };

  const onPointerCancel = () => {
    const current = gesture.current;
    gesture.current = null;
    if (!current) return;
    if (current.base.overlay) editorStore.getState().clearOverlaysPreview();
    else editorStore.getState().clearElementsPreview([frame.id]);
  };

  const editText = () => { if (selected && hasText(selected.element)) focusObjectText(); };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!selected) return;
    const { element } = selected;
    const step = event.shiftKey ? 10 : 1;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (move) {
      event.preventDefault();
      preview(selected, { ...element, box: moveBox(element.box, move[0], move[1], size) });
      saveSoon("object", element.id, () => commit(selected, `Move ${objectLabel(element)}`));   // a run of presses is one undo step
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removePlaced(frame, selected, saves);
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
    <div ref={layer} className="nsc-object-editor" tabIndex={0} role="application" aria-label="Objects: drag one to move it; its corners size it, the round handle turns it, a bubble's dot moves its tail; Enter goes to its text, Delete removes it" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onKeyDown={onKeyDown} onDoubleClick={editText}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {placed.map(({ element, overlay }) => <polygon key={element.id} data-element={element.id} className={`object${overlay ? " is-overlay" : ""}${element.id === selectedId ? " is-selected" : ""}`} points={points(boxCorners(element.box, size))} />)}
        {selected && (() => {
          const { element } = selected;
          const turn = turnHandle(element);
          const tail = element.kind === SPEECH_BUBBLE && bubbleProps(element).showTail ? boxPoint(element.box, bubbleProps(element).tail, size) : null;
          return (
            <g className="handles">
              {boxCorners(element.box, size).map((corner, i) => <circle key={CORNERS[i]} data-element={element.id} data-handle="resize" data-corner={CORNERS[i]} className={`corner is-${CORNERS[i]}`} cx={corner.x} cy={corner.y} r={handle} />)}
              <line className="stem" x1={turn.from.x} y1={turn.from.y} x2={turn.at.x} y2={turn.at.y} />
              <circle data-element={element.id} data-handle="rotate" className="turn" cx={turn.at.x} cy={turn.at.y} r={handle * 1.3} />
              {tail && <circle data-element={element.id} data-handle="tail" className="tail" cx={tail.x} cy={tail.y} r={handle} />}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
