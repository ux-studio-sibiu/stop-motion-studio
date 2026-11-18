"use client";

import type { ShapeForm, ShapeProps } from "@/core/model";
import { FILLS, INKS, Swatches } from "@/studio/Swatches";
import { ColourGroup, OutlineWidthPicker, type SettingsProps } from "./controls";

// A shape's settings (step 24): which shape it is (one kind, so a rectangle can become an arrow),
// its outline; its colour or none, and the outline's colour. Which way an arrow points is the box's turn, on the stage.

const FORMS: { id: ShapeForm; label: string }[] = [{ id: "rectangle", label: "Rectangle" }, { id: "ellipse", label: "Ellipse" }, { id: "arrow", label: "Arrow" }];

export function ShapeSettings({ props, set }: SettingsProps<ShapeProps>) {
  return (
    <div className="kind-settings">
      <fieldset className="group">
        <legend>Shape</legend>
        <label className="field">
          <select value={props.form} aria-label="Shape" onChange={(event) => set({ form: event.target.value as ShapeForm }, "Change shape")}>
            {FORMS.map((form) => <option key={form.id} value={form.id}>{form.label}</option>)}
          </select>
        </label>
        <OutlineWidthPicker value={props.outline} onWidth={(outline) => set({ outline }, "Change outline")} />
      </fieldset>
      <ColourGroup>
        <Swatches label="Colour" colours={FILLS} value={props.fill} none custom onPick={(fill) => set({ fill }, "Change shape colour")} />
        {props.outline !== "none" && <Swatches label="Outline colour" colours={INKS} value={props.outlineColour} custom onPick={(outlineColour) => set({ outlineColour }, "Change outline colour")} />}
      </ColourGroup>
    </div>
  );
}
