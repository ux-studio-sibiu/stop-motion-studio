"use client";

import { Layers, Pause, Play, Repeat } from "lucide-react";
import { FPS_OPTIONS } from "@/core/model";
import { editorStore, useEditor } from "@/store/useEditor";
import { togglePlay } from "./usePlayback";

// Play / pause, how fast, and whether it loops. The speed is saved with the animation (an
// undoable change, onSpeed); the loop is how you watch it, so it isn't.
export function PlaybackBar({ onSpeed }: { onSpeed: (from: number, to: number) => void }) {
  const isPlaying = useEditor((state) => state.isPlaying);
  const loop = useEditor((state) => state.loop);
  const fps = useEditor((state) => state.project?.fps ?? 8);
  const hasPictures = useEditor((state) => (state.project?.frameIds.length ?? 0) > 0);
  const speedIndex = nearestOption(fps);

  return (
    <footer className="playback-bar">
      <button type="button" className="big-button is-play" aria-label={isPlaying ? "Pause" : "Play"} title={`${isPlaying ? "Pause" : "Play"} (Enter)`} disabled={!hasPictures} onClick={togglePlay}>
        {isPlaying ? <Pause size={40} /> : <Play size={40} />}
      </button>
      <label className="speed">
        <span>Speed</span>
        <span className="speed-end" aria-hidden="true">Slow</span>
        <input type="range" min={0} max={FPS_OPTIONS.length - 1} step={1} value={speedIndex} aria-valuetext={`${FPS_OPTIONS[speedIndex]} pictures per second`} onChange={(event) => onSpeed(fps, FPS_OPTIONS[Number(event.target.value)])} />
        <span className="speed-end" aria-hidden="true">Fast</span>
      </label>
      <button type="button" className={`icon-button${loop ? " is-on" : ""}`} aria-label="Loop" aria-pressed={loop} title="Play again from the start when it ends" onClick={() => editorStore.getState().setLoop(!loop)}><Repeat size={24} /></button>
      <button type="button" className="icon-button" aria-label="See-through" disabled><Layers size={24} /><span className="desktop-only">See-through</span></button>
    </footer>
  );
}

// The speed control's position for a speed that may not be one of the options (an old project).
function nearestOption(fps: number): number {
  let best = 0;
  FPS_OPTIONS.forEach((option, i) => { if (Math.abs(option - fps) < Math.abs(FPS_OPTIONS[best] - fps)) best = i; });
  return best;
}
