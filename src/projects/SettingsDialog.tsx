"use client";

import { StorageMeter } from "./StorageMeter";
import { useModalDialog } from "./useModalDialog";

// The home page's settings, in a modal <dialog> (focus kept inside, Escape closes it): for now, how
// much of this device's storage the studio uses.
export function SettingsDialog({ open, version, onClose }: { open: boolean; version: unknown; onClose: () => void }) {
  const dialog = useModalDialog(open);

  return (
    <dialog ref={dialog} className="nsc-settings-dialog" aria-labelledby="settings-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      {open && (
        <>
          <h2 id="settings-title">Settings</h2>
          <StorageMeter version={version} />
          <div className="buttons">
            <button type="button" className="icon-button" onClick={onClose} autoFocus>Close</button>
          </div>
        </>
      )}
    </dialog>
  );
}
