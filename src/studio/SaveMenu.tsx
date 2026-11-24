"use client";

import { ChevronDown, Save } from "lucide-react";
import type { ReactNode } from "react";
import { useDropdown } from "./useDropdown";

// The studio's Save button, under the back arrow: a save icon with a caret, opening a list of the
// ways to save the animation as a file (`children`: Save as MP4, Save as GIF with its settings).
// The list is only hidden when closed, never removed, so closing it doesn't stop a save that's
// still being made; while open it stays open as one saves, so its progress and note can be seen.
export function SaveMenu({ children }: { children: ReactNode }) {
  const { open, toggle, ref } = useDropdown();
  return (
    <div ref={ref} className="nsc-save-menu option-menu opens-below">
      <button type="button" className={`icon-button save-button${open ? " is-on" : ""}`} aria-label="Save" title="Save the animation as a video or a GIF" aria-expanded={open} aria-haspopup="true" onClick={toggle}>
        <Save size={24} /><ChevronDown className="caret" size={20} />
      </button>
      <div className="options" role="group" aria-label="Save as" hidden={!open}>{children}</div>
    </div>
  );
}
