"use client";

import { ChevronDown, Layers } from "lucide-react";
import { useDropdown } from "../useDropdown";
import type { TimelineLayers } from "../remembered";

// The timeline's Layers button: a dropdown with a switch for each extra row under the pictures,
// objects in time and sounds. What's chosen is remembered (Timeline keeps it in remembered.ts).
// A hidden row keeps what's on it: it still plays and goes in the video; it just isn't shown.
// It opens below the button, over the timeline. The icon is the usual stacked layers, with a
// small caret so it reads as a dropdown. It comes first in the timeline's buttons.
export function LayersMenu({ layers, onChange }: { layers: TimelineLayers; onChange: (layers: TimelineLayers) => void }) {
  const { open, toggle, ref } = useDropdown();
  const row = (key: keyof TimelineLayers, label: string, hint: string) => (
    <label className="option is-check" title={hint}>
      <input type="checkbox" checked={layers[key]} onChange={(event) => onChange({ ...layers, [key]: event.target.checked })} />
      <span>{label}</span>
    </label>
  );
  return (
    <div ref={ref} className="nsc-layers-menu option-menu opens-below">
      <button type="button" className={`icon-button is-small${open ? " is-on" : ""}`} aria-label="Timeline layers" title="Which rows the timeline shows" aria-expanded={open} aria-haspopup="true" onClick={toggle}><Layers size={20} /><ChevronDown className="caret" size={14} /></button>
      {open && (
        <div className="options" role="group" aria-label="Timeline layers">
          {row("objects", "Objects Layer", "The row of objects that show over several pictures")}
          {row("sounds", "Sound Layer", "The row of sounds")}
        </div>
      )}
    </div>
  );
}
