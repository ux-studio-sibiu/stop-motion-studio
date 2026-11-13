import type { Frame } from "./types";

// Brings a project's order back in line with the frames that really exist. Normally they
// always match (they're written in one transaction), but a crash, an old import or a bug
// could leave an id pointing at nothing, or a frame no id points at. Repairing on load means
// the timeline never shows a hole, and no picture is ever lost from it.
//   - ids without a frame are dropped
//   - an id listed twice is kept once, at its first place
//   - frames missing from the order are added at the end
export function repairFrameOrder(frameIds: readonly string[], frames: readonly Pick<Frame, "id">[]): string[] {
  const existing = new Set(frames.map((frame) => frame.id));
  const seen = new Set<string>();
  const repaired: string[] = [];

  for (const id of frameIds) {
    if (!existing.has(id) || seen.has(id)) continue;
    seen.add(id);
    repaired.push(id);
  }
  for (const frame of frames) {
    if (!seen.has(frame.id)) { seen.add(frame.id); repaired.push(frame.id); }
  }
  return repaired;
}

// An id and where it stood in the order.
export type OrderEntry = { id: string; index: number };

// Takes ids out of the order and says where each one was (ascending), so they can be put
// back exactly. Ids not in the order are ignored.
export function removeFromOrder(order: readonly string[], ids: Iterable<string>): { order: string[]; removed: OrderEntry[] } {
  const remove = new Set(ids);
  const removed: OrderEntry[] = [];
  const kept: string[] = [];
  order.forEach((id, index) => (remove.has(id) ? removed.push({ id, index }) : kept.push(id)));
  return { order: kept, removed };
}

// Puts ids back at the places removeFromOrder reported. Inserting in ascending index order
// rebuilds the original order; if the order has shrunk since, an id goes to the end at most.
// Ids already in the order stay where they are.
export function restoreToOrder(order: readonly string[], entries: readonly OrderEntry[]): string[] {
  const restored = [...order];
  const present = new Set(order);
  for (const { id, index } of [...entries].sort((a, b) => a.index - b.index)) {
    if (present.has(id)) continue;
    restored.splice(Math.min(Math.max(0, index), restored.length), 0, id);
    present.add(id);
  }
  return restored;
}

// Which picture to select once `ids` are deleted: the first one after the last deleted
// picture, or, at the end of the animation, the one before them. None if nothing is left.
export function neighbourAfterDelete(order: readonly string[], ids: readonly string[]): string | undefined {
  const remove = new Set(ids);
  const last = order.findLastIndex((id) => remove.has(id));
  if (last < 0) return undefined;
  return order.slice(last + 1).find((id) => !remove.has(id)) ?? order.slice(0, last).findLast((id) => !remove.has(id));
}

// Moves pictures to a new place, keeping their order among themselves. `gap` is the place
// among the pictures that stay: 0 = before all of them, 1 = after the first one, and so on.
export function moveIds(order: readonly string[], ids: Iterable<string>, gap: number): string[] {
  const moving = new Set(ids);
  const moved = order.filter((id) => moving.has(id));
  const staying = order.filter((id) => !moving.has(id));
  const at = Math.min(staying.length, Math.max(0, Math.round(gap)));
  return [...staying.slice(0, at), ...moved, ...staying.slice(at)];
}

// The keyboard move: the selection one place left or right (past one other picture). A
// selection with holes closes up around its first picture's place.
export function nudgeGap(order: readonly string[], ids: readonly string[], direction: -1 | 1): number {
  const moving = new Set(ids);
  const first = order.findIndex((id) => moving.has(id));
  if (first < 0) return 0;
  return first + direction;   // every picture before the selection stays, so its gap is `first`
}

// Where a drop at `x` goes: the number of staying pictures whose middle is left of x.
export function gapAt(slots: readonly { start: number; width: number }[], x: number): number {
  return slots.filter((slot) => slot.start + slot.width / 2 < x).length;
}

export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
