"use client";

import { useEffect, useId, useRef } from "react";
import { BUBBLE_FONTS, NO_FILL, type OutlineWidth, type TextSize } from "@/core/model";
import { saveNow } from "@/studio/saveSoon";
import { takeTextFocus } from "./objectEditing";

// Controls more than one kind of object's settings use (BubbleSettings, TextSettings,
// ShapeSettings). Each settings component gets its object's settings and two callbacks from the
// Objects tab:
//   set   changes some settings, shown and saved as one undo step
//   type  changes the text: shown as it's typed, saved as one step once typing stops
export type SettingsProps<T> = { props: T; set: (patch: Partial<T>, label: string) => void; type: (text: string) => void };

export const INKS = [["#1f2433", "Black"], ["#ffffff", "White"], ["#d62828", "Red"], ["#1d4ed8", "Blue"], ["#15803d", "Green"], ["#7e22ce", "Purple"]] as const;
export const FILLS = [["#ffffff", "White"], ["#fff3a3", "Yellow"], ["#ffd6e7", "Pink"], ["#cfe8ff", "Blue"], ["#d3f5d0", "Green"], ["#1f2433", "Black"]] as const;
const SIZES: { id: TextSize; label: string }[] = [{ id: "small", label: "Small" }, { id: "medium", label: "Medium" }, { id: "large", label: "Large" }, { id: "huge", label: "Huge" }];
const OUTLINES: { id: OutlineWidth; label: string }[] = [{ id: "none", label: "None" }, { id: "thin", label: "Thin" }, { id: "medium", label: "Medium" }, { id: "thick", label: "Thick" }];

type Colours = readonly (readonly [string, string])[];

// A row of colours to pick one from. `none`: a first swatch for no colour at all (see-through).
export function Swatches({ label, colours, value, none = false, onPick }: { label: string; colours: Colours; value: string; none?: boolean; onPick: (colour: string) => void }) {
  const id = useId();
  const all: Colours = none ? [[NO_FILL, "None"], ...colours] : colours;
  return (
    <div className="field">
      <span id={id}>{label}</span>
      <div className="swatches" role="group" aria-labelledby={id}>
        {all.map(([colour, name]) => (
          <button key={colour} type="button" className={`swatch${colour === NO_FILL ? " is-none" : ""}${value === colour ? " is-on" : ""}`} style={colour === NO_FILL ? undefined : { background: colour }} aria-label={name} title={name} aria-pressed={value === colour} onClick={() => onPick(colour)} />
        ))}
      </div>
    </div>
  );
}

export function OutlinePicker({ value, colour, onWidth, onColour }: { value: OutlineWidth; colour: string; onWidth: (width: OutlineWidth) => void; onColour: (colour: string) => void }) {
  return (
    <>
      <label className="field">
        <span>Outline</span>
        <select value={value} onChange={(event) => onWidth(event.target.value as OutlineWidth)}>
          {OUTLINES.map((outline) => <option key={outline.id} value={outline.id}>{outline.label}</option>)}
        </select>
      </label>
      {value !== "none" && <Swatches label="Outline colour" colours={INKS} value={colour} onPick={onColour} />}
    </>
  );
}

// The text, its size, font and colour: the Text group of bubbles and of text objects. The text box
// takes the keyboard when it appears for a new object (takeTextFocus).
type TextFields = { text: string; textSize: TextSize; font: string; textColour: string };
export function TextGroup<T extends TextFields>({ props, set, type }: SettingsProps<T>) {
  const textBox = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (takeTextFocus()) textBox.current?.focus(); }, []);
  return (
    <fieldset className="group">
      <legend>Text</legend>
      <label className="field">
        <span>Text</span>
        <textarea ref={textBox} data-object-text rows={3} value={props.text} placeholder="Type here" spellCheck={false} onChange={(event) => type(event.target.value)} onBlur={saveNow} />
      </label>
      <label className="field">
        <span>Text size</span>
        <select value={props.textSize} onChange={(event) => set({ textSize: event.target.value as TextSize } as Partial<T>, "Change text size")}>
          {SIZES.map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Font</span>
        <select value={props.font} style={{ fontFamily: BUBBLE_FONTS.find((font) => font.id === props.font)?.family }} onChange={(event) => set({ font: event.target.value } as Partial<T>, "Change font")}>
          {BUBBLE_FONTS.map((font) => <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>{font.label}</option>)}
        </select>
      </label>
      <Swatches label="Text colour" colours={INKS} value={props.textColour} onPick={(colour) => set({ textColour: colour } as Partial<T>, "Change text colour")} />
    </fieldset>
  );
}
