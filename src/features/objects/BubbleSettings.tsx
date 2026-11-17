"use client";

import { useEffect, useRef } from "react";
import { BUBBLE_FONTS, bubbleProps, withProps, type BubbleProps, type BubbleVariant, type Element, type OutlineWidth, type TextSize } from "@/core/model";
import { saveNow, saveSoon } from "@/studio/saveSoon";
import { commitObjects, takeTextFocus, type SaveObjects } from "./objectFrame";

// A speech bubble's settings, in the Objects tab while it's picked on the stage, in two groups:
//   Bubble  its shape, whether it has a tail, its colour and its outline;
//   Text    the text, and its size, font and colour.
// Each choice is one undo step; typing is shown on the stage as it happens and saved as one step
// once it stops.

const SHAPES: { id: BubbleVariant; label: string }[] = [{ id: "speech", label: "Speech" }, { id: "thought", label: "Thought" }, { id: "spiked", label: "Spiked" }];
const SIZES: { id: TextSize; label: string }[] = [{ id: "small", label: "Small" }, { id: "medium", label: "Medium" }, { id: "large", label: "Large" }, { id: "huge", label: "Huge" }];
const OUTLINES: { id: OutlineWidth; label: string }[] = [{ id: "none", label: "None" }, { id: "thin", label: "Thin" }, { id: "medium", label: "Medium" }, { id: "thick", label: "Thick" }];
const INKS = [["#1f2433", "Black"], ["#ffffff", "White"], ["#d62828", "Red"], ["#1d4ed8", "Blue"], ["#15803d", "Green"], ["#7e22ce", "Purple"]] as const;
const FILLS = [["#ffffff", "White"], ["#fff3a3", "Yellow"], ["#ffd6e7", "Pink"], ["#cfe8ff", "Blue"], ["#d3f5d0", "Green"], ["#1f2433", "Black"]] as const;

type Colours = readonly (readonly [string, string])[];
// change: shows and saves this bubble changed (one undo step); preview: only shows it.
type Props = { element: Element; frameId: string; save: SaveObjects; change: (next: Element, label: string) => void; preview: (next: Element) => void };

export function BubbleSettings({ element, frameId, save, change, preview }: Props) {
  const props = bubbleProps(element);
  const textBox = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (takeTextFocus()) textBox.current?.focus(); }, []);   // a new bubble: type straight away
  const set = (patch: Partial<BubbleProps>, label: string) => change(withProps(element, patch), label);

  const type = (text: string) => {
    preview(withProps(element, { text }));
    saveSoon("object", element.id, () => commitObjects(frameId, save, "Change bubble text"));   // a run of typing is one undo step
  };

  const swatches = (field: "textColour" | "fill" | "outlineColour", label: string, colours: Colours) => (
    <div className="field">
      <span id={`bubble-${field}`}>{label}</span>
      <div className="swatches" role="group" aria-labelledby={`bubble-${field}`}>
        {colours.map(([colour, name]) => (
          <button key={colour} type="button" className={`swatch${props[field] === colour ? " is-on" : ""}`} style={{ background: colour }} aria-label={name} title={name} aria-pressed={props[field] === colour} onClick={() => set({ [field]: colour }, `Change ${label.toLowerCase()}`)} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="bubble-settings">
      <fieldset className="group">
        <legend>Bubble</legend>
        <div className="row">
          <label className="field">
            <span>Shape</span>
            <select value={props.variant} onChange={(event) => set({ variant: event.target.value as BubbleVariant }, "Change bubble shape")}>
              {SHAPES.map((shape) => <option key={shape.id} value={shape.id}>{shape.label}</option>)}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={props.showTail} onChange={(event) => set({ showTail: event.target.checked }, event.target.checked ? "Show bubble tail" : "Hide bubble tail")} />
            <span>Tail</span>
          </label>
        </div>
        {swatches("fill", "Bubble colour", FILLS)}
        <label className="field">
          <span>Outline</span>
          <select value={props.outline} onChange={(event) => set({ outline: event.target.value as OutlineWidth }, "Change outline")}>
            {OUTLINES.map((outline) => <option key={outline.id} value={outline.id}>{outline.label}</option>)}
          </select>
        </label>
        {props.outline !== "none" && swatches("outlineColour", "Outline colour", INKS)}
      </fieldset>

      <fieldset className="group">
        <legend>Text</legend>
        <label className="field">
          <span>Text</span>
          <textarea ref={textBox} data-object-text rows={3} value={props.text} placeholder="Type here" spellCheck={false} onChange={(event) => type(event.target.value)} onBlur={saveNow} />
        </label>
        <label className="field">
          <span>Text size</span>
          <select value={props.textSize} onChange={(event) => set({ textSize: event.target.value as TextSize }, "Change text size")}>
            {SIZES.map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Font</span>
          <select value={props.font} style={{ fontFamily: BUBBLE_FONTS.find((font) => font.id === props.font)?.family }} onChange={(event) => set({ font: event.target.value }, "Change font")}>
            {BUBBLE_FONTS.map((font) => <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>{font.label}</option>)}
          </select>
        </label>
        {swatches("textColour", "Text colour", INKS)}
      </fieldset>
    </div>
  );
}
