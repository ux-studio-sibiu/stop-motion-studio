"use client";

import type { TextProps } from "@/core/model";
import { FILLS, Swatches, TextGroup, type SettingsProps } from "./controls";

// A text object's settings (step 24): the text, its size, font and colour, and a background
// colour, or none.
export function TextSettings({ props, set, type }: SettingsProps<TextProps>) {
  return (
    <div className="kind-settings">
      <TextGroup props={props} set={set} type={type} />
      <fieldset className="group">
        <legend>Background</legend>
        <Swatches label="Background colour" colours={FILLS} value={props.fill} none onPick={(fill) => set({ fill }, "Change background")} />
      </fieldset>
    </div>
  );
}
