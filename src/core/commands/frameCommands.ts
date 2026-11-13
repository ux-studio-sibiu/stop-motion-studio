import { cloneFrame, type Frame, type FrameInsert, type ProjectRepository, type RemovedFrame } from "../model";
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

// Adds new frames (a capture) with their photos, at `insert.at` (default: the end), and selects
// them, so the next capture goes after this one. Undo takes them out again, keeping the
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
      return { select: ids };
    },
    async undo(repository: ProjectRepository) {
      removed = (await repository.removeFrames(projectId, ids)).removed;
    },
  };
}

// Copies pictures, each copy right after its source (a b → a a' b b'), and selects the copies.
// A copy looks exactly like its source (cloneFrame) and shares its photo, so duplicating
// costs no storage. `order` is the animation's order now, to know where the sources are.
export function duplicateFrames(projectId: string, sources: readonly Frame[], order: readonly string[]): Command {
  const placed = sources
    .map((source) => ({ source, index: order.indexOf(source.id) }))
    .filter(({ index }) => index >= 0)
    .sort((a, b) => a.index - b.index);
  // The k-th copy lands after its source, which has k earlier copies in front of it.
  const copies: RemovedFrame[] = placed.map(({ source, index }, k) => ({ frame: cloneFrame(source), index: index + k + 1 }));
  const ids = copies.map(({ frame }) => frame.id);
  return {
    label: copies.length === 1 ? "Duplicate picture" : `Duplicate ${copies.length} pictures`,
    async do(repository) {
      if (copies.length === 0) throw new Error("Nothing to duplicate.");
      await repository.restoreFrames(projectId, copies);
      return { select: ids };
    },
    async undo(repository) {
      await repository.removeFrames(projectId, ids);
      return { select: placed.map(({ source }) => source.id) };
    },
  };
}
