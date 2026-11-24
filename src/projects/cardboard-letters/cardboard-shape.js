// A copy of the cardboard letters font's cardboard-shape.js (casedeschise/fonts/cardboard letters/). Made by
// scripts/sync-cardboard-letters.mjs: change the font's, then run npm run sync:cardboard (don't edit this copy).

// Cardboard pieces of any outline, drawn in SVG: a burst for now. The rectangle pieces (word cards,
// sheets) get their edges from the big piece's photo with border-image, which can only run along
// four straight sides. Here the piece is its outline, filled with the same surface
// (bases/sheet-surface.webp), and each straight side gets a strip of the same photographed edge
// (bases/sheet-strip.webp, tools/make-strip.cjs), turned to lie along it and cut where two sides
// meet, like a picture frame's corners. Seen from a little above and in front: sides facing down
// show their whole cut face, sides facing up hardly any (edgeShowing). A ring of coloured paper can
// be pasted on it.
//
//   import { burstSvg } from "./cardboard-shape.js";
//   element.innerHTML = burstSvg({ width: 700, height: 560, spikes: 11, depth: 0.3, seed: 7 });
//
// Plain JavaScript (an ES module), no dependencies; cardboard-shape.d.ts describes it for TypeScript.

// A pseudo-random number from 0 to 1, the same for the same seed and index (a burst keeps its shape).
function noise(seed, index) {
  let h = (seed * 374761393 + index * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// A burst `width` × `height`: `spikes` points round an oval, each a little different (`seed`,
// `wobble`), its valleys `depth` (0 to 1) of the way in. The points go round clockwise.
export function burstPoints({ width, height, spikes = 12, depth = 0.22, seed = 1, wobble = 0.7 }) {
  const cx = width / 2, cy = height / 2;
  const points = [];
  for (let i = 0; i < spikes * 2; i++) {
    const tip = i % 2 === 0;
    const turn = ((i + (noise(seed, i * 3) - 0.5) * wobble) / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const reach = tip ? 1 - noise(seed, i * 3 + 1) * depth * 0.45 : 1 - depth * (0.85 + noise(seed, i * 3 + 2) * 0.3);
    points.push({ x: cx + Math.cos(turn) * (width / 2) * reach, y: cy + Math.sin(turn) * (height / 2) * reach });
  }
  return points;
}

// The outline moved in by `distance` (each side moved in, the corners where they meet), for an
// outline every side of which faces its centre, as a burst's does. A very sharp tip is cut short.
// `distance` may differ by side: a function of the side's outward direction (a unit vector).
export function inset(points, distance) {
  const howFar = typeof distance === "number" ? () => distance : distance;
  const n = points.length;
  const centre = points.reduce((sum, p) => ({ x: sum.x + p.x / n, y: sum.y + p.y / n }), { x: 0, y: 0 });
  const sides = points.map((a, i) => {
    const b = points[(i + 1) % n];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dir = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    let normal = { x: -dir.y, y: dir.x };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (normal.x * (centre.x - mid.x) + normal.y * (centre.y - mid.y) < 0) normal = { x: -normal.x, y: -normal.y };
    const d = howFar({ x: -normal.x, y: -normal.y });
    return { from: { x: a.x + normal.x * d, y: a.y + normal.y * d }, dir, d };
  });
  return points.map((corner, i) => {
    const s1 = sides[(i - 1 + n) % n], s2 = sides[i];
    const cross = s1.dir.x * s2.dir.y - s1.dir.y * s2.dir.x;
    if (Math.abs(cross) < 1e-6) return s2.from;
    const t = ((s2.from.x - s1.from.x) * s2.dir.y - (s2.from.y - s1.from.y) * s2.dir.x) / cross;
    const met = { x: s1.from.x + s1.dir.x * t, y: s1.from.y + s1.dir.y * t };
    const far = Math.hypot(met.x - corner.x, met.y - corner.y);
    const limit = Math.max(s1.d, s2.d) * 4;   // a very sharp tip: no further in than this
    return far > limit ? { x: corner.x + ((met.x - corner.x) / far) * limit, y: corner.y + ((met.y - corner.y) / far) * limit } : met;
  });
}

// The outline moved `distance` in from each of its sides (a negative distance moves it out), going
// by which way the outline turns rather than by its centre, so it works for any outline that
// doesn't cross itself, a bent one too (a piece of a burst's ring), where inset() can't tell inside
// from out. `distance` may differ by side, as for inset(). Corners are mitred (the moved sides
// meet), a very sharp one cut short.
export function offset(points, distance) {
  const howFar = typeof distance === "number" ? () => distance : distance;
  const n = points.length;
  const turn = signedArea(points) > 0 ? 1 : -1;   // y down: positive is clockwise on screen
  const sides = points.map((a, i) => {
    const b = points[(i + 1) % n];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dir = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const normal = { x: -dir.y * turn, y: dir.x * turn };   // inwards
    const d = howFar({ x: -normal.x, y: -normal.y });
    return { from: { x: a.x + normal.x * d, y: a.y + normal.y * d }, dir, d };
  });
  return points.map((corner, i) => {
    const s1 = sides[(i - 1 + n) % n], s2 = sides[i];
    const cross = s1.dir.x * s2.dir.y - s1.dir.y * s2.dir.x;
    if (Math.abs(cross) < 1e-9) return s2.from;   // a straight run: no corner to meet at
    const t = ((s2.from.x - s1.from.x) * s2.dir.y - (s2.from.y - s1.from.y) * s2.dir.x) / cross;
    const met = { x: s1.from.x + s1.dir.x * t, y: s1.from.y + s1.dir.y * t };
    const far = Math.hypot(met.x - corner.x, met.y - corner.y);
    const limit = Math.max(Math.abs(s1.d), Math.abs(s2.d)) * 4;
    return far > limit ? { x: corner.x + ((met.x - corner.x) / far) * limit, y: corner.y + ((met.y - corner.y) / far) * limit } : met;
  });
}

const signedArea = (points) => points.reduce((sum, a, i) => { const b = points[(i + 1) % points.length]; return sum + a.x * b.y - b.x * a.y; }, 0) / 2;

// How much of the cut edge shows on a side facing `outward`, from `least` to 1 (times the edge's
// width): we look from a little above and in front, so sides facing down (towards us) show the
// whole cut face, sides facing up hardly any; a little more on the right, as in the photos.
export function edgeShowing(outward, least = 0.25) {
  const towardsUs = outward.x * 0.35 + outward.y * 0.94;
  return least + (1 - least) * Math.max(0, (towardsUs + 1) / 2) ** 1.5;
}

export const toPath = (points) => `M${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("L")}Z`;

// A ring (its outside and inside, the same points moved in) cut into `count` pieces, across the ring
// at valleys (odd points), as near even as the points allow. Each piece: along the outside from one
// cut to the next, back along the inside.
function ringPieces(outside, inside, count) {
  const n = outside.length;
  const cuts = Array.from({ length: count }, (_, k) => { const at = Math.round((k * n) / count); return at % 2 === 1 ? at : (at + 1) % n; });
  return cuts.map((from, k) => {
    const to = cuts[(k + 1) % count];
    const steps = ((to - from + n) % n) || n;
    const along = Array.from({ length: steps + 1 }, (_, i) => (from + i) % n);
    return [...along.map((i) => outside[i]), ...along.reverse().map((i) => inside[i])];
  });
}

// A piece moved `distance` out from the centre (cx, cy), along the line to its own middle.
function moveOut(points, cx, cy, distance) {
  if (!distance) return points;
  const mid = points.reduce((sum, p) => ({ x: sum.x + p.x / points.length, y: sum.y + p.y / points.length }), { x: 0, y: 0 });
  const length = Math.hypot(mid.x - cx, mid.y - cy) || 1;
  const dx = ((mid.x - cx) / length) * distance, dy = ((mid.y - cy) / length) * distance;
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

// The edge strip: the big piece's top side between its corners, 465 × 14 px, its cut face along the top.
const STRIP = { width: 465, height: 14 };
let made = 0;

// A piece of cardboard cut to `points`, as SVG: its surface (the pattern `surfaceId`), and along
// each side a strip of the cut edge (sheet-strip.webp), as much of it showing as that side's
// direction lets (edgeShowing): the sides facing down show the whole cut face, those facing up a
// sliver. Each strip runs from its side's two corners in to the rim's, so where two sides meet their
// strips meet on the corner's mitre, thick and thin alike, with no gap or overlap.
export function cardboardPiece(points, { edge, surfaceId, id, bases }) {
  const outline = signedArea(points) > 0 ? points : [...points].reverse();   // clockwise, so a side's outward normal is its direction turned left
  const rim = offset(outline, (outward) => edge * edgeShowing(outward));
  const length = (STRIP.width * (edge / STRIP.height)).toFixed(2);   // the strip keeps its length on every side, so its flutes stay as far apart
  const sides = outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const showing = (edge * edgeShowing({ x: (b.y - a.y) / len, y: -(b.x - a.x) / len })).toFixed(2);
    const angle = ((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI).toFixed(3);
    // Laid along the side: its x from a to b, its y inwards, squashed to what shows of the cut face.
    return `<pattern id="${id}-side-${i}" patternUnits="userSpaceOnUse" width="${length}" height="${showing}" patternTransform="translate(${a.x.toFixed(2)} ${a.y.toFixed(2)}) rotate(${angle})"><image href="${bases}sheet-strip.webp" width="${length}" height="${showing}" preserveAspectRatio="none"/></pattern>`
      + `<path d="${toPath([a, b, rim[(i + 1) % rim.length], rim[i]])}" fill="url(#${id}-side-${i})"/>`;
  }).join("");
  return `<path d="${toPath(outline)}" fill="url(#${surfaceId})"/>${sides}`;
}

// The burst as SVG markup, `width` × `height` (its viewBox; it scales with its box). `edge`: how wide
// the cut edge is drawn. `paint`: the paper ring's colour (none without it), from `paintInset` in
// from the outside to `paintWidth` further in. `bases`: where the pictures are (the bases folder,
// ending in /). `id`: a prefix for the SVG's own ids, different for each burst on a page (one is
// made up when it's left out; give one when the markup must come out the same twice, as when a
// server draws it first). `cardboard: false`: the paper ring alone, without the cardboard under it.
// `pieces`: the ring cut into that many pieces (across it, at valleys between the points), each its
// own path with the classes burst-piece and burst-piece-1, -2.... `shownPieces`: only the first that
// many drawn (to put them down one at a time).
// `paint` can be a list of colours: one a piece, in turn (round the ring from the top, clockwise).
// `spread`: how far each piece is moved out from the centre (along the line to its own middle), so
// the pieces lie apart with gaps between them (about 1.2 × spread with 5 pieces).
// With pieces and cardboard, each piece is its own piece of cardboard under its paper
// (cardboardPiece), reaching past the paper by the cut edge that shows on that side and `margin`
// more; the gaps between pieces are that much narrower. `paperReach`: how much of each side's cut
// edge the paper lies over (0 to 1), as on the rectangle pieces (0.4 there: up to the corrugated
// rim), so the trim looks the same on every side however much of the edge shows.
export function burstSvg({ width, height, spikes = 12, depth = 0.22, seed = 1, wobble = 0.7, edge = 9, paint = null, paintInset = 8, paintWidth = 12, bases = "bases/", id = `burst${++made}`, cardboard = true, pieces = 1, spread = 0, shownPieces = pieces, margin = edge * 0.5, paperReach = 0 }) {
  const outer = burstPoints({ width, height, spikes, depth, seed, wobble });
  const rim = inset(outer, (outward) => edge * edgeShowing(outward));
  const tile = (edge * (400 / 14)).toFixed(2);   // the surface's 400 px tile, at the edge's scale (as on the rectangle pieces)
  const length = (STRIP.width * (edge / STRIP.height)).toFixed(2);   // the strip keeps its length on every side, so its flutes stay as far apart

  const sides = outer.map((a, i) => {
    const b = outer[(i + 1) % outer.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const showing = (edge * edgeShowing({ x: (b.y - a.y) / len, y: -(b.x - a.x) / len })).toFixed(2);
    const angle = ((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI).toFixed(3);
    // Laid along the side: its x from a to b, its y inwards, squashed to what shows of the cut face.
    return `<pattern id="${id}-side-${i}" patternUnits="userSpaceOnUse" width="${length}" height="${showing}" patternTransform="translate(${a.x.toFixed(2)} ${a.y.toFixed(2)}) rotate(${angle})"><image href="${bases}sheet-strip.webp" width="${length}" height="${showing}" preserveAspectRatio="none"/></pattern>`
      + `<path d="${toPath([a, b, rim[(i + 1) % rim.length], rim[i]])}" fill="url(#${id}-side-${i})"/>`;
  }).join("");
  const colours = [paint].flat();
  const paper = !colours[0] ? "" : pieces > 1 ? ringPieces(inset(outer, paintInset), inset(outer, paintInset + paintWidth), pieces).slice(0, shownPieces).map((piece, k) => `<path class="burst-piece burst-piece-${k + 1}" d="${toPath(moveOut(piece, width / 2, height / 2, spread))}" fill="${colours[k % colours.length]}"/>`).join("")
    : `<path d="${toPath(inset(outer, paintInset))}${toPath(inset(outer, paintInset + paintWidth))}" fill="${colours[0]}" fill-rule="evenodd"/>`;

  if (!cardboard) return `<svg class="burst-art" viewBox="0 0 ${width} ${height}" aria-hidden="true">${paper}</svg>`;
  if (pieces > 1 && colours[0]) {
    // A piece of cardboard each, under its own paper, put down with it.
    const surface = `<defs><pattern id="${id}-surface" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"><image href="${bases}sheet-surface.webp" width="${tile}" height="${tile}" preserveAspectRatio="none"/></pattern></defs>`;
    const cut = ringPieces(inset(outer, paintInset), inset(outer, paintInset + paintWidth), pieces).slice(0, shownPieces);
    const drawn = cut.map((piece, k) => {
      const paperAt = moveOut(piece, width / 2, height / 2, spread);
      const board = offset(paperAt, (outward) => -(edge * edgeShowing(outward) * (1 - paperReach) + margin));
      return `<g class="burst-piece burst-piece-${k + 1}">${cardboardPiece(board, { edge, surfaceId: `${id}-surface`, id: `${id}-piece-${k}`, bases })}<path d="${toPath(paperAt)}" fill="${colours[k % colours.length]}"/></g>`;
    }).join("");
    return `<svg class="burst-art" viewBox="0 0 ${width} ${height}" aria-hidden="true">${surface}${drawn}</svg>`;
  }
  return `<svg class="burst-art" viewBox="0 0 ${width} ${height}" aria-hidden="true"><defs><pattern id="${id}-surface" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"><image href="${bases}sheet-surface.webp" width="${tile}" height="${tile}" preserveAspectRatio="none"/></pattern></defs>`
    + `<path d="${toPath(outer)}" fill="url(#${id}-surface)"/>${sides}${paper}</svg>`;
}
