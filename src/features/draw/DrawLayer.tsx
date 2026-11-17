"use client";

import { useRef, type PointerEvent } from "react";
import { addStroke, eraseStrokes, pencilWidth, simplifyStroke, type Element, type Point } from "@/core/model";
import { drawStroke } from "@/core/render";
import { editorStore, useEditor } from "@/store/useEditor";
import { commitObjects, previewObjects, type SaveObjects } from "@/studio/pictureObjects";
import { useDrawFrame, useDrawSettings, withDrawing } from "./drawSettings";
import { frameRunner, toProjectPoint, type FrameRunner } from "@/studio/stagePointer";

type Gesture = { pointerId: number; points: Point[]; base: Element | undefined; redraw: FrameRunner };

// Drawing on the picture on the stage (step 24b), while the Draw tab is open and the camera is off.
// A canvas at the project's size over the picture:
//   pencil  the line being drawn shows here as it's drawn; letting go smooths it (simplifyStroke)
//           and adds it to the picture's drawing, one undo step
//   eraser  a ring follows the pointer; the strokes it touches go, shown as it moves, one undo
//           step when it's let go
// Pointer events, so a mouse, a finger and a pen all draw.
export function DrawLayer({ save }: { save: SaveObjects }) {
  const { frame, drawing } = useDrawFrame();
  const { tool, colour, width } = useDrawSettings();
  const projectWidth = useEditor((state) => state.project?.width ?? 1280);
  const projectHeight = useEditor((state) => state.project?.height ?? 720);
  const canvas = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture | null>(null);
  if (!frame) return null;

  const size = { width: projectWidth, height: projectHeight };
  const line = pencilWidth(width, projectHeight);
  const eraserRadius = Math.max(projectHeight * 0.015, line);

  const toProject = (clientX: number, clientY: number): Point => toProjectPoint(canvas.current, clientX, clientY, size);
  const live = () => canvas.current?.getContext("2d") ?? null;
  const clear = () => { const ctx = live(); ctx?.clearRect(0, 0, projectWidth, projectHeight); };
  const ring = (at: Point) => {
    const ctx = live();
    if (!ctx) return;
    ctx.save();
    ctx.lineWidth = Math.max(2, projectHeight * 0.003);
    ctx.strokeStyle = "#ffffff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.arc(at.x, at.y, eraserRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  // Shows the picture's drawing with the eraser's path so far taken out.
  const showErased = (current: Gesture) => {
    if (!current.base) return;
    previewObjects(frame.id, withDrawing(frame.elements, drawing, eraseStrokes(current.base, current.points, eraserRadius, size)));
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    editorStore.getState().pause();
    const at = toProject(event.clientX, event.clientY);
    gesture.current = { pointerId: event.pointerId, points: [at], base: drawing, redraw: frameRunner() };
    clear();
    if (tool === "pencil") drawStroke(live()!, [at], colour, line);
    else { ring(at); showErased(gesture.current); }
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = gesture.current;
    const at = toProject(event.clientX, event.clientY);
    if (!current || current.pointerId !== event.pointerId) {
      if (tool === "eraser") { clear(); ring(at); }   // where the eraser would go
      return;
    }
    // Every point the pointer passed, not only one per event: smoother lines on fast moves.
    const passed = event.nativeEvent.getCoalescedEvents?.() ?? [];
    current.points.push(...(passed.length ? passed.map((item) => toProject(item.clientX, item.clientY)) : [at]));
    current.redraw.request(() => {
      clear();
      if (tool === "pencil") drawStroke(live()!, current.points, colour, line);
      else { ring(current.points[current.points.length - 1]); showErased(current); }
    });
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    current.redraw.cancel();
    if (tool === "pencil") {
      const points = simplifyStroke(current.points, projectHeight * 0.0015);
      // Shown as part of the picture straight away (the preview), so nothing flickers while it saves.
      previewObjects(frame.id, withDrawing(frame.elements, drawing, addStroke(drawing, { points, colour, width }, size)));
      clear();
      commitObjects(frame.id, save, "Draw");
    } else {
      showErased(current);
      commitObjects(frame.id, save, "Erase");
    }
  };

  const onPointerCancel = () => {
    gesture.current = null;
    clear();
    editorStore.getState().clearElementsPreview([frame.id]);
  };

  return (
    <canvas ref={canvas} className={`nsc-draw-layer${tool === "eraser" ? " is-erasing" : ""}`} width={projectWidth} height={projectHeight} role="application" aria-label={tool === "pencil" ? "Drawing: draw on the picture" : "Eraser: rub out lines on the picture"}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onPointerLeave={() => { if (!gesture.current) clear(); }} />
  );
}
