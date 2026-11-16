"use client";

import { HardDrive, X } from "lucide-react";
import { editorStore, useEditor } from "@/store/useEditor";

// What the studio says when storage runs out (step 21): in place of a picture that silently
// isn't saved, a short message a child can act on. "full" comes from a save that failed for lack
// of space (useHistory); "almost-full" from the browser's estimate going past 80% (useStorageWatch).
// It stays until it's closed; the next problem shows it again.
export function StorageNotice() {
  const notice = useEditor((state) => state.storageNotice);
  if (!notice) return null;
  const full = notice === "full";
  return (
    <div className={`nsc-storage-notice${full ? " is-full" : ""}`} role={full ? "alert" : "status"}>
      <HardDrive size={22} aria-hidden="true" />
      <p>
        {full
          ? <><strong>There&apos;s no room left on this device.</strong> That wasn&apos;t saved. Delete pictures or animations you don&apos;t need, then try again.</>
          : <><strong>This device is almost full.</strong> Delete animations you don&apos;t need to make room for more pictures.</>}
      </p>
      <button type="button" className="icon-button is-small" aria-label="Close message" onClick={() => editorStore.getState().setStorageNotice(null)}><X size={18} /></button>
    </div>
  );
}
