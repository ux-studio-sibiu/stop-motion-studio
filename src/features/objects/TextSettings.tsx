"use client";

import type { TextProps } from "@/core/model";
import { FILLS, INKS, Swatches } from "@/studio/Swatches";
import { ColourGroup, TextGroup, type SettingsProps } from "./controls";

// A text object's settings (step 24): the text, its size and font; its colour, and a background
// colour, or none.
export function TextSettings({ props, set, type }: SettingsProps<TextProps>) {
  return (
    <div className="kind-settings">
      <TextGroup props={props} set={set} type={type} />
      <ColourGroup>
        <Swatches label="Text colour" colours={INKS} value={props.textColour} custom onPick={(textColour) => set({ textColour }, "Change text colour")} />
        <Swatches label="Background colour" colours={FILLS} value={props.fill} none custom onPick={(fill) => set({ fill }, "Change background")} />
      </ColourGroup>
    </div>
  );
}
