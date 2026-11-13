import type { FrameInsert, ProjectRepository, RemovedFrame } from "../model";
import type { Command } from "./command";

// Takes pictures out of the animation. Undo puts them back exactly where they were (and
// selects them); their photos were never deleted, so nothing is lost. If none of the pictures
// is there any more (another tab deleted them first), it fails, so history doesn't record a
// step that does nothing.
export function deleteFrames(projectId: string, frameIds: readonly string[]): Command {
  let removed: RemovedFrame[] = [];
  return {
    label: frameIds.length === 1 ? "Delete picture" : `Delete ${frameIds.length} pictures`,
    async do(repository) {
      const result = await repository.removeFrames(projectId, frameIds);
      if (result.removed.length === 0) throw new Error("Those pictures aren't in the animation.");
      removed = result.removed;
    },
    async undo(repository) {
      await repository.restoreFrames(projectId, removed);
      return { select: removed.map(({ frame }) => frame.id) };
    },
  };
}

// Adds new frames (a capture) with their photos. Undo takes them out again, keeping the
// photos, and redo puts them back. The photos are only needed for the first do(): after
// that the command lets go of them, so a long history doesn't hold megabytes of Blobs.
export function addFrames(projectId: string, insert: FrameInsert, label = "Take picture"): Command {
  let pending: FrameInsert | null = insert;
  let removed: RemovedFrame[] = [];
  const ids = insert.frames.map((frame) => frame.id);
  return {
    label,
    async do(repository: ProjectRepository) {
      if (pending) {
        await repository.insertFrames(projectId, pending);
        pending = null;
      } else {
        await repository.restoreFrames(projectId, removed);
      }
    },
    async undo(repository: ProjectRepository) {
      removed = (await repository.removeFrames(projectId, ids)).removed;
    },
  };
}
