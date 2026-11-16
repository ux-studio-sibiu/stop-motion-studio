"use client";

import { useEffect, useState } from "react";
import { createImageCache } from "@/adapters/images/imageCache";
import { appRepository } from "@/adapters/storage/appRepository";
import type { Project } from "@/core/model";

// Cover thumbnails for the cards, keyed by image id. Owned here, like the studio's thumbnail
// cache: object URLs are made once and revoked when the page closes.
export const covers = createImageCache();

// sizeOf: bytes each animation's pictures take (step 21), so a child can see what to delete.
export type ProjectList = { projects: Project[]; coverOf: Readonly<Record<string, string | undefined>>; sizeOf: Readonly<Record<string, number>> };

// Every saved project, newest first, kept up to date (a capture in another tab moves its
// project to the top). Null until the first answer. Covers load before the list updates, so a
// card never renders without its picture.
export function useProjects(): ProjectList | null {
  const [list, setList] = useState<ProjectList | null>(null);

  useEffect(() => {
    const repository = appRepository();
    let latest = 0;

    const stop = repository.watchProjects(async (projects) => {
      const mine = ++latest;
      const sizes = repository.projectSizes();
      const entries = await Promise.all(projects.map(async (project) => {
        const cover = await repository.getCover(project.id);
        if (cover && !covers.get(cover.imageId)) covers.put(cover.imageId, cover.blob);
        return [project.id, cover?.imageId] as const;
      }));
      const sizeOf = await sizes;
      if (mine === latest) setList({ projects, coverOf: Object.fromEntries(entries), sizeOf });
    }, (error) => console.error("Couldn't read the projects", error));

    return () => { latest++; stop(); covers.clear(); };
  }, []);

  return list;
}
