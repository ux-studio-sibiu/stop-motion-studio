// Saving a burst of edits once it stops (steps 18 and 20): a run of arrow presses, wheel turns or
// typed numbers is saved a moment after the last one, so it's one undo step, not sixty. Shared by
// every kind of edit, so there's only ever one save waiting: starting a different kind (moving
// after brightness, say) saves the waiting one first, and nothing is lost or saved twice.

export const BURST_DELAY = 600;   // ms of quiet before a burst is saved

// `kind` says what is waiting ("transform", "adjust"); `key` tells bursts of that kind apart
// (which pictures, which change). The same kind and key just waits longer.
let waiting: { kind: string; key: string; save: () => void; timer: ReturnType<typeof setTimeout> } | null = null;

export function saveSoon(kind: string, key: string, save: () => void, delay = BURST_DELAY): void {
  if (waiting && (waiting.kind !== kind || waiting.key !== key)) saveNow();
  if (waiting) clearTimeout(waiting.timer);
  waiting = { kind, key, save, timer: setTimeout(saveNow, delay) };
}

// Saves what's waiting, now.
export function saveNow(): void {
  const current = waiting;
  waiting = null;
  if (!current) return;
  clearTimeout(current.timer);
  current.save();
}

// Before an edit of `kind` is saved or cancelled straight away: a waiting burst of the same kind is
// dropped (that edit covers it), one of another kind is saved first.
export function settleSoon(kind: string): void {
  if (!waiting) return;
  if (waiting.kind === kind) { clearTimeout(waiting.timer); waiting = null; }
  else saveNow();
}
