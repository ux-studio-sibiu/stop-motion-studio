"use client";

import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { applyUpdate, startOffline, useOffline } from "./serviceWorker";
import "./_offline.scss";

// In the root layout, on every page (step 32): starts the service worker and, when this page was
// opened from the stored copy (offline) and a newer version has come since, says so with an Update
// button. Nothing reloads until it's pressed, so a child in the middle of an animation isn't
// interrupted. Online, pages are always the latest and it never shows.
export function OfflineSupport() {
  const { update } = useOffline();
  useEffect(() => startOffline(), []);
  if (!update) return null;
  return (
    <div className="nsc-update-notice" role="status">
      <span>A new version of the studio is ready.</span>
      <button type="button" className="icon-button is-small is-primary" onClick={applyUpdate}><RefreshCw size={16} aria-hidden="true" />Update</button>
    </div>
  );
}
