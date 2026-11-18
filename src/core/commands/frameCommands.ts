import { clampAdjust, clampHold, cloneElements, cloneFrame, inOrder, moveIds, nudgeGap, sameAdjust, sameElements, sameOrder, sameTransform, type Adjust, type Element, type Frame, type Transform, type FrameInsert, type ProjectRepository, type RemovedFrame } from "../model";
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

// Puts pictures in a new order (a drag or Ctrl+arrow). Saves the whole order, so undo is
// exact. If another tab adds or deletes a picture in between, the saved order is repaired on
// load (useProject): a new picture goes to the end, a deleted one is dropped.
export function reorderFrames(projectId: string, before: readonly string[], after: readonly string[], moved: readonly string[]): Command {
  const write = (frameIds: readonly string[]) => async (repository: ProjectRepository) => {
    if (sameOrder(before, after)) throw new Error("The order didn't change.");
    await repository.updateProject(projectId, { frameIds: [...frameIds] });
    return { select: moved };
  };
  return { label: moved.length === 1 ? "Move picture" : `Move ${moved.length} pictures`, do: write(after), undo: write(before) };
}

// The keyboard move (Ctrl+arrow): pictures one place left or right of where they are when it
// runs, read from the saved order, not from what the screen showed when the key was pressed. So
// presses quicker than the saves add up (history runs them one after another). Undo and redo put
// back the exact orders it saw. At the end of the line it fails, so nothing is recorded.
export function nudgeFrames(projectId: string, moved: readonly string[], direction: -1 | 1): Command {
  let before: string[] | undefined;
  let after: string[] = [];
  const write = (frameIds: readonly string[]) => async (repository: ProjectRepository) => {
    await repository.updateProject(projectId, { frameIds: [...frameIds] });
    return { select: [...moved] };
  };
  return {
    label: moved.length === 1 ? "Move picture" : `Move ${moved.length} pictures`,
    async do(repository) {
      if (!before) {
        const order = (await repository.getProject(projectId))?.frameIds ?? [];
        const ids = inOrder(order, moved);
        const next = moveIds(order, ids, nudgeGap(order, ids, direction));
        if (ids.length === 0 || sameOrder(order, next)) throw new Error("The order didn't change.");
        before = [...order];
        after = next;
      }
      return write(after)(repository);
    },
    undo: (repository) => write(before ?? [])(repository),
  };
}

// Moves, sizes, turns or flips pictures: one command for a whole drag, wheel gesture or burst of
// arrow presses, however many pictures it changed. Undo puts every one back. They stay selected.
export function setTransforms(projectId: string, changes: readonly { id: string; from: Transform; to: Transform }[], label = "Move picture"): Command {
  const ids = changes.map((change) => change.id);
  const write = (pick: "from" | "to") => async (repository: ProjectRepository) => {
    if (changes.length === 0 || changes.every(({ from, to }) => sameTransform(from, to))) throw new Error("Nothing moved.");
    await repository.updateFrames(projectId, changes.map((change) => ({ id: change.id, transform: { ...change[pick] } })));
    return { select: ids };
  };
  return { label: changes.length > 1 ? `${label} (${changes.length} pictures)` : label, do: write("to"), undo: write("from") };
}

// Brightness and contrast (step 20): one command for a slider drag, or for "apply to all", however
// many pictures it changed. Undo puts every picture's back. The photo itself never changes.
export function setAdjusts(projectId: string, changes: readonly { id: string; from: Adjust; to: Adjust }[], label = "Change brightness"): Command {
  const write = (pick: "from" | "to") => async (repository: ProjectRepository) => {
    if (changes.length === 0 || changes.every(({ from, to }) => sameAdjust(clampAdjust(from), clampAdjust(to)))) throw new Error("Nothing changed.");
    await repository.updateFrames(projectId, changes.map((change) => ({ id: change.id, adjust: clampAdjust(change[pick]) })));
    return {};
  };
  return { label: changes.length > 1 ? `${label} (${changes.length} pictures)` : label, do: write("to"), undo: write("from") };
}

// A picture's bubbles (step 23): adding, moving, resizing, turning, typing, deleting. One command
// sets the frame's whole list, from what it was to what it becomes, so every edit (a whole drag,
// all the typing in one go) is one undo step. The picture is selected, so the stage shows it.
export function setElements(projectId: string, frameId: string, from: readonly Element[], to: readonly Element[], label: string): Command {
  return setElementsOf(projectId, [{ frameId, from, to }], label);
}

// Several pictures' objects in one step (pasting onto many, step 24b): every change, or none, and
// one undo puts them all back. The pictures are selected.
export function setElementsOf(projectId: string, changes: readonly { frameId: string; from: readonly Element[]; to: readonly Element[] }[], label: string): Command {
  const write = (pick: "from" | "to") => async (repository: ProjectRepository) => {
    const changed = changes.filter((change) => !sameElements(change.from, change.to));
    if (changed.length === 0) throw new Error("Nothing changed.");
    await repository.updateFrames(projectId, changed.map((change) => ({ id: change.frameId, elements: cloneElements(change[pick]) })));
    return { select: changed.map((change) => change.frameId) };
  };
  return { label, do: write("to"), undo: write("from") };
}

// Changes how long pictures last: one command for a whole drag or key press, however many
// pictures it changed. Undo puts every length back. The changed pictures are selected.
export function setHold(projectId: string, changes: readonly { id: string; from: number; to: number }[]): Command {
  const ids = changes.map((change) => change.id);
  const apply = (pick: "from" | "to") => async (repository: ProjectRepository) => {
    if (changes.length === 0) throw new Error("No length to change.");
    await repository.updateFrames(projectId, changes.map((change) => ({ id: change.id, hold: clampHold(change[pick]) })));
    return { select: ids };
  };
  return {
    label: changes.length === 1 ? "Change length" : `Change length of ${changes.length} pictures`,
    do: apply("to"),
    undo: apply("from"),
  };
}
