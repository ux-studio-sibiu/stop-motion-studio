"use client";

import { useEffect, useState } from "react";

// Copying a colour from one token to another on the design page, as on the cardboard letters page:
// Alt+click a colour token copies its value, Ctrl+Alt+click (Cmd+Alt on a Mac) another pastes it
// there, as a tweak. Works on the token board and in the tokens panel. While the keys are held, the
// cursor over colour tokens says what a click will do.

export type CopyKeys = "copy" | "paste" | null;
type Click = { altKey: boolean; ctrlKey: boolean; metaKey: boolean };

// What a click on a colour token does: nothing special (no Alt), copy its value, paste the copied
// one (or say there's nothing to paste yet). The caller does it, and shows the message.
export type ColourAction = { kind: "none" } | { kind: "copy"; value: string; message: string } | { kind: "paste"; value: string; message: string } | { kind: "nothing-copied"; message: string };

export function colourAction(click: Click, name: string, value: string, copied: string | null): ColourAction {
  if (!click.altKey) return { kind: "none" };
  if (click.ctrlKey || click.metaKey) {
    if (copied === null) return { kind: "nothing-copied", message: "Nothing copied yet: Alt+click a colour first" };
    return { kind: "paste", value: copied, message: `Pasted ${copied} on ${name}` };
  }
  return { kind: "copy", value, message: `Copied ${name}: ${value} (Ctrl+Alt+click a colour to paste it)` };
}

// Which keys are held now: Alt (copy), Ctrl+Alt (paste), or neither; kept in step by the keys,
// pointer moves (a key pressed while the window wasn't looking) and leaving the window.
export function useCopyKeys(): CopyKeys {
  const [keys, setKeys] = useState<CopyKeys>(null);
  useEffect(() => {
    const show = (event: KeyboardEvent | PointerEvent) => setKeys(event.altKey ? (event.ctrlKey || event.metaKey ? "paste" : "copy") : null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Alt") event.preventDefault();   // Alt alone would put the focus on the browser's menu
      show(event);
    };
    const clear = () => setKeys(null);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", show);
    window.addEventListener("pointermove", show, { passive: true });
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", show);
      window.removeEventListener("pointermove", show);
      window.removeEventListener("blur", clear);
    };
  }, []);
  return keys;
}

// The cursors, drawn dark on a white outline so they show on any colour: an eyedropper (copy; the
// tip is the hot spot) and a syringe filled black (paste; the needle's tip), the system's copy
// cursor and crosshair if a drawn one can't be used. "blocked": pasting with nothing copied.
const svg = (body: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'>${body}</svg>`)}")`;
const DROPPER = "m2 22 1-1h3l9-9M3 21v-3l9-9";
const BULB = "m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z";
const SYRINGE = "M18 2l4 4M17 7l3-3M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5M9 11l4 4M5 19l-3 3M14 4l6 6";
const LIQUID = "M9 11 4.7 15.3c-1 1-1 2.4 0 3.4l.6.6c1 1 2.4 1 3.4 0L13 15Z";
export const CURSORS = {
  copy: `${svg(`<g stroke='white' stroke-width='4.5'><path d='${DROPPER}'/><path d='${BULB}'/></g><g stroke='#1f1c19' stroke-width='2'><path d='${DROPPER}'/><path fill='#1f1c19' d='${BULB}'/></g>`)} 2 22, copy`,
  paste: `${svg(`<path stroke='white' stroke-width='4.5' d='${SYRINGE}'/><path fill='#1f1c19' d='${LIQUID}'/><path stroke='#1f1c19' stroke-width='2' d='${SYRINGE}'/>`)} 2 22, crosshair`,
  blocked: "not-allowed",
} as const;

// The cursor for the keys held, or none (pasting with nothing copied: not allowed).
export const cursorFor = (keys: CopyKeys, copied: string | null): string | undefined => (keys === "copy" ? CURSORS.copy : keys === "paste" ? (copied === null ? CURSORS.blocked : CURSORS.paste) : undefined);
