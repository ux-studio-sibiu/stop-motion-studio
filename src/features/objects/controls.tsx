"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { BUBBLE_FONTS, OUTLINE_WIDTHS, type OutlineWidth, type TextSize } from "@/core/model";
import { saveNow } from "@/studio/saveSoon";
import { takeTextFocus } from "./objectEditing";

// Controls more than one kind of object's settings use (BubbleSettings, TextSettings,
// ShapeSettings). As few words as possible (see the design page): a dropdown has no label, its
// options say what they are ("Large text", "Font: Rounded"); the text box has none either; only
// the colour rows are named, since a row of colours doesn't say what it colours. Each settings component gets its object's settings and two callbacks from
// ObjectSettings (in the floating panel):
//   set   changes some settings, shown and saved as one undo step
//   type  changes the text: shown as it's typed, saved as one step once typing stops
export type SettingsProps<T> = { props: T; set: (patch: Partial<T>, label: string) => void; type: (text: string) => void };

const SIZES: { id: TextSize; label: string }[] = [{ id: "small", label: "Small text" }, { id: "medium", label: "Medium text" }, { id: "large", label: "Large text" }, { id: "huge", label: "Huge text" }];
const OUTLINE_NAMES: Record<OutlineWidth, string> = { none: "no outline", thin: "thin", medium: "medium", thick: "thick", extra: "extra thick", super: "super thick" };

// How thick the outline is: a slider from none to thick, its value in words above it. Its colour
// sits in the Colours group, shown only with an outline.
export function OutlineWidthPicker({ value, onWidth }: { value: OutlineWidth; onWidth: (width: OutlineWidth) => void }) {
  const name = OUTLINE_NAMES[value];
  return (
    <label className="field outline-width">
      <span aria-hidden="true">{value === "none" ? "No outline" : `Outline: ${name}`}</span>
      <input type="range" min={0} max={OUTLINE_WIDTHS.length - 1} step={1} value={OUTLINE_WIDTHS.indexOf(value)} aria-label="Outline" aria-valuetext={name} onChange={(event) => onWidth(OUTLINE_WIDTHS[Number(event.target.value)])} />
    </label>
  );
}

// The text, its size and font: the Text group of bubbles and of text objects (its colour is in the
// Colours group). The text box takes the keyboard when it appears for a new object (takeTextFocus).
type TextFields = { text: string; textSize: TextSize; font: string };
export function TextGroup<T extends TextFields>({ props, set, type }: SettingsProps<T>) {
  const textBox = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (takeTextFocus()) textBox.current?.focus(); }, []);
  return (
    <fieldset className="group">
      <legend>Text</legend>
      <label className="field">
        <textarea ref={textBox} aria-label="Text" data-object-text rows={3} value={props.text} placeholder="Type here" spellCheck={false} onChange={(event) => type(event.target.value)} onBlur={saveNow} />
      </label>
      <label className="field">
        <select value={props.textSize} aria-label="Text size" onChange={(event) => set({ textSize: event.target.value as TextSize } as Partial<T>, "Change text size")}>
          {SIZES.map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}
        </select>
      </label>
      <label className="field">
        <select value={props.font} aria-label="Font" style={{ fontFamily: BUBBLE_FONTS.find((font) => font.id === props.font)?.family }} onChange={(event) => set({ font: event.target.value } as Partial<T>, "Change font")}>
          {BUBBLE_FONTS.map((font) => <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>Font: {font.label}</option>)}
        </select>
      </label>
    </fieldset>
  );
}

// The Colours group: every colour of the object, a named row of swatches each.
export function ColourGroup({ children }: { children: ReactNode }) {
  return (
    <fieldset className="group colours">
      <legend>Colours</legend>
      {children}
    </fieldset>
  );
}
