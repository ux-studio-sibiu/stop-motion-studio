"use client";

import Link from "next/link";
import { useState } from "react";
import { Clapperboard, Download, Trash2 } from "lucide-react";
import { appRepository } from "@/adapters/storage/appRepository";
import { formatBytes } from "@/adapters/storage/storageInfo";
import { cleanName, type Project } from "@/core/model";
import { useCardPreview } from "./useCardPreview";
import "./cardboard-letters/cardboard-letters.css";   // the cardboard's shared colours and shadow (also on the design page)

// One saved animation: its first picture, name, picture count, how much space it takes (step 21)
// and when it was last changed. Its actions: back up (a .zip, step 27), delete. A click on the
// name renames it in place, the field exactly the name's size, so the card doesn't move (Enter or
// leaving the field saves, Escape cancels).
export function ProjectCard({ project, coverUrl, size, onDelete, onBackUp }: { project: Project; coverUrl?: string; size: number; onDelete: () => void; onBackUp: () => void }) {
  const [editing, setEditing] = useState(false);
  const { canvas: previewCanvas, playing, start: startPreview, stop: stopPreview } = useCardPreview(project);
  const href = `/studio?project=${project.id}`;
  const count = project.frameIds.length;

  const save = async (value: string) => {
    setEditing(false);
    const name = cleanName(value);
    if (name !== project.name) await appRepository().updateProject(project.id, { name });
  };

  return (
    <li className="nsc-project-card">
      {/* Playing while the pointer is over it or it has the keyboard (useCardPreview), over the still cover. */}
      <Link className="cover" href={href} aria-label={`Open ${project.name}`} onPointerEnter={startPreview} onPointerLeave={stopPreview} onFocus={startPreview} onBlur={stopPreview}>
        {/* A blob: URL from the cover cache; next/image can't optimise those. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {coverUrl ? <img src={coverUrl} alt="" draggable={false} /> : <Clapperboard size={40} aria-hidden="true" />}
        <canvas ref={previewCanvas} className={`preview${playing ? " is-playing" : ""}`} aria-hidden="true" />
      </Link>
      {/* How many pictures: always, bottom left, beside the buttons. */}
      <span className="picture-count">{count === 1 ? "1 picture" : `${count} pictures`}</span>

      <div className="details">
        {editing ? (
          <input className="name-input" aria-label="Animation name" defaultValue={project.name} maxLength={80} autoFocus onFocus={(event) => { const end = event.currentTarget.value.length; event.currentTarget.setSelectionRange(end, end); }} onBlur={(event) => void save(event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") setEditing(false);
          }} />
        ) : (
          // The name: a click (or Enter) turns it into the field above, in its place (the cover opens the animation).
          <button type="button" className="name" aria-label={`Rename ${project.name}`} title="Click to rename" onClick={() => setEditing(true)}>{project.name}</button>
        )}
        <p className="meta"><span className="size">{formatBytes(size)}</span> · {new Date(project.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
      </div>

      <div className="actions">
        <button type="button" className="icon-button is-small" aria-label={`Back up ${project.name}`} title="Save a backup (.zip), to keep or to open on another device" onClick={onBackUp}><Download size={20} /></button>
        <button type="button" className="icon-button is-small" aria-label={`Delete ${project.name}`} onClick={onDelete}><Trash2 size={20} /></button>
      </div>
    </li>
  );
}
