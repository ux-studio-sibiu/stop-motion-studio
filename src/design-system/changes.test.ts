import { describe, expect, it } from "vitest";
import { changesMessage } from "./changes";

// The one test Copy changes needs (D4): the message says exactly what changed, in which theme.

describe("Copy changes", () => {
  it("lists each real change with its theme, old and new value, and what the token is for", () => {
    const message = changesMessage({
      light: { "--color-border": "#9d927f", "--radius-small": "0.5rem", "--color-ink": "#1f2433" },   // the last is its own value: no change
      dark: { "--color-focus": "#8fa8ff", "--radius": "1.25rem" },
    });
    expect(message.split("\n")).toEqual([
      "Design-system tweaks for stop-motion-studio: please make these permanent in",
      "src/styles/globals.scss and src/styles/_colours.scss (colours: light-colours, and dark-colours for the dark theme),",
      "and in src/design-system/tokens.ts, so the token test keeps passing:",
      "- --color-border (light): #333333 -> #9d927f   (outlines of panels, controls and cards)",
      "- --color-focus (dark): #7d9bff -> #8fa8ff   (keyboard focus rings, and where a drag will land)",
      "- --radius (dark, a new dark override): 1rem -> 1.25rem   (panels, the stage, cards)",
      "- --radius-small (light and dark): 0.625rem -> 0.5rem   (buttons, fields, tabs)",
    ]);
  });

  it("is empty when nothing changed", () => {
    expect(changesMessage({ light: {}, dark: {} })).toBe("");
    expect(changesMessage({ light: { "--color-ink": "#1f2433" }, dark: {} })).toBe("");
  });
});
