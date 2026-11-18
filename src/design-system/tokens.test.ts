import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOKENS } from "./tokens";

// The one test the token list needs (D2): it matches globals.scss, both themes, so it can't drift.

const scss = readFileSync("src/styles/globals.scss", "utf8").replace(/\/\/[^\n]*/g, "");
// The custom properties declared directly in the block that starts at `start`.
function declared(start: string): Record<string, string> {
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
  it("has every token in globals.scss, with the same light and dark values", () => {
    const light = declared(":root {");
    const dark = declared("@media (prefers-color-scheme: dark)");
    expect(Object.fromEntries(TOKENS.map((token) => [token.name, token.light]))).toEqual(light);
    expect(Object.fromEntries(TOKENS.filter((token) => token.dark).map((token) => [token.name, token.dark]))).toEqual(dark);
  });
});
