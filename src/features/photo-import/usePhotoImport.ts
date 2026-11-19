"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { preparePhoto } from "@/adapters/images/photo";
import { addFrames, type Command } from "@/core/commands";
import { createFrame, inOrder, newId, type StoredImage, type StoredThumb, type Frame } from "@/core/model";
import { isHeic, isPhotoFile, PHOTO_LIMITS, photoNote, photoOrder, type PhotoResult } from "@/core/photos";
import { editorStore } from "@/store/useEditor";
import { thumbs } from "@/studio/media";
import { checkStorage } from "@/studio/useStorageWatch";

export type PhotoNote = { text: string; problem: boolean };

// Adding photos from the computer (step 28), from the Add photos button or dropped on the studio:
// they're opened one by one (photoOrder: by name), shrunk to the animation's size, and then saved
// like a capture, after the selected picture, all in one command, so one undo takes them all back.
// One import at a time; a short note afterwards says what was added and why any weren't.
export function usePhotoImport(run: (command: Command) => Promise<boolean>) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [note, setNote] = useState<PhotoNote | null>(null);
  const busy = useRef(false);

  useEffect(() => { if (!note) return; const timer = setTimeout(() => setNote(null), note.problem ? 12000 : 6000); return () => clearTimeout(timer); }, [note]);

  const importFiles = useCallback(async (list: Iterable<File>) => {
    const project = editorStore.getState().project;
    if (!project || busy.current) return;
    const files = Array.from(list);
    const photos = photoOrder(files.filter(isPhotoFile));
    const taken = photos.slice(0, PHOTO_LIMITS.files);
    const result: PhotoResult = { added: 0, heic: 0, broken: 0, tooBig: 0, notPhotos: files.length - photos.length, overLimit: photos.length - taken.length };
    if (taken.length === 0) { setNote(photoNote(result)); return; }

    busy.current = true;
    setNote(null);
    setProgress({ done: 0, total: taken.length });
    try {
      const frames: Frame[] = [];
      const images: StoredImage[] = [];
      const small: StoredThumb[] = [];
      for (const [index, file] of taken.entries()) {
        if (file.size > PHOTO_LIMITS.fileBytes) result.tooBig++;
        else {
          try {
            const photo = await preparePhoto(file, project);
            const imageId = newId();
            frames.push(createFrame(project.id, imageId));
            images.push({ id: imageId, projectId: project.id, blob: photo.image, width: photo.width, height: photo.height, createdAt: Date.now() });
            small.push({ imageId, projectId: project.id, blob: photo.thumb });
          } catch (error) {
            console.warn("Couldn't open a photo", file.name, error);
            if (isHeic(file)) result.heic++; else result.broken++;
          }
        }
        setProgress({ done: index + 1, total: taken.length });
      }
      if (editorStore.getState().project?.id !== project.id) return;   // left the project meanwhile

      if (frames.length > 0) {
        editorStore.getState().pause();
        for (const thumb of small) thumbs.put(thumb.imageId, thumb.blob);   // in memory before the save, so the update finds it
        const after = inOrder(editorStore.getState().project?.frameIds ?? [], editorStore.getState().selection).at(-1);
        const label = frames.length === 1 ? "Add photo" : `Add ${frames.length} photos`;
        if (!(await run(addFrames(project.id, { after, frames, images, thumbs: small }, label)))) return;   // a failed save shows its own message (useHistory)
        result.added = frames.length;
        void checkStorage();
      }
      setNote(photoNote(result));
    } finally {
      busy.current = false;
      setProgress(null);
    }
  }, [run]);

  return { importFiles, progress, busy: progress !== null, note };
}

export type PhotoImport = ReturnType<typeof usePhotoImport>;
