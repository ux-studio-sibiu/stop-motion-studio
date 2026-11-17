"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { shownIndex, angleTo, boundsOf, boxLines, moveBy, rotateBy, scaleAround, snapBox, type Point, type SnapLines, type Transform } from "@/core/model";
import { frameCorners } from "@/core/render";
import { useEditor, useShownFrames, editorStore } from "@/store/useEditor";
import { bitmaps } from "@/studio/media";
import { useStagePan } from "./useStagePan";
import { cancelPreview, commitPreview, commitSoon, previewEach, shownTransform, useEditTargets, type SaveTransforms } from "./transformEditing";
import { frameRunner, toProjectPoint, type FrameRunner } from "@/studio/stagePointer";

const HANDLE_DISTANCE = 70;   // project px in from the picture's top edge
const HANDLE_RADIUS = 26;
const SNAP_DISTANCE = 8;      // screen px: how near an edge or centre has to come to snap

type Edit = { kind: "move" | "turn"; pointerId: number; start: Point; base: Record<string, Transform>; startAngle: number; latest: Point; alt: boolean; snapWithin: number; redraw: FrameRunner };

// Direct editing on the stage, over the picture (camera off): drag to move, the round handle to
// turn, the wheel to size around the pointer; with the keyboard, arrows nudge 1 project pixel
// (Shift: 10) and + / - size around the centre. Several selected pictures move together.
// Lining up (step 19): a drag snaps the picture's edges and centre to the stage's and, with
// see-through on, to the picture before, with a guide line (hold Alt to place it freely; nudges never snap).
// Zooming and panning the view: useStagePan.
// Positions are worked out in project pixels: the stage canvas is the project's size scaled to
// fit, so a pointer movement is converted with the canvas's on-screen size.
export function StageEditor({ save }: { save: SaveTransforms }) {
  const targets = useEditTargets();
  const frames = useShownFrames();
  const selection = useEditor((state) => state.selection);
  const seeThrough = useEditor((state) => state.onionSkin.on);
  const width = useEditor((state) => state.project?.width ?? 1280);
  const height = useEditor((state) => state.project?.height ?? 720);
  const element = useRef<HTMLDivElement>(null);
  const gesture = useRef<Edit | null>(null);
  const pan = useStagePan(element);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null } | null>(null);
  const size = { width, height };

  const toProject = (clientX: number, clientY: number): Point => toProjectPoint(element.current, clientX, clientY, size);

  const cornersOf = (id: string, transform?: Transform) => {
    const frame = frames.find((candidate) => candidate.id === id);
    return frame ? frameCorners(transform ?? frame.transform, bitmaps.get(frame.imageId), size) : null;
  };
  const outlines = targets.flatMap((id) => { const corners = cornersOf(id); return corners ? [{ id, corners }] : []; });
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

  // What a drag snaps to: the stage's edges and centre, and the see-through picture (the one before).
  const snapLines = (): SnapLines => {
    const order = frames.map((frame) => frame.id);
    const ghostId = seeThrough ? order[shownIndex(order, selection) - 1] : undefined;
    const ghost = ghostId ? cornersOf(ghostId) : null;
    const own = ghost ? boxLines(boundsOf(ghost)) : { x: [], y: [] };
    return { x: [0, width / 2, width, ...own.x], y: [0, height / 2, height, ...own.y] };
  };

  // A move from where the drag started, snapped by the first picture's box (all move together).
  const showMove = (current: Edit) => {
    let dx = current.latest.x - current.start.x;
    let dy = current.latest.y - current.start.y;
    let snapped: { x: number | null; y: number | null } | null = null;
    const lead = targets[0] ? current.base[targets[0]] : undefined;
    const corners = lead && !current.alt ? cornersOf(targets[0], moveBy(lead, dx, dy, size)) : null;
    if (corners) {
      const snap = snapBox(boundsOf(corners), snapLines(), current.snapWithin);
      dx += snap.dx;
      dy += snap.dy;
      snapped = snap.x === null && snap.y === null ? null : { x: snap.x, y: snap.y };
    }
    previewEach(targets, (t) => moveBy(t, dx, dy, size), current.base);
    setGuides(snapped);
  };

  const showTurn = (current: Edit) => {
    if (centre) previewEach(targets, (t) => rotateBy(t, angleTo(centre, current.latest) - current.startAngle), current.base);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (pan.start(event) || event.button !== 0 || targets.length === 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    const box = event.currentTarget.getBoundingClientRect();
    const start = toProject(event.clientX, event.clientY);
    const kind = (event.target as Element).closest("[data-handle]") ? "turn" : "move";
    editorStore.getState().pause();
    const base = Object.fromEntries(targets.flatMap((id) => { const t = shownTransform(id); return t ? [[id, t]] : []; }));
    gesture.current = { kind, pointerId: event.pointerId, start, base, startAngle: centre ? angleTo(centre, start) : 0, latest: start, alt: event.altKey, snapWithin: (SNAP_DISTANCE * width) / (box.width || 1), redraw: frameRunner() };
  };

  // Redraw on the next animation frame, not on every pointer event, so dragging stays smooth.
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pan.move(event)) return;
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.latest = toProject(event.clientX, event.clientY);
    current.alt = event.altKey;
    current.redraw.request(() => { if (current.kind === "move") showMove(current); else showTurn(current); });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pan.end(event)) return;
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    current.redraw.cancel();
    current.alt = event.altKey;
    if (current.kind === "move") showMove(current);
    else showTurn(current);
    setGuides(null);
    commitPreview(targets, current.kind === "move" ? "Move picture" : "Turn picture", save);
  };

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (pan.end(event)) return;
    const current = gesture.current;
    gesture.current = null;
    setGuides(null);
    if (current) cancelPreview(targets);
  };

  // The wheel sizes around the pointer (with Ctrl it zooms the view: useStagePan). A native
  // listener, because React's wheel events can't stop the page from scrolling.
  const latest = useRef({ targets, toProject, size, save });
  useEffect(() => { latest.current = { targets, toProject, size, save }; });
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      const { targets, toProject, size, save } = latest.current;
      if (event.ctrlKey || targets.length === 0) return;
      event.preventDefault();
      const point = toProject(event.clientX, event.clientY);
      previewEach(targets, (t) => scaleAround(t, Math.exp(-event.deltaY * 0.0015), point, size));
      commitSoon(targets, "Size picture", save);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === " ") { event.preventDefault(); return; }   // held for panning
    if (targets.length === 0) return;
    const step = event.shiftKey ? 10 : 1;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    const grow = { "+": 1.1, "=": 1.1, "-": 1 / 1.1 }[event.key];
    if (move) {
      event.preventDefault();
      previewEach(targets, (t) => moveBy(t, move[0], move[1], size));   // nudges never snap
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
    <div ref={element} className={`stage-editor${pan.panning ? " is-panning" : ""}`} tabIndex={0} role="application" aria-label="Move the picture: drag it, turn it with the round handle, size it with the wheel; arrow keys nudge, + and - size" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onKeyDown={onKeyDown}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {guides && guides.x !== null && <line className="guide" data-guide="x" x1={guides.x} y1={0} x2={guides.x} y2={height} />}
        {guides && guides.y !== null && <line className="guide" data-guide="y" x1={0} y1={guides.y} x2={width} y2={guides.y} />}
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
