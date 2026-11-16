import { inOrder, sameTransform, type Transform } from "@/core/model";
import { editorStore, useEditor } from "@/store/useEditor";
import { shownIndex } from "./StagePicture";

// Moving, sizing and turning pictures (step 18), shared by the stage and the Picture tab.
//
// Every change is first a preview in the store (the stage redraws from it, nothing is saved);
// then one command saves it, from the saved transform to the previewed one. A drag saves when the
// pointer lets go; a burst of arrow presses, wheel turns or typed numbers saves once, a moment
// after it stops, so it's one undo step, not sixty.

export type TransformChange = { id: string; from: Transform; to: Transform };
export type SaveTransforms = (changes: TransformChange[], label: string) => Promise<boolean>;

export const BURST_DELAY = 600;   // ms of quiet before a burst is saved

// Where a picture is shown now: being moved (preview), or as saved.
export function shownTransform(id: string): Transform | undefined {
  const state = editorStore.getState();
  return state.transformPreview[id] ?? state.frames[id]?.transform;
}

// Shows each picture changed by `change`, from where it's shown now (or from `from`, for drags
// that measure from where they started).
export function previewEach(ids: readonly string[], change: (transform: Transform, id: string) => Transform, from?: Readonly<Record<string, Transform>>): void {
  const next: Record<string, Transform> = {};
  for (const id of ids) {
    const base = from?.[id] ?? shownTransform(id);
    if (base) next[id] = change(base, id);
  }
  editorStore.getState().previewTransforms(next);
}

let pending: { timer: ReturnType<typeof setTimeout>; ids: readonly string[]; label: string; save: SaveTransforms } | null = null;

// Saves what's previewed for these pictures now (one command), or forgets it if nothing changed.
// If the save fails, the preview goes, and the pictures show where they're saved.
export function commitPreview(ids: readonly string[], label: string, save: SaveTransforms): void {
  if (pending) { clearTimeout(pending.timer); pending = null; }
  const state = editorStore.getState();
  const changes = ids.flatMap((id) => {
    const to = state.transformPreview[id];
    const from = state.frames[id]?.transform;
    return to && from && !sameTransform(from, to) ? [{ id, from, to }] : [];
  });
  if (changes.length === 0) { state.clearTransformPreview(ids); return; }
  void save(changes, label).then((saved) => { if (!saved) editorStore.getState().clearTransformPreview(ids); });
}

// Saves a burst a moment after its last change. A burst on other pictures saves the earlier one first.
export function commitSoon(ids: readonly string[], label: string, save: SaveTransforms, delay = BURST_DELAY): void {
  if (pending && (pending.label !== label || pending.ids.join() !== ids.join())) commitPreview(pending.ids, pending.label, pending.save);
  if (pending) clearTimeout(pending.timer);
  pending = { ids, label, save, timer: setTimeout(() => commitPreview(ids, label, save), delay) };
}

// Escape: forget what isn't saved yet.
export function cancelPreview(ids: readonly string[]): void {
  if (pending) { clearTimeout(pending.timer); pending = null; }
  editorStore.getState().clearTransformPreview(ids);
}

const NO_FRAMES: readonly string[] = [];   // one shared empty list: a new [] each read would re-render forever

// The pictures being edited: the selected ones, or the one on the stage if none is selected.
export function useEditTargets(): string[] {
  const order = useEditor((state) => state.project?.frameIds ?? NO_FRAMES);
  const selection = useEditor((state) => state.selection);
  const selected = inOrder(order, selection);
  if (selected.length) return selected;
  const index = shownIndex(order, selection);
  return index >= 0 ? [order[index]] : [];
}
