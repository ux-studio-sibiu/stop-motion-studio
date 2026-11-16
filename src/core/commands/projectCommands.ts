import { clampSafeMargin, type ProjectRepository } from "../model";
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
