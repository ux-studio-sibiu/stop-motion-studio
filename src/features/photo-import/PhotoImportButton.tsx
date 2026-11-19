"use client";

import { ImagePlus } from "lucide-react";
import { useRef } from "react";
import type { PhotoImport } from "./usePhotoImport";

// Add photos (a small icon in the timeline's tools, between Duplicate and Delete): picks photos
// from the computer, as many as wanted. How far it got shows in the note above the timeline.
export function PhotoImportButton({ photos, disabled = false }: { photos: PhotoImport; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const progress = photos.progress && `Adding ${photos.progress.done} of ${photos.progress.total}`;
  return (
    <>
      <button type="button" className="icon-button is-small nsc-photo-import" aria-label="Add photos" title={progress ?? "Add photos from the computer (or drop them on the studio)"} disabled={disabled || photos.busy} aria-busy={photos.busy} onClick={() => input.current?.click()}><ImagePlus size={20} /></button>
      <input
        ref={input}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        aria-label="Photos to add"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";   // so the same photos can be picked again
          if (files.length > 0) void photos.importFiles(files);
        }}
      />
    </>
  );
}
