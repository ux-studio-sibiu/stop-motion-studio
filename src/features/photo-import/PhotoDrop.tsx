"use client";

import { ImagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import type { PhotoImport } from "./usePhotoImport";
import "./_photo-import.scss";

const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

// Dropping photos anywhere on the studio adds them (step 28): while files are dragged over it, a
// dashed outline says so. Also where the import's note shows, whichever way the photos came.
export function PhotoDrop({ photos, enabled }: { photos: PhotoImport; enabled: boolean }) {
  const [over, setOver] = useState(false);
  const { importFiles } = photos;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // dragover fires every few ms while dragging over the page; when it stops, the drag left.
    const onOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();   // allow the drop (and keep the browser from opening the file)
      event.dataTransfer!.dropEffect = "copy";
      setOver(true);
      clearTimeout(timer);
      timer = setTimeout(() => setOver(false), 200);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      clearTimeout(timer);
      setOver(false);
      void importFiles([...(event.dataTransfer?.files ?? [])]);
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => { clearTimeout(timer); window.removeEventListener("dragover", onOver); window.removeEventListener("drop", onDrop); };
  }, [enabled, importFiles]);

  return (
    <>
      {over && <div className="nsc-photo-drop" aria-hidden="true"><p><ImagePlus size={40} />Drop photos to add them</p></div>}
      {(photos.progress || photos.note) && (
        <p className={`nsc-photo-note${photos.note?.problem ? " is-problem" : ""}`} role="status">
          {photos.progress ? `Adding photos: ${photos.progress.done} of ${photos.progress.total}` : photos.note?.text}
        </p>
      )}
    </>
  );
}
