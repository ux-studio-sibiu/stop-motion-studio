// Copies the cardboard letters font into the studio: its CSS (casedeschise/fonts/cardboard letters/
// cardboard-letters.css) to src/projects/cardboard-letters/, its pictures to public/cardboard-letters/
// bases/, with the CSS's picture paths pointed there; cardboard of any outline (cardboard-shape.js
// and its types) to src/projects/cardboard-letters/. (The font's cut-outs, cutouts/, aren't used
// here, so they aren't copied.) A copy, not a link (the workspace rule: shared
// tools are copied in); this keeps the copy the same as the font. Run after changing the font:
//   npm run sync:cardboard
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const studio = join(dirname(fileURLToPath(import.meta.url)), "..");
const font = join(studio, "..", "fonts", "cardboard letters");
const HEADER = `/* A copy of the cardboard letters font (casedeschise/fonts/cardboard letters/cardboard-letters.css),
   for the home page's title and cards; its pictures are in public/cardboard-letters/bases/ (the paths
   below point there). Made by scripts/sync-cardboard-letters.mjs: change the font, then run
   npm run sync:cardboard (don't edit this copy). */\n\n`;

const css = readFileSync(join(font, "cardboard-letters.css"), "utf8").replace(/url\("bases\//g, 'url("/cardboard-letters/bases/');
const cssOut = join(studio, "src", "projects", "cardboard-letters", "cardboard-letters.css");
mkdirSync(dirname(cssOut), { recursive: true });
writeFileSync(cssOut, HEADER + css);

const picturesOut = join(studio, "public", "cardboard-letters", "bases");
mkdirSync(picturesOut, { recursive: true });
// Only the pictures the studio uses: the big piece's edges and surface (the home page's cards and
// title letters, the studio's pieces) and the edge strip the burst's pieces are edged with. The
// letter tiles' own pictures (base-N.png, grain-N.png) and the word cards' grain (sheet-grain.webp)
// aren't copied: the title's letters are cut from the big piece like the studio's. To use them,
// add them to PICTURES (or copy every file in the font's bases/) and run npm run sync:cardboard: the
// CSS already points at them.
const PICTURES = ["sheet-edges.webp", "sheet-surface.webp", "sheet-strip.webp"];
const pictures = readdirSync(join(font, "bases")).filter((name) => PICTURES.includes(name));
for (const name of pictures) copyFileSync(join(font, "bases", name), join(picturesOut, name));

// Cardboard of any outline: the module and its types, with a note on top.
for (const name of ["cardboard-shape.js", "cardboard-shape.d.ts"]) {
  const note = `// A copy of the cardboard letters font's ${name} (casedeschise/fonts/cardboard letters/). Made by\n// scripts/sync-cardboard-letters.mjs: change the font's, then run npm run sync:cardboard (don't edit this copy).\n\n`;
  writeFileSync(join(dirname(cssOut), name), note + readFileSync(join(font, name), "utf8"));
}

console.log(`Synced the cardboard letters: the CSS, ${pictures.length} pictures, and the shape module.`);
