"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Plus } from "lucide-react";
import { remembered } from "@/studio/remembered";
import { appRepository } from "@/adapters/storage/appRepository";
import type { Project } from "@/core/model";
import { createSavedProject } from "./createSavedProject";
import { DeleteDialog } from "./DeleteDialog";
import { ProjectCard } from "./ProjectCard";
import { StorageMeter } from "./StorageMeter";
import { covers, useProjects } from "./useProjects";
import "./projects.scss";

// The home page: every animation saved in this browser, newest first.
export function ProjectsPage() {
  const router = useRouter();
  const list = useProjects();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const startNew = async () => {
    setCreating(true);
    router.push(`/studio?project=${await createSavedProject()}`);
  };

  const confirmDelete = async () => {
    const project = deleting;
    setDeleting(null);
    if (!project) return;
    await appRepository().deleteProject(project.id);
    remembered.timelineView(project.id).save(null);   // what was remembered about it goes too
    remembered.selection(project.id).save(null);
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
            {list.projects.map((project) => <ProjectCard key={project.id} project={project} coverUrl={coverUrl(project)} size={list.sizeOf[project.id] ?? 0} onDelete={() => setDeleting(project)} />)}
          </ul>
        </section>
      )}

      {list && <StorageMeter version={list.projects} />}

      <p className="notes"><a href="steps/index.html">How it&apos;s built, step by step</a></p>

      <DeleteDialog project={deleting} coverUrl={deleting ? coverUrl(deleting) : undefined} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />
    </main>
  );
}
