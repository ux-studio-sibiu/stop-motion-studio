"use client";

import { useEffect, useId, useRef, useState } from "react";
import { NO_FILL } from "@/core/model";

// Picking a colour from a row of them, shared by the Objects tab and the Draw tab, with the
// palettes they use. A colour is [#rrggbb, its name].
export const INKS = [["#1f2433", "Black"], ["#ffffff", "White"], ["#d62828", "Red"], ["#1d4ed8", "Blue"], ["#15803d", "Green"], ["#7e22ce", "Purple"]] as const;
export const FILLS = [["#ffffff", "White"], ["#fff3a3", "Yellow"], ["#ffd6e7", "Pink"], ["#cfe8ff", "Blue"], ["#d3f5d0", "Green"], ["#1f2433", "Black"]] as const;

type Colours = readonly (readonly [string, string])[];

// A row of colours to pick one from. `none`: a first swatch for no colour at all (see-through).
// `custom`: a last one for any other colour, from the browser's colour picker; it shows that
// colour once picked.
export function Swatches({ label, colours, value, none = false, custom = false, onPick }: { label: string; colours: Colours; value: string; none?: boolean; custom?: boolean; onPick: (colour: string) => void }) {
  const id = useId();
  const all: Colours = none ? [[NO_FILL, "None"], ...colours] : colours;
  return (
    <div className="field">
      <span id={id}>{label}</span>
      <div className="swatches" role="group" aria-labelledby={id}>
        {all.map(([colour, name]) => (
          <button key={colour} type="button" className={`swatch${colour === NO_FILL ? " is-none" : ""}${value === colour ? " is-on" : ""}`} style={colour === NO_FILL ? undefined : { background: colour }} aria-label={name} title={name} aria-pressed={value === colour} onClick={() => onPick(colour)} />
        ))}
        {custom && <CustomSwatch value={value} isOther={!all.some(([colour]) => colour === value)} onPick={onPick} />}
      </div>
    </div>
  );
}

// The "another colour" swatch: a rainbow until a colour of its own is picked, then that colour.
// While the picker is open the swatch follows it; the colour is picked (one undo step) when the
// picker closes, the input's native change event, not on every move inside it.
function CustomSwatch({ value, isOther, onPick }: { value: string; isOther: boolean; onPick: (colour: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const pick = useRef(onPick);
  useEffect(() => { pick.current = onPick; });
  useEffect(() => {
    const element = input.current;
    if (!element) return;
    const onChange = () => { setPicking(null); pick.current(element.value); };
    element.addEventListener("change", onChange);
    return () => element.removeEventListener("change", onChange);
  }, []);
  const shown = picking ?? (isOther ? value : null);
  return (
    <label className={`swatch is-custom${isOther ? " is-on" : ""}`} style={shown ? { background: shown } : undefined} title="Another colour">
      <input ref={input} type="color" aria-label="Another colour" value={shown ?? "#888888"} onChange={(event) => setPicking(event.target.value)} />
    </label>
  );
}
