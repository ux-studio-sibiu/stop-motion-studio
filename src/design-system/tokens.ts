// Every design token in src/styles/globals.scss, with what the design system page needs to show and
// tune it (D2): its group, what kind of value it is, its light and dark values, and what it's for.
// Written by hand, held to globals.scss by tokens.test.ts: a token added, removed or changed there
// and not here fails the test.
//
// `dark` only where the dark theme changes it; otherwise it's the same in both.

// Colours come in four families: what things sit on, what's written, what's done, and the stage.
export type TokenGroup = "Surfaces" | "Text and icons" | "Actions" | "Stage" | "Text size" | "Space" | "Corner" | "Line" | "Size" | "Shadow" | "Font";
// colour: a colour (#hex, or rgb() with alpha); length: a CSS length (rem, px); text: anything else
export type TokenKind = "colour" | "length" | "text";
export type Token = { name: string; group: TokenGroup; kind: TokenKind; light: string; dark?: string; note: string };

export const TOKENS: readonly Token[] = [
  { name: "--color-bg", group: "Surfaces", kind: "colour", light: "#fbf7f0", dark: "#14161c", note: "the page behind everything" },
  { name: "--color-studio", group: "Surfaces", kind: "colour", light: "#eeeeee", dark: "#101217", note: "the studio's background, under the graph paper" },
  { name: "--color-surface", group: "Surfaces", kind: "colour", light: "#ffffff", dark: "#1d2029", note: "panels, buttons, cards" },
  { name: "--color-faint", group: "Surfaces", kind: "colour", light: "#f3ede3", dark: "#232733", note: "quiet backgrounds: settings cards, the overlay track" },
  { name: "--color-line", group: "Surfaces", kind: "colour", light: "#e6e0d5", dark: "#2c303b", note: "light rules and fills: dividers, the ruler, pushed-back tabs" },
  { name: "--color-ruler", group: "Surfaces", kind: "colour", light: "#999999", dark: "#5b6172", note: "the timeline ruler's second marks" },
  { name: "--color-border", group: "Surfaces", kind: "colour", light: "#333333", dark: "#4a5162", note: "outlines of panels, controls and cards" },
  { name: "--color-ink", group: "Text and icons", kind: "colour", light: "#1f2433", dark: "#eef0f5", note: "text and icons" },
  { name: "--color-muted", group: "Text and icons", kind: "colour", light: "#6a7184", dark: "#9aa1b2", note: "hints, secondary text" },
  { name: "--color-on-strong", group: "Text and icons", kind: "colour", light: "#ffffff", note: "text and icons on the strong colours: accent, go, danger, and the scrim on photos" },
  { name: "--color-accent", group: "Actions", kind: "colour", light: "#f2544a", dark: "#ff6559", note: "capture: the one loud colour" },
  { name: "--color-go", group: "Actions", kind: "colour", light: "#24a06b", dark: "#33b97f", note: "play, and what's on, chosen or selected: on-buttons, sliders, checkboxes, selected pictures and objects (their tint is a mix of it)" },
  { name: "--color-danger", group: "Actions", kind: "colour", light: "#b3261e", dark: "#e2584f", note: "deleting" },
  { name: "--color-focus", group: "Actions", kind: "colour", light: "#3b6cf6", dark: "#7d9bff", note: "keyboard focus rings, and where a drag will land" },
  { name: "--color-stage", group: "Stage", kind: "colour", light: "#15171c", dark: "#0a0b0e", note: "behind photos, dark in both themes" },
  { name: "--color-stage-ink", group: "Stage", kind: "colour", light: "#b9bfcc", note: "text on the stage" },
  { name: "--color-scrim", group: "Stage", kind: "colour", light: "rgb(0 0 0 / 0.55)", note: "behind labels on photos: the stage note, picture numbers" },

  { name: "--text-tiny", group: "Text size", kind: "length", light: "0.6875rem", note: "ruler marks, picture numbers" },
  { name: "--text-caption", group: "Text size", kind: "length", light: "0.75rem", note: "small notes, overlay bars" },
  { name: "--text-label", group: "Text size", kind: "length", light: "0.8125rem", note: "field labels" },
  { name: "--text-hint", group: "Text size", kind: "length", light: "0.875rem", note: "hints, muted help" },
  { name: "--text-small", group: "Text size", kind: "length", light: "0.9375rem", note: "notices, secondary text" },
  { name: "--text-body", group: "Text size", kind: "length", light: "1rem", note: "body text" },
  { name: "--text-title", group: "Text size", kind: "length", light: "1.125rem", note: "panel titles" },
  { name: "--text-heading", group: "Text size", kind: "length", light: "1.5rem", note: "page headings" },

  { name: "--space-1", group: "Space", kind: "length", light: "0.25rem", note: "the smallest gap" },
  { name: "--space-2", group: "Space", kind: "length", light: "0.5rem", note: "between controls" },
  { name: "--space-3", group: "Space", kind: "length", light: "1rem", note: "panel padding, between groups" },
  { name: "--space-4", group: "Space", kind: "length", light: "1.5rem", note: "between sections" },

  { name: "--radius", group: "Corner", kind: "length", light: "1rem", note: "panels, the stage, cards" },
  { name: "--radius-small", group: "Corner", kind: "length", light: "0.625rem", note: "buttons, fields, tabs" },

  { name: "--line-width", group: "Line", kind: "length", light: "2px", note: "every outline (hairlines stay 1px)" },

  { name: "--hit", group: "Size", kind: "length", light: "3.5rem", note: "the smallest touch target" },
  { name: "--hit-big", group: "Size", kind: "length", light: "5.5rem", note: "capture and play" },
  { name: "--timeline-height", group: "Size", kind: "length", light: "12.25rem", note: "the timeline (less on wider screens, where its tools are a tab)" },

  { name: "--shadow-floating", group: "Shadow", kind: "text", light: "0 8px 24px rgb(0 0 0 / 0.15)", note: "menus, notices" },
  { name: "--shadow-dragged", group: "Shadow", kind: "text", light: "0 6px 18px rgb(0 0 0 / 0.28)", note: "things being dragged" },
  { name: "--shadow-press", group: "Shadow", kind: "text", light: "0 0.375rem 0 rgb(0 0 0 / 0.18)", note: "a big button's depth" },
  { name: "--shadow-pressed", group: "Shadow", kind: "text", light: "0 0.125rem 0 rgb(0 0 0 / 0.18)", note: "pressed in" },

  { name: "--font-ui", group: "Font", kind: "text", light: "\"Nunito\", \"Nunito Fallback\"", note: "the app's font, self-hosted" },
];

export const TOKEN_GROUPS: readonly TokenGroup[] = ["Surfaces", "Text and icons", "Actions", "Stage", "Text size", "Space", "Corner", "Line", "Size", "Shadow", "Font"];

export function tokensIn(group: TokenGroup): readonly Token[] {
  return TOKENS.filter((token) => token.group === group);
}
