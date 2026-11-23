"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appRepository } from "@/adapters/storage/appRepository";
import { drawExportFrame } from "@/core/export/frame";
import { frameIndexAt, overlaysOf, totalTicks, type Frame, type Project } from "@/core/model";
import { readClock, startClock } from "@/core/playback/clock";
import { projectExportRect, type DrawableImage } from "@/core/render";
import { COVER_WIDTH } from "./cover";

// The card plays its animation while the pointer is over it, or while it has the keyboard: drawn
// by the studio's own renderer and clock, like playback and a video (each picture as long as it's
// held, its position, look and objects, the objects in time), only what's inside the safe zone,
// looping, without sound. The pictures are opened only then, the first ones first so it starts
// quickly, and let go when it stops (an animation's pictures take tens of MB once opened). Not
// with "reduce motion" on. `canvas` goes over the still cover; `playing` says when to show it.
export function useCardPreview(project: Project) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const run = useRef<{ stop: () => void } | null>(null);

  const stop = useCallback(() => {
    run.current?.stop();
    run.current = null;
    setPlaying(false);
  }, []);

  const start = useCallback(() => {
    if (run.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let stopped = false;
    let request = 0;
    const opened = new Map<string, ImageBitmap>();
    run.current = {
      stop: () => {
        stopped = true;
        cancelAnimationFrame(request);
        for (const bitmap of opened.values()) bitmap.close();
        opened.clear();
      },
    };

    void (async () => {
      const repository = appRepository();
      const loaded = await repository.loadProject(project.id);
      const element = canvas.current;
      if (stopped || !loaded || !element) return;
      const byId = new Map(loaded.frames.map((frame) => [frame.id, frame]));
      const frames = loaded.project.frameIds.flatMap((id): Frame[] => { const frame = byId.get(id); return frame ? [frame] : []; });
      const total = totalTicks(frames);
      if (frames.length < 2 || total < 2) return;   // one picture: the still cover already shows it

      const rect = projectExportRect(loaded.project);
      element.width = Math.min(COVER_WIDTH, rect.width);
      element.height = Math.max(1, Math.round((element.width * rect.height) / rect.width));
      const out = element.getContext("2d");
      const full = new OffscreenCanvas(loaded.project.width, loaded.project.height).getContext("2d");
      const crop = new OffscreenCanvas(rect.width, rect.height).getContext("2d");
      if (!out || !full || !crop) return;
      const scene = { width: loaded.project.width, height: loaded.project.height, frames, overlays: overlaysOf(loaded.project) };
      const images = (imageId: string) => opened.get(imageId) as DrawableImage | undefined;

      // Open the pictures in order, in the background; playing starts once the first is ready.
      const open = async () => {
        for (const imageId of [...new Set(frames.map((frame) => frame.imageId))]) {
          if (stopped) return;
          const blob = await repository.getImage(imageId);
          if (!blob || stopped) continue;
          const bitmap = await createImageBitmap(blob).catch(() => null);
          if (!bitmap) continue;
          if (stopped) { bitmap.close(); return; }
          opened.set(imageId, bitmap);
        }
      };
      const opening = open();
      while (!stopped && !opened.has(frames[0].imageId)) await Promise.race([opening, new Promise((wait) => setTimeout(wait, 30))]);
      if (stopped) return;

      const clock = startClock(performance.now(), 0, loaded.project.fps, total, true);
      let shown = -1;
      const step = (now: number) => {
        if (stopped) return;
        const { tick } = readClock(clock, now);
        // A picture not opened yet: keep the one before on screen until it is.
        if (tick !== shown && opened.has(frames[frameIndexAt(frames, tick)]?.imageId ?? "")) {
          drawExportFrame({ full, crop, out }, scene, images, tick, rect);
          shown = tick;
        }
        request = requestAnimationFrame(step);
      };
      setPlaying(true);
      request = requestAnimationFrame(step);
    })().catch((error) => console.warn("Couldn't play the card", error));
  }, [project.id]);

  useEffect(() => stop, [stop]);   // the card goes away: let the pictures go
  return { canvas, playing, start, stop };
}
