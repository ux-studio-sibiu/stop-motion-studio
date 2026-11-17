"use client";

import type { ShapeForm, ShapeProps } from "@/core/model";
import { FILLS, OutlinePicker, Swatches, type SettingsProps } from "./controls";

// A shape's settings (step 24): which shape it is (one kind, so a rectangle can become an arrow),
// its colour or none, and its outline. Which way an arrow points is the box's turn, on the stage.

const FORMS: { id: ShapeForm; label: string }[] = [{ id: "rectangle", label: "Rectangle" }, { id: "ellipse", label: "Ellipse" }, { id: "arrow", label: "Arrow" }];

export function ShapeSettings({ props, set }: SettingsProps<ShapeProps>) {
  return (
    <div className="kind-settings">
      <fieldset className="group">
        <legend>Shape</legend>
        <label className="field">
          <span>Shape</span>
          <select value={props.form} onChange={(event) => set({ form: event.target.value as ShapeForm }, "Change shape")}>
            {FORMS.map((form) => <option key={form.id} value={form.id}>{form.label}</option>)}
          </select>
        </label>
        <Swatches label="Colour" colours={FILLS} value={props.fill} none onPick={(fill) => set({ fill }, "Change shape colour")} />
        <OutlinePicker value={props.outline} colour={props.outlineColour} onWidth={(outline) => set({ outline }, "Change outline")} onColour={(outlineColour) => set({ outlineColour }, "Change outline colour")} />
      </fieldset>
    </div>
  );
}
