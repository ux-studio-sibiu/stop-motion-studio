"use client";

import { useEffect, useRef } from "react";
import { Clapperboard } from "lucide-react";
import type { Project } from "@/core/model";

// Deleting a project is the one thing undo can't bring back, so it asks first, showing the
// picture and name, with "Keep it" as the default (focused) answer. A modal <dialog> keeps focus
// inside, closes on Escape, and is announced as a dialog by screen readers.
export function DeleteDialog({ project, coverUrl, onCancel, onConfirm }: { project: Project | null; coverUrl?: string; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (project && !element.open) element.showModal();
    if (!project && element.open) element.close();
  }, [project]);

  const count = project?.frameIds.length ?? 0;

  return (
    <dialog ref={dialog} className="nsc-delete-dialog" aria-labelledby="delete-title" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      {project && (
        <>
          <div className="cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {coverUrl ? <img src={coverUrl} alt="" /> : <Clapperboard size={40} aria-hidden="true" />}
          </div>
          <h2 id="delete-title">Delete &ldquo;{project.name}&rdquo;?</h2>
          <p>{count === 0 ? "It has no pictures yet." : `Its ${count === 1 ? "picture" : `${count} pictures`} will be gone for good.`} This can&apos;t be undone.</p>
          <div className="buttons">
            <button type="button" className="icon-button" onClick={onCancel} autoFocus>Keep it</button>
            <button type="button" className="icon-button is-danger" onClick={onConfirm}>Delete</button>
          </div>
        </>
      )}
    </dialog>
  );
}
