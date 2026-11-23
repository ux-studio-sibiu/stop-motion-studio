"use client";

import { appRepository } from "@/adapters/storage/appRepository";
import { drawExportFrame } from "@/core/export/frame";
import { overlaysOf, type Project } from "@/core/model";
import { projectExportRect, type DrawableImage } from "@/core/render";

// A card's cover: the animation's first picture as a video of it would start, so what's inside the
// safe zone, with the picture's position, look, objects and the objects in time showing then.
// Drawn from the full-size photo at COVER_WIDTH, so it's sharp on the card (also on a
// high-density screen), not the timeline's small thumbnail scaled up. A JPEG, or a PNG when the
// first picture is empty (see-through). null when there's no picture, or it can't be drawn.
export const COVER_WIDTH = 640;

export async function renderCover(project: Project): Promise<Blob | null> {
  const repository = appRepository();
  const loaded = await repository.loadProject(project.id);
  const first = loaded?.frames.find((frame) => frame.id === loaded.project.frameIds[0]);
  if (!loaded || !first) return null;
  const stored = await repository.getImage(first.imageId);
  if (!stored) return null;
  const bitmap = await createImageBitmap(stored);
  try {
    const rect = projectExportRect(loaded.project);
    const width = Math.min(COVER_WIDTH, rect.width);
    const height = Math.max(1, Math.round((width * rect.height) / rect.width));
    const canvas = (w: number, h: number) => {
      const ctx = new OffscreenCanvas(w, h).getContext("2d");
      if (!ctx) throw new Error("Canvas 2D isn't available.");
      return ctx;
    };
    const out = canvas(width, height);
    const scene = { width: loaded.project.width, height: loaded.project.height, frames: [first], overlays: overlaysOf(loaded.project) };
    drawExportFrame({ full: canvas(scene.width, scene.height), crop: canvas(rect.width, rect.height), out }, scene, () => bitmap as DrawableImage, 0, rect);
    return await out.canvas.convertToBlob(first.empty ? { type: "image/png" } : { type: "image/jpeg", quality: 0.85 });
  } finally {
    bitmap.close();
  }
}
