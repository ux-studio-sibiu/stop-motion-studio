"use client";

import Link from "next/link";
import { useState } from "react";
import { Clapperboard, Download, Pencil, Trash2 } from "lucide-react";
import { appRepository } from "@/adapters/storage/appRepository";
import { formatBytes } from "@/adapters/storage/storageInfo";
import { cleanName, type Project } from "@/core/model";

// One saved animation: its first picture, name, picture count, how much space it takes (step 21)
// and when it was last changed. Its actions: back up (a .zip, step 27), rename, delete.
// The name can be renamed in place (Enter or leaving the field saves, Escape cancels).
export function ProjectCard({ project, coverUrl, size, onDelete, onBackUp }: { project: Project; coverUrl?: string; size: number; onDelete: () => void; onBackUp: () => void }) {
  const [editing, setEditing] = useState(false);
  const href = `/studio?project=${project.id}`;
  const count = project.frameIds.length;

  const save = async (value: string) => {
    setEditing(false);
    const name = cleanName(value);
    if (name !== project.name) await appRepository().updateProject(project.id, { name });
  };

  return (
    <li className="nsc-project-card">
      <Link className="cover" href={href} aria-label={`Open ${project.name}`}>
        {/* A blob: URL from the cover cache; next/image can't optimise those. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {coverUrl ? <img src={coverUrl} alt="" draggable={false} /> : <Clapperboard size={40} aria-hidden="true" />}
      </Link>

      <div className="details">
        {editing ? (
          <input className="name-input" aria-label="Animation name" defaultValue={project.name} maxLength={80} autoFocus onFocus={(event) => event.currentTarget.select()} onBlur={(event) => void save(event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") setEditing(false);
          }} />
        ) : (
          <Link className="name" href={href}>{project.name}</Link>
        )}
        <p className="meta">{count === 1 ? "1 picture" : `${count} pictures`} · <span className="size">{formatBytes(size)}</span> · {new Date(project.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
      </div>

      <div className="actions">
        <button type="button" className="icon-button" aria-label={`Back up ${project.name}`} title="Save a backup (.zip), to keep or to open on another device" onClick={onBackUp}><Download size={20} /></button>
        <button type="button" className="icon-button" aria-label={`Rename ${project.name}`} onClick={() => setEditing(true)}><Pencil size={20} /></button>
        <button type="button" className="icon-button" aria-label={`Delete ${project.name}`} onClick={onDelete}><Trash2 size={20} /></button>
      </div>
    </li>
  );
}
