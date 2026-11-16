// Whether a failed save failed because the device is out of space (step 21). Browsers report it as
// a QuotaExceededError (old Safari: code 22); Dexie may wrap it, for example in the AbortError of
// the transaction it ended, so the inner errors are checked too.
export function isStorageFull(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === "object" && depth < 5; depth++) {
    const { name, code, inner, cause } = current as { name?: unknown; code?: unknown; inner?: unknown; cause?: unknown };
    if (name === "QuotaExceededError" || code === 22) return true;
    current = inner ?? cause;
  }
  return false;
}
