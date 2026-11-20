"use client";

import { Volume2, VolumeX } from "lucide-react";
import { playNotes } from "@/adapters/sound/sound";
import { SHUTTER } from "@/core/sound";

// The shutter click when a picture is taken, on or off (step 29). Turning it on plays it once,
// so the child hears what they chose. Remembered (Studio, remembered.ts).
export function CaptureSoundToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const toggle = () => {
    if (!on) playNotes(SHUTTER);
    onChange(!on);
  };
  return (
    <button type="button" className={`icon-button is-small nsc-capture-sound${on ? " is-on" : ""}`} aria-pressed={on} title="A click when a picture is taken" onClick={toggle}>
      {on ? <Volume2 size={20} /> : <VolumeX size={20} />}Sound
    </button>
  );
}
