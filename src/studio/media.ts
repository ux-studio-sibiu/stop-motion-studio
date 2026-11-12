import { createImageCache } from "@/adapters/images/imageCache";
import type { Frame, ProjectRepository } from "@/core/model";

// The open project's thumbnails, in memory so the timeline can show them instantly.
// Full pictures stay in IndexedDB and are read when playback and export need them.
export const thumbs = createImageCache();

export function clearMedia(): void {
  thumbs.clear();
}

// Fetches the thumbnails of these frames that aren't in memory yet: all of them at once when
// a project opens, one by one when another tab adds a picture.
export async function loadMissingThumbs(repository: ProjectRepository, projectId: string, frames: readonly Frame[]): Promise<void> {
  const missing = [...new Set(frames.map((frame) => frame.imageId))].filter((id) => !thumbs.get(id));
  if (missing.length === 0) return;

  if (thumbs.size === 0) {
    for (const thumb of await repository.listThumbs(projectId)) thumbs.put(thumb.imageId, thumb.blob);
    return;
  }
  await Promise.all(missing.map(async (imageId) => {
    const blob = await repository.getThumb(imageId);
    if (blob) thumbs.put(imageId, blob);
  }));
}
