"use client";

import { useEffect, useRef, useState } from "react";

// A dropdown's open state, shared by the playback and see-through options: the arrow button
// opens and closes it; Escape or a click outside closes it. Put `ref` on the element holding
// both the button and the panel.
export function useDropdown<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, toggle: () => setOpen((value) => !value), ref };
}
