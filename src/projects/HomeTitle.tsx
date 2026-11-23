"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import "./cardboard-letters/cardboard-letters.css";
import { introPlayed, skipIntro } from "./introSeen";

// The home page's intro, a stop-motion film: frame by frame, the title's cards are put down, STOP
// MOTION START in cardboard letters (cardboard-letters.css), one more each frame, each landing a
// little off its place and a little crooked, as laid by hand, and staying there. Other things on the
// page can be frames of it too, `after` the cards (the page shows them: onProgress says how many of
// those are down).
// A click on the title takes everything away at once and plays it again. With reduced motion, or coming back from the studio (introSeen), it's all simply there.
// The cards (TitleCard, each with its place among them) are counted on the page when a run starts,
// so adding or removing one needs nothing else. Once a run has put everything down, all of it
// stays down, frames added later too: `down` is then Infinity.

const FRAME = 100;       // ms a frame: 10 frames a second
const SLOW = 1.5;        // the frames from `slowAfter` on take this many times as long
const PLACE_PX = 2;      // how far off its place a card lands, at most (px)
const PLACE_DEG = 1.5;   // how crooked it lands, at most (degrees)
const REST_PX = 1.5;     // how far off its place each card rests anyway, its own way (px)
const REST_DEG = 2;      // how crooked each card rests anyway (degrees)

type Offset = { x: number; y: number; turn: number };
type Pose = { shown: boolean; style: CSSProperties };
const Frame = createContext<(order: number) => Pose>(() => ({ shown: true, style: {} }));
const ZERO: Offset = { x: 0, y: 0, turn: 0 };

// The same "random" number for the same card (its resting pose doesn't change between renders).
function noise(order: number, salt: number): number {
  let h = (order * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967295) * 2 - 1;   // -1 to 1
}
const spread = () => Math.random() * 2 - 1;   // -1 to 1, fresh each time

// Where a card just put down lands: a little off its place and crooked.
const landing = (): Offset => ({ x: spread() * PLACE_PX, y: spread() * PLACE_PX, turn: spread() * PLACE_DEG });

// A run: `down` of its `count` frames down so far (one more each step), and where each landed.
type Film = { down: number; count: number; offsets: Offset[] };

// after: how many frames come after the title's cards. onProgress: how many of those are down,
// whenever that changes. slowAfter: the first of them that go slower (SLOW).
export function HomeTitle({ play, label, after = 0, slowAfter = Infinity, onProgress, children }: { play: boolean; label: string; after?: number; slowAfter?: number; onProgress?: (down: number) => void; children: ReactNode }) {
  const [film, setFilm] = useState<Film | null>(null);   // the run playing, its frame, the offsets
  const [rest, setRest] = useState<{ down: number; offsets: Offset[] }>(() => ({ down: skipIntro() ? Infinity : 0, offsets: [] }));   // after a run (all down from the start, back from the studio)
  const started = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const cards = () => button.current?.querySelectorAll("[data-shown]").length ?? 0;   // the TitleCards in it
  const frameCount = () => cards() + after;

  const run = useCallback((count: number) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setFilm(null); setRest({ down: Infinity, offsets: [] }); return; }
    setFilm({ down: 0, count, offsets: [] });
  }, []);

  // The first run, once the page shows; none coming back from the studio.
  useEffect(() => {
    if (!play || started.current) return;
    introPlayed();
    if (rest.down === Infinity) return;   // skipped: everything's already down
    // Once the page has been drawn. (Started only then: Strict Mode runs this twice, cancelling the first.)
    const frame = requestAnimationFrame(() => { started.current = true; run(frameCount()); });
    return () => cancelAnimationFrame(frame);
  }, [play, run]);   // eslint-disable-line react-hooks/exhaustive-deps -- frameCount() reads the page when it starts

  // A frame at a time (the next one, film.down, slower from slowAfter on); then it stays as it is.
  useEffect(() => {
    if (!film) return;
    const slow = film.down >= cards() + slowAfter;
    const timer = setTimeout(() => {
      if (film.down >= film.count) { setRest({ down: film.down >= frameCount() ? Infinity : film.down, offsets: film.offsets }); setFilm(null); return; }
      setFilm({ ...film, down: film.down + 1, offsets: [...film.offsets, landing()] });
    }, FRAME * (slow ? SLOW : 1));
    return () => clearTimeout(timer);
  }, [film, after, slowAfter]);   // eslint-disable-line react-hooks/exhaustive-deps -- cards() reads the page

  const down = film ? film.down : rest.down;
  const offsets = film ? film.offsets : rest.offsets;

  // How many of the frames after the cards are down.
  useEffect(() => {
    onProgress?.(Math.min(Math.max(down - cards(), 0), after));
  }, [down, after, onProgress]);

  // Everything taken away at once, and the intro again (a click while it plays starts it over).
  const replay = () => run(frameCount());

  const pose = (order: number): Pose => {
    const shown = order < down;
    const offset = offsets[order] ?? ZERO;
    const x = noise(order, 1) * REST_PX + offset.x, y = noise(order, 2) * REST_PX + offset.y, turn = noise(order, 3) * REST_DEG + offset.turn;
    return { shown, style: { visibility: shown ? undefined : "hidden", translate: `${x.toFixed(1)}px ${y.toFixed(1)}px`, rotate: `${turn.toFixed(2)}deg` } };
  };

  return (
    <h1 className="title">
      <span className="visually-hidden">{label}</span>
      <button ref={button} type="button" className="title-replay" aria-label="Play the title again" onClick={replay}>
        <Frame.Provider value={pose}>{children}</Frame.Provider>
      </button>
    </h1>
  );
}

// One card of the title, a letter tile, in its place among the title's cards (0 first).
export function TitleCard({ order, className = "", style, children }: { order: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  const pose = useContext(Frame)(order);
  return <span className={`nsc-cardboard-letter ${className}`} data-shown={pose.shown} style={{ ...style, ...pose.style }} aria-hidden="true">{children}</span>;
}
