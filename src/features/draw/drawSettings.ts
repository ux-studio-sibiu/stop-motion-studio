"use client";

import { DRAWING, isColour, withElement, PENCIL_WIDTHS, type Element, type Frame, type PencilWidth } from "@/core/model";
import { useStagePicture } from "@/studio/StagePicture";
import { remembered, useRememberedState } from "@/studio/remembered";

// What the Draw tab and its stage layer share: the chosen tool, colour and width (remembered after
// a reload), and the picture being drawn on.

export type DrawTool = "pencil" | "eraser";

// The pencil's colours: the inks, plus orange and yellow for drawing.
export const DRAW_COLOURS = [["#1f2433", "Black"], ["#ffffff", "White"], ["#d62828", "Red"], ["#f08c00", "Orange"], ["#ffd43b", "Yellow"], ["#15803d", "Green"], ["#1d4ed8", "Blue"], ["#7e22ce", "Purple"]] as const;

export function useDrawSettings() {
  const [tool, setTool] = useRememberedState<string>(remembered.drawTool, "pencil", (value) => value === "pencil" || value === "eraser");
  const [colour, setColour] = useRememberedState<string>(remembered.drawColour, DRAW_COLOURS[2][0], isColour);
  const [width, setWidth] = useRememberedState<string>(remembered.drawWidth, "medium", (value) => PENCIL_WIDTHS.includes(value as PencilWidth));
  return { tool: tool as DrawTool, setTool, colour, setColour, width: width as PencilWidth, setWidth };
}

// The picture on the stage (the rightmost selected, or the last), with any change not saved yet,
// and its drawing, if it has one.
export function useDrawFrame(): { frame: Frame | undefined; drawing: Element | undefined } {
  const { frame } = useStagePicture();
  return { frame, drawing: frame?.elements.find((element) => element.kind === DRAWING) };
}

// The picture's objects with its drawing replaced by `next` (added if it had none, removed if null).
export function withDrawing(elements: readonly Element[], drawing: Element | undefined, next: Element | null): Element[] {
  if (!drawing) return next ? [...elements, next] : [...elements];
  return withElement(elements, drawing.id, next);
}
