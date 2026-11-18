"use client";

import type { BubbleProps, BubbleVariant } from "@/core/model";
import { FILLS, INKS, Swatches } from "@/studio/Swatches";
import { ColourGroup, OutlineWidthPicker, TextGroup, type SettingsProps } from "./controls";

// A speech bubble's settings, in three groups:
//   Bubble   its shape, whether it has a tail, and its outline;
//   Text     the text, its size and font;
//   Colours  the bubble's, the outline's (with an outline) and the text's.

const SHAPES: { id: BubbleVariant; label: string }[] = [{ id: "speech", label: "Speech bubble" }, { id: "thought", label: "Thought bubble" }, { id: "spiked", label: "Spiked bubble" }];

export function BubbleSettings({ props, set, type }: SettingsProps<BubbleProps>) {
  return (
    <div className="kind-settings">
      <fieldset className="group">
        <legend>Bubble</legend>
        <label className="field">
          <select value={props.variant} aria-label="Shape" onChange={(event) => set({ variant: event.target.value as BubbleVariant }, "Change bubble shape")}>
            {SHAPES.map((shape) => <option key={shape.id} value={shape.id}>{shape.label}</option>)}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={props.showTail} onChange={(event) => set({ showTail: event.target.checked }, event.target.checked ? "Show bubble tail" : "Hide bubble tail")} />
          <span>Tail</span>
        </label>
        <OutlineWidthPicker value={props.outline} onWidth={(outline) => set({ outline }, "Change outline")} />
      </fieldset>
      <TextGroup props={props} set={set} type={type} />
      <ColourGroup>
        <Swatches label="Bubble colour" colours={FILLS} value={props.fill} custom onPick={(fill) => set({ fill }, "Change bubble colour")} />
        {props.outline !== "none" && <Swatches label="Outline colour" colours={INKS} value={props.outlineColour} custom onPick={(outlineColour) => set({ outlineColour }, "Change outline colour")} />}
        <Swatches label="Text colour" colours={INKS} value={props.textColour} custom onPick={(textColour) => set({ textColour }, "Change text colour")} />
      </ColourGroup>
    </div>
  );
}
