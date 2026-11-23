"use client";

import { useEffect, useState } from "react";
import { ALMOST_FULL, estimateStorage, formatBytes, type StorageEstimate } from "@/adapters/storage/storageInfo";

// How much of this browser's storage the studio uses. Browsers only give estimates, so the wording
// says "about". Refreshes when `version` changes (a project added or deleted). Null while the
// browser can't tell.
function useStorageEstimate(version: unknown): StorageEstimate | null {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  useEffect(() => {
    let active = true;
    void estimateStorage().then((found) => { if (active) setEstimate(found); });
    return () => { active = false; };
  }, [version]);
  return estimate;
}

const AlmostFull = () => <p className="warning" role="status"><strong>Almost full.</strong> Delete animations you don&apos;t need to make room for more pictures: each card says how much space it takes.</p>;

// The usage in one small line with a thin bar (in the Settings window). Hidden when the browser
// can't tell. When it's almost full it says so, and what to do.
export function StorageMeter({ version }: { version: unknown }) {
  const estimate = useStorageEstimate(version);
  if (!estimate) return null;

  return (
    <section className="nsc-storage-meter" aria-label="Storage on this device">
      <p className="usage">Using <strong>{formatBytes(estimate.usage)}</strong> of about {formatBytes(estimate.quota)} on this device</p>
      <meter min={0} max={1} high={ALMOST_FULL} optimum={0} value={estimate.ratio} aria-label="Storage used" />
      {estimate.ratio >= ALMOST_FULL && <AlmostFull />}
    </section>
  );
}

// On the home page itself, only when it's almost full: a child has to see that without opening
// the Settings window.
export function StorageWarning({ version }: { version: unknown }) {
  const estimate = useStorageEstimate(version);
  if (!estimate || estimate.ratio < ALMOST_FULL) return null;
  return <section className="nsc-storage-meter" aria-label="Storage almost full"><AlmostFull /></section>;
}
