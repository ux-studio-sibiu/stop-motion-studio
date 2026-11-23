"use client";

import { useEffect, useRef } from "react";

// A <dialog> shown as a modal while `open` (focus kept inside, the page behind it inert, Escape
// fires its cancel event), closed otherwise. Put the returned ref on the <dialog>.
export function useModalDialog(open: boolean) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  return dialog;
}
