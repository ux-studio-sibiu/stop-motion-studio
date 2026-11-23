import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOKENS } from "./tokens";

// The one test the token list needs (D2): it matches the stylesheets, both themes, so it can't
// drift. The tokens are in globals.scss (:root), their colours in _colours.scss (light-colours,
// which :root includes, and dark-colours, for the dark theme).

const read = (file: string) => readFileSync(file, "utf8").replace(/\/\/[^\n]*/g, "");
const globals = read("src/styles/globals.scss");
const colours = read("src/styles/_colours.scss");
// The custom properties declared directly in the block that starts at `start` in `scss`.
function declared(scss: string, start: string): Record<string, string> {
  const open = scss.indexOf("{", scss.indexOf(start));
  let depth = 0;
  let end = open;
  for (; end < scss.length; end++) {
    if (scss[end] === "{") depth++;
    if (scss[end] === "}" && --depth === 0) break;
  }
  return Object.fromEntries([...scss.slice(open + 1, end).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

describe("the token list (design system page)", () => {
  it("has every token in globals.scss and _colours.scss, with the same light and dark values", () => {
    const light = { ...declared(globals, ":root {"), ...declared(colours, "@mixin light-colours") };
    const dark = declared(colours, "@mixin dark-colours");
    expect(Object.fromEntries(TOKENS.map((token) => [token.name, token.light]))).toEqual(light);
    expect(Object.fromEntries(TOKENS.filter((token) => token.dark).map((token) => [token.name, token.dark]))).toEqual(dark);
  });
});
