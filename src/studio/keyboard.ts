// When a key press belongs to whatever has the keyboard, not to a studio shortcut. One place, so
// the shortcuts can't drift apart (they did once: Ctrl+Z ignored the speed slider, step 16).

const NOT_TEXT = ["range", "checkbox", "radio", "button", "submit", "reset", "color", "file", "image"];

// A field you type in. It has its own editing keys and its own undo, so Ctrl+Z is left to it.
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NOT_TEXT.includes(target.type);
  return target.isContentEditable || target instanceof HTMLTextAreaElement;
}

// Anything that already does something with Space or Enter: a text field, or a button, link,
// menu or other input (Space presses a button, Enter follows a link), or a widget that handles its
// own keys (role="application": the stage's editing layers, where Enter starts typing in a
// bubble, step 23). Capture (Space) and play (Enter) leave those keys to it.
export function ownsKey(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return isTextEntry(target) || ["INPUT", "SELECT", "BUTTON", "A", "SUMMARY"].includes(target.tagName) || target.getAttribute("role") === "application";
}
