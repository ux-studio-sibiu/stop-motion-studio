"use client";

import { Download, FolderDown, X } from "lucide-react";
import { useState } from "react";
import { exportAllArchives } from "@/adapters/archive/projectArchive";
import { appRepository } from "@/adapters/storage/appRepository";
import { install, useOffline } from "@/offline/serviceWorker";
import { download } from "@/studio/useExport";
import { StorageMeter } from "./StorageMeter";
import { useModalDialog } from "./useModalDialog";

// The home page's settings, in a modal <dialog> (focus kept inside, Escape or the X closes it): how
// much of this device's storage the studio uses; a backup of every animation in one .zip (Load
// project restores it); whether the studio works offline here (step 32), with the browser's
// Install offer when there is one.
export function SettingsDialog({ open, version, animations, onClose }: { open: boolean; version: unknown; animations: number; onClose: () => void }) {
  const dialog = useModalDialog(open);
  const { ready, canInstall } = useOffline();
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ text: string; problem: boolean } | null>(null);

  const backUpAll = async () => {
    setSaving(true);
    setNote(null);
    try {
      const { blob, name, count } = await exportAllArchives(appRepository());
      download(blob, name);
      setNote({ text: `Saved ${count} animation${count === 1 ? "" : "s"}: ${name}`, problem: false });
    } catch (error) {
      console.warn("Backup of all animations failed", error);
      setNote({ text: "The backup couldn't be made. Try again.", problem: true });
    } finally {
      setSaving(false);
    }
  };
  const close = () => { setNote(null); onClose(); };

  return (
    <dialog ref={dialog} className="nsc-settings-dialog" aria-labelledby="settings-title" onCancel={(event) => { event.preventDefault(); close(); }}>
      {open && (
        <>
          <button type="button" className="icon-button is-small close-button" aria-label="Close" title="Close" onClick={close}><X size={20} /></button>
          <h2 id="settings-title">Settings</h2>
          <StorageMeter version={version} />
          <button type="button" className="icon-button settings-action" onClick={() => void backUpAll()} disabled={saving || animations === 0} aria-busy={saving}
            title="Save every animation in one backup (.zip), to keep or to open on another device"><FolderDown size={18} aria-hidden="true" />{saving ? "Saving…" : "Download all animations"}</button>
          {note && <p className={`settings-note${note.problem ? " is-problem" : ""}`} role="status">{note.text}</p>}
          {ready && <p className="offline-note">The studio is saved on this device: it works without the internet too.</p>}
          {canInstall && <button type="button" className="icon-button settings-action" onClick={() => install()}><Download size={18} aria-hidden="true" />Install the studio</button>}
        </>
      )}
    </dialog>
  );
}
