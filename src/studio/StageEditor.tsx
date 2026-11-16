"use client";

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { angleTo, moveBy, rotateBy, scaleAround, type Point, type Transform } from "@/core/model";
import { applyMatrix, containSize, frameMatrix } from "@/core/render";
import { useEditor, useOrderedFrames, editorStore } from "@/store/useEditor";
import { withTransformPreview } from "@/store/editorStore";
import { bitmaps } from "./media";
import { cancelPreview, commitPreview, commitSoon, previewEach, shownTransform, useEditTargets, type SaveTransforms } from "./transformEditing";

const HANDLE_DISTANCE = 70;   // project px in from the picture's top edge
const HANDLE_RADIUS = 26;
// Direct editing on the stage, over the picture (camera off): drag to move, the round handle to
// turn, the wheel to size around the pointer; with the keyboard, arrows nudge 1 project pixel
// (Shift: 10) and + / - size around the centre. Several selected pictures move together.
// Positions are worked out in project pixels: the stage canvas is the project's size scaled to
// fit, so a pointer movement is converted with the canvas's on-screen size.
export function StageEditor({ save }: { save: SaveTransforms }) {
  const targets = useEditTargets();
  const saved = useOrderedFrames();
  const preview = useEditor((state) => state.transformPreview);
  const width = useEditor((state) => state.project?.width ?? 1280);
  const height = useEditor((state) => state.project?.height ?? 720);
  const element = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ kind: "move" | "turn"; pointerId: number; start: Point; base: Record<string, Transform>; startAngle: number; latest: Point; frame: number } | null>(null);
  const size = { width, height };

  // Screen → project pixels.
  const toProject = (clientX: number, clientY: number): Point => {
    const box = element.current?.getBoundingClientRect();
    if (!box || box.width === 0) return { x: 0, y: 0 };
    return { x: ((clientX - box.left) / box.width) * width, y: ((clientY - box.top) / box.height) * height };
  };

  const frames = withTransformPreview(saved, preview);
  const outlines = targets.flatMap((id) => {
    const frame = frames.find((candidate) => candidate.id === id);
    if (!frame) return [];
    const image = bitmaps.get(frame.imageId);
    const fit = containSize(image?.width ?? width, image?.height ?? height, width, height);
    const m = frameMatrix(frame.transform, fit, size);
    return [{ id, corners: [applyMatrix(m, 0, 0), applyMatrix(m, fit.width, 0), applyMatrix(m, fit.width, fit.height), applyMatrix(m, 0, fit.height)] }];
  });
  const first = outlines[0];
  const centre = first && { x: (first.corners[0].x + first.corners[2].x) / 2, y: (first.corners[0].y + first.corners[2].y) / 2 };
  const handle = first && centre && (() => {
    const top = { x: (first.corners[0].x + first.corners[1].x) / 2, y: (first.corners[0].y + first.corners[1].y) / 2 };
    const length = Math.hypot(top.x - centre.x, top.y - centre.y) || 1;
    // Inside the picture, just below its top edge: above it would be outside the stage (which
    // clips) whenever the picture fills the stage, and then it couldn't be seen or grabbed.
    const inward = Math.min(HANDLE_DISTANCE, length / 2);
    return { top, at: { x: top.x - ((top.x - centre.x) / length) * inward, y: top.y - ((top.y - centre.y) / length) * inward } };
  })();

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || targets.length === 0) return;
    const start = toProject(event.clientX, event.clientY);
    const kind = (event.target as Element).closest("[data-handle]") ? "turn" : "move";
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    editorStore.getState().pause();
    const base = Object.fromEntries(targets.flatMap((id) => { const t = shownTransform(id); return t ? [[id, t]] : []; }));
    gesture.current = { kind, pointerId: event.pointerId, start, base, startAngle: centre ? angleTo(centre, start) : 0, latest: start, frame: 0 };
  };

  // Redraw on the next animation frame, not on every pointer event, so dragging stays smooth.
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.latest = toProject(event.clientX, event.clientY);
    if (current.frame) return;
    current.frame = requestAnimationFrame(() => {
      current.frame = 0;
      const { latest, start, base } = current;
      if (current.kind === "move") previewEach(targets, (t) => moveBy(t, latest.x - start.x, latest.y - start.y, size), base);
      else if (centre) previewEach(targets, (t) => rotateBy(t, angleTo(centre, latest) - current.startAngle), base);
    });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.frame) cancelAnimationFrame(current.frame);
    gesture.current = null;
    const { latest, start, base } = current;
    if (current.kind === "move") previewEach(targets, (t) => moveBy(t, latest.x - start.x, latest.y - start.y, size), base);
    else if (centre) previewEach(targets, (t) => rotateBy(t, angleTo(centre, latest) - current.startAngle), base);
    commitPreview(targets, current.kind === "move" ? "Move picture" : "Turn picture", save);
  };

  const onPointerCancel = () => { gesture.current = null; cancelPreview(targets); };

  // The wheel sizes around the pointer. A native listener, because React's wheel events can't
  // stop the page from scrolling.
  const latest = useRef({ targets, toProject, size, save });
  useEffect(() => { latest.current = { targets, toProject, size, save }; });
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      const { targets, toProject, size, save } = latest.current;
      if (targets.length === 0) return;
      event.preventDefault();
      const point = toProject(event.clientX, event.clientY);
      previewEach(targets, (t) => scaleAround(t, Math.exp(-event.deltaY * 0.0015), point, size));
      commitSoon(targets, "Size picture", save);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (targets.length === 0) return;
    const step = event.shiftKey ? 10 : 1;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    const grow = { "+": 1.1, "=": 1.1, "-": 1 / 1.1 }[event.key];
    if (move) {
      event.preventDefault();
      previewEach(targets, (t) => moveBy(t, move[0], move[1], size));
      commitSoon(targets, "Move picture", save);
    } else if (grow) {
      event.preventDefault();
      previewEach(targets, (t) => scaleAround(t, grow, { x: size.width / 2 + t.x * size.width, y: size.height / 2 + t.y * size.height }, size));
      commitSoon(targets, "Size picture", save);
    } else if (event.key === "Escape") {
      cancelPreview(targets);
    }
  };

  if (targets.length === 0) return null;
  return (
    <div ref={element} className="stage-editor" tabIndex={0} role="application" aria-label="Move the picture: drag it, turn it with the round handle, size it with the wheel; arrow keys nudge, + and - size" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onKeyDown={onKeyDown}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {outlines.map(({ id, corners }) => <polygon key={id} className="outline" points={corners.map((p) => `${p.x},${p.y}`).join(" ")} />)}
        {handle && (
          <g data-handle="turn" className="turn-handle">
            <line x1={handle.top.x} y1={handle.top.y} x2={handle.at.x} y2={handle.at.y} />
            <circle cx={handle.at.x} cy={handle.at.y} r={HANDLE_RADIUS} />
          </g>
        )}
      </svg>
    </div>
  );
}
