import { clampSafeMargin, cleanOverlay, cleanSoundClip, cloneOverlays, sameOverlays, sameSounds, type Overlay, type ProjectRepository, type SoundClip } from "../model";
import type { Command } from "./command";

// Commands that change the animation as a whole, not its pictures (those are frameCommands.ts).

// Changes the speed (pictures per second). Every length is in ticks, so the whole animation,
// ruler and all, scales evenly.
export function setFps(projectId: string, from: number, to: number): Command {
  const write = (fps: number) => async (repository: ProjectRepository) => {
    if (from === to) throw new Error("The speed didn't change.");
    await repository.updateProject(projectId, { fps });
  };
  return { label: "Change speed", do: write(to), undo: write(from) };
}

// Changes the safe zone (the edge band the video leaves out): one step per slider drag.
export function setSafeMargin(projectId: string, from: number, to: number): Command {
  const write = (margin: number) => async (repository: ProjectRepository) => {
    if (clampSafeMargin(from) === clampSafeMargin(to)) throw new Error("The safe zone didn't change.");
    await repository.updateProject(projectId, { safeMargin: clampSafeMargin(margin) });
  };
  return { label: "Change safe zone", do: write(to), undo: write(from) };
}

// The overlays (step 24): adding, moving in time, changing when they start and end, editing their
// object on the stage or in the Objects tab, deleting. Like a picture's objects (setElements), one
// command sets the whole list from what it was to what it becomes, so every edit is one undo step.
export function setOverlays(projectId: string, from: readonly Overlay[], to: readonly Overlay[], label: string): Command {
  const write = (overlays: readonly Overlay[]) => async (repository: ProjectRepository) => {
    if (sameOverlays(from, to)) throw new Error("Nothing changed.");
    await repository.updateProject(projectId, { overlays: cloneOverlays(overlays).map(cleanOverlay) });
  };
  return { label, do: write(to), undo: write(from) };
}

// The sounds in time (step 29b): adding, moving, a louder or quieter volume, deleting. Like the
// overlays, one command sets the whole list, so every edit is one undo step.
export function setSounds(projectId: string, from: readonly SoundClip[], to: readonly SoundClip[], label: string): Command {
  const write = (sounds: readonly SoundClip[]) => async (repository: ProjectRepository) => {
    if (sameSounds(from, to)) throw new Error("Nothing changed.");
    await repository.updateProject(projectId, { sounds: sounds.map(cleanSoundClip) });
  };
  return { label, do: write(to), undo: write(from) };
}
