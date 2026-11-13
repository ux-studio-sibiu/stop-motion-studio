"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { appRepository } from "@/adapters/storage/appRepository";
import { repairFrameOrder, sameOrder } from "@/core/model";
import { createSavedProject } from "@/projects/createSavedProject";
import { editorStore } from "@/store/useEditor";
import { clearMedia, loadMissingThumbs } from "./media";

export type ProjectStatus = "loading" | "ready" | "missing";

// Connects the studio to the saved project named in ?project=.
//   - no id: create a project, save it, and put its id in the URL
//   - an id: follow it in storage; every change (a capture here, an edit in another tab)
//     flows into the editor store. Storage is the source of truth, the store mirrors it.
export function useProject(projectId: string | null): ProjectStatus {
  const router = useRouter();
  const creating = useRef(false);
  const [settled, setSettled] = useState<{ id: string; status: ProjectStatus } | null>(null);

  useEffect(() => {
    if (projectId || creating.current) return;   // the ref stops Strict Mode's second run making a second project
    creating.current = true;
    void createSavedProject().then((id) => {
      creating.current = false;
      router.replace(`/studio?project=${id}`);   // replace, not push: Back shouldn't return to an empty URL
    });
  }, [projectId, router]);

  useEffect(() => {
    if (!projectId) return;
    const repository = appRepository();
    let latest = 0;

    const stop = repository.watchProject(projectId, async (loaded) => {
      const mine = ++latest;
      if (!loaded) { setSettled({ id: projectId, status: "missing" }); return; }

      const frameIds = repairFrameOrder(loaded.project.frameIds, loaded.frames);
      if (!sameOrder(frameIds, loaded.project.frameIds)) {
        void repository.updateProject(projectId, { frameIds });   // the save triggers a fresh, repaired update
        return;
      }

      // Thumbnails first, so the timeline never renders a picture it can't show.
      await loadMissingThumbs(repository, projectId, loaded.frames);
      if (mine !== latest) return;   // a newer update arrived while thumbnails loaded
      editorStore.getState().syncProject(loaded.project, loaded.frames);
      setSettled({ id: projectId, status: "ready" });
    }, (error) => console.error("Couldn't read the project", error));

    return () => {
      latest++;
      stop();
      editorStore.getState().unloadProject();
      clearMedia();
    };
  }, [projectId]);

  return projectId && settled?.id === projectId ? settled.status : "loading";
}
