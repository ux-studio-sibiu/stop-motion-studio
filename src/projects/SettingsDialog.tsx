"use client";

import { Download, FolderDown, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { exportAllArchives } from "@/adapters/archive/projectArchive";
import { appRepository } from "@/adapters/storage/appRepository";
import { install, useOffline } from "@/offline/serviceWorker";
import { download } from "@/studio/useExport";
import { addDemos } from "./demos";
import { StorageMeter } from "./StorageMeter";
import { useModalDialog } from "./useModalDialog";

// The home page's settings, in a modal <dialog> (focus kept inside, Escape or the X closes it): how
// much of this device's storage the studio uses; a backup of every animation in one .zip (Load
// project restores it); the demo animations, added again (projects/demos.ts); whether the studio
// works offline here (step 32), with the browser's Install offer when there is one.
export function SettingsDialog({ open, version, animations, onClose }: { open: boolean; version: unknown; animations: number; onClose: () => void }) {
  const dialog = useModalDialog(open);
  const { ready, canInstall } = useOffline();
  const [busy, setBusy] = useState<"backup" | "demos" | null>(null);   // one at a time
  const [note, setNote] = useState<{ text: string; problem: boolean } | null>(null);

  const backUpAll = async () => {
    setBusy("backup");
    setNote(null);
    try {
      const { blob, name, count } = await exportAllArchives(appRepository());
      download(blob, name);
      setNote({ text: `Saved ${count} animation${count === 1 ? "" : "s"}: ${name}`, problem: false });
    } catch (error) {
      console.warn("Backup of all animations failed", error);
      setNote({ text: "The backup couldn't be made. Try again.", problem: true });
    } finally {
      setBusy(null);
    }
  };
  const addDemoAnimations = async () => {
    setBusy("demos");
    setNote(null);
    try {
      const count = await addDemos();
      setNote({ text: `Added ${count} demo animation${count === 1 ? "" : "s"}`, problem: false });
    } catch (error) {
      console.warn("Adding the demo animations failed", error);
      setNote({ text: "The demo animations couldn't be added. Check the internet and try again.", problem: true });
    } finally {
      setBusy(null);
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
          <button type="button" className="icon-button settings-action" onClick={() => void backUpAll()} disabled={busy !== null || animations === 0} aria-busy={busy === "backup"}
            title="Save every animation in one backup (.zip), to keep or to open on another device"><FolderDown size={18} aria-hidden="true" />{busy === "backup" ? "Saving…" : "Download all animations"}</button>
          <button type="button" className="icon-button settings-action" onClick={() => void addDemoAnimations()} disabled={busy !== null} aria-busy={busy === "demos"}
            title="Add the animations that come with the studio, to play or to change"><Sparkles size={18} aria-hidden="true" />{busy === "demos" ? "Adding…" : "Add the demo animations"}</button>
          {note && <p className={`settings-note${note.problem ? " is-problem" : ""}`} role="status">{note.text}</p>}
          {ready && <p className="offline-note">The studio is saved on this device: it works without the internet too.</p>}
          {canInstall && <button type="button" className="icon-button settings-action" onClick={() => install()}><Download size={18} aria-hidden="true" />Install the studio</button>}
        </>
      )}
    </dialog>
  );
}
