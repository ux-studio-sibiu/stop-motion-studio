import { describe, expect, it } from "vitest";
import { colourAction, CURSORS, cursorFor } from "./colourCopy";

const click = (keys: { alt?: boolean; ctrl?: boolean; meta?: boolean } = {}) => ({ altKey: Boolean(keys.alt), ctrlKey: Boolean(keys.ctrl), metaKey: Boolean(keys.meta) });

describe("copying a colour from one token to another", () => {
  it("does nothing special without Alt", () => {
    expect(colourAction(click(), "--color-ink", "#1f2433", null)).toEqual({ kind: "none" });
    expect(colourAction(click({ ctrl: true }), "--color-ink", "#1f2433", "#ff0000")).toEqual({ kind: "none" });
  });

  it("Alt+click copies the token's value", () => {
    expect(colourAction(click({ alt: true }), "--color-ink", "#1f2433", null)).toMatchObject({ kind: "copy", value: "#1f2433" });
  });

  it("Ctrl+Alt+click (or Cmd+Alt) pastes the copied value", () => {
    expect(colourAction(click({ alt: true, ctrl: true }), "--color-border", "#333333", "#1f2433")).toMatchObject({ kind: "paste", value: "#1f2433" });
    expect(colourAction(click({ alt: true, meta: true }), "--color-border", "#333333", "#1f2433")).toMatchObject({ kind: "paste", value: "#1f2433" });
  });

  it("says so when pasting with nothing copied", () => {
    expect(colourAction(click({ alt: true, ctrl: true }), "--color-border", "#333333", null)).toMatchObject({ kind: "nothing-copied" });
  });

  it("shows the eyedropper, the syringe, or not-allowed for the keys held", () => {
    expect(cursorFor(null, "#000000")).toBeUndefined();
    expect(cursorFor("copy", null)).toBe(CURSORS.copy);
    expect(cursorFor("paste", "#000000")).toBe(CURSORS.paste);
    expect(cursorFor("paste", null)).toBe("not-allowed");
  });
});
