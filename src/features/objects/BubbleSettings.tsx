"use client";

import type { BubbleProps, BubbleVariant } from "@/core/model";
import { FILLS, OutlinePicker, Swatches, TextGroup, type SettingsProps } from "./controls";

// A speech bubble's settings, in two groups:
//   Bubble  its shape, whether it has a tail, its colour and its outline;
//   Text    the text, and its size, font and colour.

const SHAPES: { id: BubbleVariant; label: string }[] = [{ id: "speech", label: "Speech" }, { id: "thought", label: "Thought" }, { id: "spiked", label: "Spiked" }];

export function BubbleSettings({ props, set, type }: SettingsProps<BubbleProps>) {
  return (
    <div className="kind-settings">
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
        <Swatches label="Bubble colour" colours={FILLS} value={props.fill} onPick={(fill) => set({ fill }, "Change bubble colour")} />
        <OutlinePicker value={props.outline} colour={props.outlineColour} onWidth={(outline) => set({ outline }, "Change outline")} onColour={(outlineColour) => set({ outlineColour }, "Change outline colour")} />
      </fieldset>
      <TextGroup props={props} set={set} type={type} />
    </div>
  );
}
