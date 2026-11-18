"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Clapperboard, Plus } from "lucide-react";
import { exportArchive, importArchive } from "@/adapters/archive/projectArchive";
import { decodePicture } from "@/adapters/images/thumbnail";
import { ArchiveError } from "@/core/archive";
import { download } from "@/studio/useExport";
import { forgetAnimation } from "@/studio/remembered";
import { appRepository } from "@/adapters/storage/appRepository";
import type { Project } from "@/core/model";
import { createSavedProject } from "./createSavedProject";
import { DeleteDialog } from "./DeleteDialog";
import { ProjectCard } from "./ProjectCard";
import { StorageMeter } from "./StorageMeter";
import { covers, useProjects } from "./useProjects";
import "./projects.scss";

// The home page: every animation saved in this browser, newest first. Each can be backed up as a
// .zip (step 27), and a backup restored here, as a new animation, on this device or another.
export function ProjectsPage() {
  const router = useRouter();
  const list = useProjects();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [archiveNote, setArchiveNote] = useState<{ text: string; problem: boolean } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const backUp = async (project: Project) => {
    try {
      const { blob, name } = await exportArchive(appRepository(), project.id);
      download(blob, name);
      setArchiveNote({ text: `Saved a backup of ${project.name}: ${name}`, problem: false });
    } catch (error) {
      console.warn("Backup failed", error);
      setArchiveNote({ text: `The backup of ${project.name} couldn't be made. Try again.`, problem: true });
    }
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    setRestoring(true);
    setArchiveNote(null);
    try {
      const project = await importArchive(appRepository(), file, { decode: decodePicture });
      setArchiveNote({ text: `Restored ${project.name}`, problem: false });
    } catch (error) {
      if (!(error instanceof ArchiveError)) console.warn("Restore failed", error);
      setArchiveNote({ text: error instanceof ArchiveError ? error.message : "That backup couldn't be restored. Try again.", problem: true });
    } finally {
      setRestoring(false);
      if (picker.current) picker.current.value = "";   // the same file can be picked again
    }
  };

  const startNew = async () => {
    setCreating(true);
    router.push(`/studio?project=${await createSavedProject()}`);
  };

  const confirmDelete = async () => {
    const project = deleting;
    setDeleting(null);
    if (!project) return;
    await appRepository().deleteProject(project.id);
    forgetAnimation(project.id);   // what was remembered about it goes too
  };

  const coverUrl = (project: Project) => {
    const imageId = list?.coverOf[project.id];
    return imageId ? covers.url(imageId) : undefined;
  };

  return (
    <main id="nsc--home">
      <header className="masthead">
        <h1>Stop-motion Studio</h1>
        <p className="lede">Take pictures, move your toys a little, take more pictures. Then press play.</p>
        <button type="button" className="start" onClick={startNew} disabled={creating}><Plus size={32} />New animation</button>
        <button type="button" className="icon-button restore" onClick={() => picker.current?.click()} disabled={restoring} aria-busy={restoring}><ArchiveRestore size={22} />{restoring ? "Restoring…" : "Restore a backup"}</button>
        <input ref={picker} type="file" accept=".zip,application/zip" hidden aria-label="Backup file" onChange={(event) => void restore(event.currentTarget.files?.[0])} />
        {archiveNote && <p className={`archive-note${archiveNote.problem ? " is-problem" : ""}`} role="status">{archiveNote.text}</p>}
      </header>

      {list === null && <p className="status">Loading your animations…</p>}

      {list?.projects.length === 0 && (
        <div className="empty">
          <Clapperboard size={48} aria-hidden="true" />
          <p>No animations yet. Press <strong>New animation</strong> to make your first one.</p>
        </div>
      )}

      {list && list.projects.length > 0 && (
        <section aria-labelledby="projects-title">
          <h2 id="projects-title" className="section-title">Your animations</h2>
          <ul className="projects">
            {list.projects.map((project) => <ProjectCard key={project.id} project={project} coverUrl={coverUrl(project)} size={list.sizeOf[project.id] ?? 0} onDelete={() => setDeleting(project)} onBackUp={() => void backUp(project)} />)}
          </ul>
        </section>
      )}

      {list && <StorageMeter version={list.projects} />}

      <p className="notes"><a href="steps/index.html">How it&apos;s built, step by step</a></p>

      <DeleteDialog project={deleting} coverUrl={deleting ? coverUrl(deleting) : undefined} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />
    </main>
  );
}
