"use client";

import { useId } from "react";
import { NO_FILL } from "@/core/model";

// Picking a colour from a row of them, shared by the Objects tab and the Draw tab, with the
// palettes they use. A colour is [#rrggbb, its name].
export const INKS = [["#1f2433", "Black"], ["#ffffff", "White"], ["#d62828", "Red"], ["#1d4ed8", "Blue"], ["#15803d", "Green"], ["#7e22ce", "Purple"]] as const;
export const FILLS = [["#ffffff", "White"], ["#fff3a3", "Yellow"], ["#ffd6e7", "Pink"], ["#cfe8ff", "Blue"], ["#d3f5d0", "Green"], ["#1f2433", "Black"]] as const;

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
