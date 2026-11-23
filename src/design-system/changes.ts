import { TOKENS } from "./tokens";

// What Copy changes puts on the clipboard (D4): the tweaks as a message to paste into the chat with
// Claude, which makes them permanent in the code. Each line names the token, which theme, the value
// it had and the new one, and what the token is for, so the change can be made, and checked, from
// the message alone. Only real changes: a tweak back at the token's value isn't one.
//
// Which theme a line is for follows how the tokens work (globals.scss, colours in _colours.scss): a token the dark theme doesn't
// override has one value for both, so a light tweak of it changes both themes; a dark tweak of it
// adds a dark override.

export type Tweaks = { light: Record<string, string>; dark: Record<string, string> };

export function changeLines(tweaks: Tweaks): string[] {
  const lines: string[] = [];
  for (const token of TOKENS) {
    const light = tweaks.light[token.name];
    const dark = tweaks.dark[token.name];
    if (light !== undefined && light !== token.light) lines.push(`- ${token.name} (${token.dark ? "light" : "light and dark"}): ${token.light} -> ${light}   (${token.note})`);
    const darkBase = token.dark ?? token.light;
    if (dark !== undefined && dark !== darkBase) lines.push(`- ${token.name} (dark${token.dark ? "" : ", a new dark override"}): ${darkBase} -> ${dark}   (${token.note})`);
  }
  return lines;
}

export function changesMessage(tweaks: Tweaks): string {
  const lines = changeLines(tweaks);
  if (lines.length === 0) return "";
  return [
    "Design-system tweaks for stop-motion-studio: please make these permanent in",
    "src/styles/globals.scss and src/styles/_colours.scss (colours: light-colours, and dark-colours for the dark theme),",
    "and in src/design-system/tokens.ts, so the token test keeps passing:",
    ...lines,
  ].join("\n");
}
