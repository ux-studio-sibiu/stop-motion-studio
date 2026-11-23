"use client";

import { useEffect, useState } from "react";
import { createImageCache } from "@/adapters/images/imageCache";
import { appRepository } from "@/adapters/storage/appRepository";
import { discardEmptyProjects } from "@/adapters/storage/projectSession";
import { forgetAnimation } from "@/studio/remembered";
import type { Project } from "@/core/model";
import { renderCover } from "./cover";

// The cards' covers: drawn ones keyed by animation and version ("id:updatedAt"), thumbnails by
// image id. Kept for the whole visit, so coming back to the page shows them straight away (only
// an animation that changed is drawn again); an old version's cover is let go.
export const covers = createImageCache();
const coverKeys = new Map<string, string>();   // each animation's drawn cover now, by animation id

// sizeOf: bytes each animation's pictures take (step 21), so a child can see what to delete.
export type ProjectList = { projects: Project[]; coverOf: Readonly<Record<string, string | undefined>>; sizeOf: Readonly<Record<string, number>> };

// Every saved project, newest first, kept up to date (a capture in another tab moves its
// project to the top). Null until the first answer. Covers load before the list updates, so a
// card never renders without its picture. Animations without pictures are thrown away first
// (discardEmptyProjects: a New that never took a picture), so they never show up as cards.
export function useProjects(): ProjectList | null {
  const [list, setList] = useState<ProjectList | null>(null);

  useEffect(() => {
    const repository = appRepository();
    let latest = 0;
    let stop = () => {};
    let stopped = false;

    const watch = () => repository.watchProjects(async (projects) => {
      const mine = ++latest;
      const sizes = repository.projectSizes();
      const stale: string[] = [];   // covers of older versions, let go once the new list is on screen
      // Each cover drawn sharp from the first picture (renderCover), once per version of the
      // animation (its id and when it last changed); the small thumbnail if that fails.
      const entries = await Promise.all(projects.map(async (project) => {
        const key = `${project.id}:${project.updatedAt}`;
        if (covers.get(key)) return [project.id, key] as const;
        const drawn = await renderCover(project).catch((error) => { console.warn("Couldn't draw a cover", error); return null; });
        if (drawn) {
          const before = coverKeys.get(project.id);
          if (before && before !== key) stale.push(before);   // the animation changed: its old cover goes
          coverKeys.set(project.id, key);
          covers.put(key, drawn);
          return [project.id, key] as const;
        }
        const thumb = await repository.getCover(project.id);
        if (thumb && !covers.get(thumb.imageId)) covers.put(thumb.imageId, thumb.blob);
        return [project.id, thumb?.imageId] as const;
      }));
      const sizeOf = await sizes;
      if (mine === latest) setList({ projects, coverOf: Object.fromEntries(entries), sizeOf });
      setTimeout(() => { for (const key of stale) covers.delete(key); }, 1000);
    }, (error) => console.error("Couldn't read the projects", error));

    void discardEmptyProjects(repository)
      .then((ids) => ids.forEach(forgetAnimation), (error) => console.warn("Couldn't clear empty animations", error))
      .then(() => { if (!stopped) stop = watch(); });

    return () => { latest++; stopped = true; stop(); };   // the covers stay, for the next visit (coming back from the studio)
  }, []);

  return list;
}
