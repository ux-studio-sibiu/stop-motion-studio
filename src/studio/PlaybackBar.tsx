"use client";

import { ChevronDown, Pause, Play } from "lucide-react";
import { FPS_OPTIONS } from "@/core/model";
import { editorStore, useEditor } from "@/store/useEditor";
import { SeeThroughMenu } from "./SeeThroughMenu";
import { useDropdown } from "./useDropdown";
import { togglePlay } from "./usePlayback";

// The big Play / Pause button, with its options (how fast, loop) in a dropdown beside it, and
// the see-through button. The speed is saved with the animation (an undoable change, onSpeed);
// the loop is how you watch it, so it isn't.
export function PlaybackBar({ onSpeed }: { onSpeed: (from: number, to: number) => void }) {
  const isPlaying = useEditor((state) => state.isPlaying);
  const loop = useEditor((state) => state.loop);
  const fps = useEditor((state) => state.project?.fps ?? 8);
  const hasPictures = useEditor((state) => (state.project?.frameIds.length ?? 0) > 0);
  const speedIndex = nearestOption(fps);
  const { open, toggle, ref } = useDropdown();

  return (
    <footer className="playback-bar">
      <div ref={ref} className="nsc-playback-options option-menu">
        <button type="button" className="icon-button toggle play" aria-label={isPlaying ? "Pause" : "Play"} title={`${isPlaying ? "Pause" : "Play"} (Enter)`} disabled={!hasPictures} onClick={togglePlay}>
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          {/* Both words in one spot, only one visible: the button keeps the width of the longer one. */}
          <span className="play-label" aria-hidden="true">
            <span className={isPlaying ? "is-hidden" : undefined}>Play</span>
            <span className={isPlaying ? undefined : "is-hidden"}>Pause</span>
          </span>
        </button>
        <button type="button" className="icon-button more" aria-label="Playback options" aria-expanded={open} aria-haspopup="true" title={`${FPS_OPTIONS[speedIndex]} pictures per second${loop ? ", loops" : ""}`} onClick={toggle}><ChevronDown size={20} /></button>

        {open && (
          <div className="options" role="group" aria-label="Playback options">
            <label className="option">
              <span>Speed</span>
              <span className="range-ends">
                <span aria-hidden="true">Slow</span>
                <input type="range" min={0} max={FPS_OPTIONS.length - 1} step={1} value={speedIndex} aria-label="Speed" aria-valuetext={`${FPS_OPTIONS[speedIndex]} pictures per second`} onChange={(event) => onSpeed(fps, FPS_OPTIONS[Number(event.target.value)])} />
                <span aria-hidden="true">Fast</span>
              </span>
            </label>
            <label className="option is-check">
              <input type="checkbox" checked={loop} onChange={(event) => editorStore.getState().setLoop(event.target.checked)} />
              <span>Loop</span>
            </label>
          </div>
        )}
      </div>
      <SeeThroughMenu />
    </footer>
  );
}

// The speed control's position for a speed that may not be one of the options (an old project).
function nearestOption(fps: number): number {
  let best = 0;
  FPS_OPTIONS.forEach((option, i) => { if (Math.abs(option - fps) < Math.abs(FPS_OPTIONS[best] - fps)) best = i; });
  return best;
}
