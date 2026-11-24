"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const GAP = 8;   // px between the button row and a list fixed to the window

// A dropdown's open state, shared by the playback and see-through options, the camera list and the
// timeline's layers: the arrow button opens and closes it; Escape or a click outside closes it.
// Put `ref` on the element holding both the button and the panel.
//
// `fixed`: the panel is fixed to the window (it needs `position: fixed` in its styles) instead of
// placed inside its parent, so a scrolling or clipping container (the side panel) can't cut it
// off. `style` then places it just above the `ref` element, right edges lined up, and follows it
// when the window is resized or anything scrolls.
//
// A list that opens below its button (.opens-below) opens above it instead when the window has no
// room for it underneath and more above (data-flip="up" on the `ref` element).
export function useDropdown<T extends HTMLElement = HTMLDivElement>({ fixed = false }: { fixed?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<CSSProperties>();
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

  useLayoutEffect(() => {
    const holder = ref.current;
    if (!open || fixed || !holder?.classList.contains("opens-below")) return;
    const fit = () => {
      delete holder.dataset.flip;   // measured where it opens first: below
      const list = holder.querySelector<HTMLElement>(":scope > .options");
      if (!list) return;
      const box = list.getBoundingClientRect();
      const above = holder.getBoundingClientRect().top - GAP;
      if (box.bottom > innerHeight - GAP && above > innerHeight - box.top) holder.dataset.flip = "up";
    };
    fit();
    addEventListener("resize", fit);
    return () => { removeEventListener("resize", fit); delete holder.dataset.flip; };
  }, [open, fixed]);

  useLayoutEffect(() => {
    if (!open || !fixed) return;
    const place = () => {
      const box = ref.current?.getBoundingClientRect();
      if (box) setAt({ right: innerWidth - box.right, bottom: innerHeight - box.top + GAP });
    };
    place();
    addEventListener("resize", place);
    addEventListener("scroll", place, true);   // true: a scroll inside any container, not only the page
    return () => {
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
    };
  }, [open, fixed]);

  return { open, toggle: () => setOpen((value) => !value), ref, style: open && fixed ? at : undefined };
}
