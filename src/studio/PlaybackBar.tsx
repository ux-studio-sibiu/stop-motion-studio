"use client";

import { ChevronDown, Pause, Play } from "lucide-react";
import type { ReactNode } from "react";
import { FPS_OPTIONS, MAX_SAFE_MARGIN, SAFE_MARGIN, safeMargin } from "@/core/model";
import { editorStore, useEditor } from "@/store/useEditor";
import { useDropdown } from "./useDropdown";
import { togglePlay } from "./usePlayback";

// The big Play / Pause button, with its options in a dropdown beside it: how fast, loop, and the
// safe zone (how the video comes out). Then whatever the studio puts beside it (`children`: the
// see-through button). The speed and the safe zone are saved with the animation (undoable
// changes); the loop is how you watch it, so it isn't.
export function PlaybackBar({ onSpeed, onSafeMargin, children }: { onSpeed: (from: number, to: number) => void; onSafeMargin: (from: number, to: number) => Promise<boolean>; children?: ReactNode }) {
  const isPlaying = useEditor((state) => state.isPlaying);
  const loop = useEditor((state) => state.loop);
  const fps = useEditor((state) => state.project?.fps ?? 8);
  const speedIndex = nearestOption(fps);
  const { open, toggle, ref } = useDropdown();

  // Green to play; red, the whole group, while playing (the stop look, with the pause icon). Never
  // greyed out: with no pictures yet, pressing it does nothing (the store's play()).
  const fill = isPlaying ? "is-primary" : "is-go";
  return (
    <footer className="playback-bar">
      <div ref={ref} className="nsc-playback-options option-menu">
        <button type="button" className={`icon-button toggle play ${fill}`} aria-label={isPlaying ? "Pause" : "Play"} title={`${isPlaying ? "Pause" : "Play"} (Enter)`} onClick={togglePlay}>
          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}   {/* filled: solid shapes, like a player's */}
          {/* Both words in one spot, only one visible: the button keeps the width of the longer one. */}
          <span className="play-label" aria-hidden="true">
            <span className={isPlaying ? "is-hidden" : undefined}>Play</span>
            <span className={isPlaying ? undefined : "is-hidden"}>Pause</span>
          </span>
        </button>
        <button type="button" className={`icon-button more ${fill}`} aria-label="Playback options" aria-expanded={open} aria-haspopup="true" title={`${FPS_OPTIONS[speedIndex]} pictures per second${loop ? ", loops" : ""}`} onClick={toggle}><ChevronDown size={20} /></button>

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
            <SafeZoneOption onSafeMargin={onSafeMargin} />
          </div>
        )}
      </div>
      {children}
    </footer>
  );
}

// The speed control's position for a speed that may not be one of the options (an old project).
function nearestOption(fps: number): number {
  let best = 0;
  FPS_OPTIONS.forEach((option, i) => { if (Math.abs(option - fps) < Math.abs(FPS_OPTIONS[best] - fps)) best = i; });
  return best;
}

// The safe zone (the edge band the video leaves out): while dragging only the stage changes;
// letting go, or a key press, saves one undoable step. Moved here from see-through in step 22.
function SafeZoneOption({ onSafeMargin }: { onSafeMargin: (from: number, to: number) => Promise<boolean> }) {
  const saved = useEditor((state) => (state.project ? safeMargin(state.project) : SAFE_MARGIN));
  const dragged = useEditor((state) => state.safeMarginPreview);
  const margin = dragged ?? saved;
  const commit = () => {
    const to = editorStore.getState().safeMarginPreview;
    if (to === null) return;
    if (to === saved) { editorStore.getState().previewSafeMargin(null); return; }
    void onSafeMargin(saved, to).then((ok) => { if (!ok) editorStore.getState().previewSafeMargin(null); });
  };
  return (
    <label className="option">
      <span>Safe zone: {margin} px</span>
      <input type="range" min={0} max={MAX_SAFE_MARGIN} step={5} value={margin} aria-label="Safe zone" aria-valuetext={`${margin} pixels`} onChange={(event) => editorStore.getState().previewSafeMargin(Number(event.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
    </label>
  );
}
