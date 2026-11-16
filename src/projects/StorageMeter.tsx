"use client";

import { useEffect, useState } from "react";
import { ALMOST_FULL, estimateStorage, formatBytes, isStoragePersistent, type StorageEstimate } from "@/adapters/storage/storageInfo";

// How much of this browser's storage the studio uses. Browsers only give estimates, so the
// wording says "about". Refreshes when `version` changes (a project added or deleted).
// Hidden when the browser can't tell.
export function StorageMeter({ version }: { version: unknown }) {
  const [info, setInfo] = useState<{ estimate: StorageEstimate; persistent: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([estimateStorage(), isStoragePersistent()]).then(([estimate, persistent]) => {
      if (active) setInfo(estimate ? { estimate, persistent } : null);
    });
    return () => { active = false; };
  }, [version]);

  if (!info) return null;
  const { estimate, persistent } = info;

  return (
    <section className="nsc-storage-meter" aria-label="Storage on this device">
      <p className="usage">
        Using <strong>{formatBytes(estimate.usage)}</strong> of about {formatBytes(estimate.quota)} on this device
      </p>
      <meter min={0} max={1} high={ALMOST_FULL} optimum={0} value={estimate.ratio} aria-label="Storage used" />
      {estimate.ratio >= ALMOST_FULL && <p className="warning" role="status"><strong>Almost full.</strong> Delete animations you don&apos;t need to make room for more pictures: each card says how much space it takes.</p>}
      <p className="note">{persistent ? "The browser has promised to keep your animations." : "The browser may clear your animations if the device runs out of space. Save a copy of the ones you love (coming soon)."}</p>
    </section>
  );
}
