// How much browser storage the studio uses, and asking the browser to keep it.
// Both APIs are optional and their answers are estimates, so both functions degrade to
// "don't know" instead of throwing.

export type StorageEstimate = { usage: number; quota: number; ratio: number };

export async function estimateStorage(): Promise<StorageEstimate | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate?.quota) return null;
    const usage = estimate.usage ?? 0;
    return { usage, quota: estimate.quota, ratio: Math.min(1, usage / estimate.quota) };
  } catch {
    return null;
  }
}

// Best-effort storage can be cleared by the browser when the disk runs low; persistent
// storage is only cleared by the user. Browsers may grant it silently, ask, or say no.
// Returns whether it's persistent now; never blocks or throws.
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

// Whether the browser already promised to keep the data. Asking (persist) can show a prompt,
// so places that only want to show the state use this instead.
export async function isStoragePersistent(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}

// "12 MB", "1.5 GB": rounded for people, not for accountants.
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${Math.max(0, Math.round(bytes || 0))} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value < 10 ? value.toFixed(1).replace(/\.0$/, "") : Math.round(value)} ${units[unit]}`;
}
