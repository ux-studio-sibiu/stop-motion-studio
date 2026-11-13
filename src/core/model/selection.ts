// Selecting pictures on the timeline. Selections are kept in timeline order, so "the last
// selected picture" is always the rightmost one.

// Everything between `anchor` (where a Shift+click range started) and `target`, both included.
// Without an anchor in the order, just the target.
export function selectRange(order: readonly string[], anchor: string | undefined, target: string): string[] {
  const from = anchor === undefined ? -1 : order.indexOf(anchor);
  const to = order.indexOf(target);
  if (to < 0) return [];
  if (from < 0) return [target];
  return order.slice(Math.min(from, to), Math.max(from, to) + 1);
}

// Ctrl/Cmd+click: adds the picture, or takes it out if it was selected. Result in timeline order.
export function toggleInSelection(order: readonly string[], selection: readonly string[], id: string): string[] {
  const selected = new Set(selection);
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  return inOrder(order, selected);
}

export function inOrder(order: readonly string[], ids: Iterable<string>): string[] {
  const wanted = new Set(ids);
  return order.filter((id) => wanted.has(id));
}

// Where the next picture goes: right after the rightmost selected picture, or at the end.
export function insertIndexAfter(order: readonly string[], selection: readonly string[]): number {
  const selected = new Set(selection);
  const last = order.findLastIndex((id) => selected.has(id));
  return last < 0 ? order.length : last + 1;
}
