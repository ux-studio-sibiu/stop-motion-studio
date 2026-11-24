"use client";

import { Music } from "lucide-react";
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { clipTicks, formatTicks, laneCount, moveSoundClip, resizeSoundClip, sameSounds, soundLanes, soundsOf, totalTicks, withSoundClip, type Frame, type SoundClip } from "@/core/model";
import { soundSeconds } from "@/core/sound";
import { previewSound } from "@/adapters/sound/sound";
import { editorStore, useEditor } from "@/store/useEditor";
import { saveSoon, settleSoon } from "../saveSoon";
import { deleteSound, setSoundList, soundName, type SaveSounds } from "../soundEditing";
import { useBarDrag } from "./useBarDrag";

// The sound row (step 29b): the bottom of the timeline, on the same time scale. Each sound is a bar
// from when it starts, as long as it plays (its own length, or its sound's):
//   - drag it to move it in time (whole ticks, one undo step);
//   - drag one of its ends to make it shorter (it stops there) or longer (the sound starts again);
//     the start end moves it, its end staying put, as on the overlay track;
//   - click it to pick it (and hear it): the Sounds tab shows its volume and Delete;
//   - with the keyboard on a bar: arrows move it, Shift+arrows make it shorter or longer, Delete
//     removes it, Enter or Space picks it.
// Overlapping sounds are drawn in rows so none hides another (soundLanes). While a move is in
// progress the bars show it (`moving`); the saved list replaces it once the save comes back.
export function SoundTrack({ frames, tickWidth, fps, onChange }: { frames: readonly Frame[]; tickWidth: number; fps: number; onChange: SaveSounds }) {
  const project = useEditor((state) => state.project);
  const saved = useMemo(() => soundsOf(project), [project]);
  const picked = useEditor((state) => state.pickedSound);
  const [moving, setMoving] = useState<{ from: SoundClip[]; clips: SoundClip[] } | null>(null);
  const latest = useRef<SoundClip[] | null>(null);
  // A move shows until the saved sounds change (its save came back); other saves (a picture deleted) leave it.
  if (moving && !sameSounds(moving.from, saved)) setMoving(null);   // its save came back (or another change did): over
  const clips = moving && sameSounds(moving.from, saved) ? moving.clips : saved;
  const ticksOf = (clip: SoundClip) => clipTicks(clip, fps, soundSeconds(clip.sound));
  const lanes = useMemo(() => soundLanes(clips, (clip) => clipTicks(clip, fps, soundSeconds(clip.sound))), [clips, fps]);
  const rows = laneCount(lanes);
  const length = Math.max(totalTicks(frames), ...clips.map((clip) => clip.start + ticksOf(clip)));

  const show = (next: SoundClip[]) => { latest.current = next; setMoving({ from: saved, clips: next }); };
  const commit = (label: string) => { const to = latest.current; latest.current = null; if (to) void setSoundList(to, label, onChange); };
  const pick = (clip: SoundClip) => { editorStore.getState().pickSound(clip.id); previewSound(clip.sound, clip.volume); };

  const bar = useBarDrag<SoundClip>({
    tickWidth,
    onDrag: (base, ticks, edge) => show(withSoundClip(saved, base.id, edge ? resizeSoundClip(base, edge, ticks, ticksOf(base)) : moveSoundClip(base, ticks))),
    onDrop: (base, edge) => { settleSoon("sound"); commit(edge ? `Change how long ${soundName(base.sound)} plays` : `Move ${soundName(base.sound)}`); },
    onClick: pick,
    onCancel: () => { latest.current = null; setMoving(null); },
  });

  const onKeyDown = (clip: SoundClip, event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (step) {
      event.preventDefault();
      const now = clips.find((item) => item.id === clip.id) ?? clip;
      show(withSoundClip(clips, clip.id, event.shiftKey ? resizeSoundClip(now, "end", step, ticksOf(now)) : moveSoundClip(now, step)));
      saveSoon("sound", `${clip.id}:${event.shiftKey}`, () => commit(event.shiftKey ? `Change how long ${soundName(clip.sound)} plays` : `Move ${soundName(clip.sound)}`));   // a run of presses is one step
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      void deleteSound(clip.id, onChange);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(clip);
    }
  };

  return (
    <div className="sound-track" data-tick-width={tickWidth} role="group" aria-label="Sound Layer" title="Drag a sound here from the Sounds tab" style={{ width: Math.max(1, length + 8) * tickWidth, "--lanes": rows } as CSSProperties}>
      {clips.length === 0 && frames.length > 0 && <span className="track-hint">Sounds</span>}
      {clips.map((clip) => {
        const name = soundName(clip.sound);
        return (
          <div key={clip.id} role="button" tabIndex={0} className={`sound-bar${clip.id === picked ? " is-selected" : ""}`} style={{ left: clip.start * tickWidth, width: ticksOf(clip) * tickWidth, "--lane": lanes[clip.id] ?? 0 } as CSSProperties}
            aria-label={`${name} sound, at ${formatTicks(clip.start, fps)}, for ${formatTicks(ticksOf(clip), fps)}`} aria-pressed={clip.id === picked} title="Drag to move it in time, its ends to make it shorter or longer; click to hear it"
            onPointerDown={(event) => bar.onPointerDown(clip, event)} onPointerMove={bar.onPointerMove} onPointerUp={bar.onPointerUp} onPointerCancel={bar.onPointerCancel} onKeyDown={(event) => onKeyDown(clip, event)}>
            <span className="edge is-start" data-edge="start" aria-hidden="true" />
            <span className="bar-label" aria-hidden="true"><Music size={14} /><span>{name}</span></span>
            <span className="edge is-end" data-edge="end" aria-hidden="true" />
          </div>
        );
      })}
    </div>
  );
}
