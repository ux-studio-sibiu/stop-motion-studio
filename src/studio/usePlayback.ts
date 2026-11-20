"use client";

import { useEffect } from "react";
import { frameIndexAt, frameStarts, inOrder, soundsFrom, soundsOf, totalTicks } from "@/core/model";
import { soundSeconds } from "@/core/sound";
import { playSounds } from "@/adapters/sound/sound";
import { readClock, startClock } from "@/core/playback/clock";
import { orderedFrames } from "@/store/editorStore";
import { editorStore, useEditor } from "@/store/useEditor";
import { ownsKey } from "./keyboard";
import { bitmaps } from "./media";

const PRELOAD = 4;   // pictures decoded ahead of the playhead

// Plays the animation while the store says so (isPlaying). Each animation frame reads the
// clock and moves the playhead; the stage draws whatever is at the playhead.
//   - It starts from the selected picture, or from the start.
//   - It plays the frames as they were when Play was pressed (a snapshot); changing the speed
//     or the loop setting starts it again from where it is.
//   - Pausing selects the picture it stopped on, so the stage and timeline agree; reaching the
//     end (without loop) goes back to the start for the next Play.
//   - The sound row plays along (step 29b): scheduled on the audio clock when Play is pressed,
//     again from the start each time a loop comes round, and stopped on pause.
// Enter plays and pauses, unless a button, link or text field has the keyboard.
export function usePlayback() {
  const isPlaying = useEditor((state) => state.isPlaying);
  const loop = useEditor((state) => state.loop);
  const fps = useEditor((state) => state.project?.fps ?? 8);

  useEffect(() => {
    if (!isPlaying) return;
    const state = editorStore.getState();
    const frames = orderedFrames(state);
    const order = frames.map((frame) => frame.id);
    const starts = frameStarts(frames);
    const total = totalTicks(frames);
    const selected = inOrder(order, state.selection)[0];
    const from = selected ? starts[order.indexOf(selected)] : state.playhead < total ? state.playhead : 0;
    const clock = startClock(performance.now(), from, fps, total, loop);
    let ended = false;
    let request = 0;
    const clips = soundsOf(state.project);
    const sounds = (tick: number) => playSounds(soundsFrom(clips, tick, total, fps, (clip) => soundSeconds(clip.sound)));
    let stopSounds = sounds(from);
    let last = from;

    const preload = (index: number) => {
      for (let i = 0; i < PRELOAD; i++) {
        const frame = frames[(index + i) % frames.length];
        if (frame && !bitmaps.has(frame.imageId)) void bitmaps.load(frame.imageId);
      }
    };

    const step = (now: number) => {
      const reading = readClock(clock, now);
      if (reading.tick < last) { stopSounds(); stopSounds = sounds(reading.tick); }   // a loop came round
      last = reading.tick;
      if (reading.tick !== editorStore.getState().playhead) editorStore.getState().seek(reading.tick);
      preload(frameIndexAt(frames, reading.tick));
      if (reading.ended) { ended = true; editorStore.getState().pause(); return; }
      request = requestAnimationFrame(step);
    };
    preload(frameIndexAt(frames, from));
    editorStore.getState().seek(from);
    request = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(request);
      stopSounds();
      const now = editorStore.getState();
      if (now.project?.id !== state.project?.id) return;   // left the project
      if (ended) {
        now.clearSelection();   // the stage shows the last picture; the next Play starts over
        now.seek(0);
        return;
      }
      const frame = frames[frameIndexAt(frames, now.playhead)];
      if (frame && frame.id in now.frames) now.select([frame.id]);
    };
  }, [isPlaying, loop, fps]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat || ownsKey(event.target)) return;
      event.preventDefault();
      togglePlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function togglePlay(): void {
  const state = editorStore.getState();
  if (state.isPlaying) state.pause(); else state.play();
}
