"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import "./cardboard-letters/cardboard-letters.css";
import { introPlayed, skipIntro } from "./introSeen";

// The home page's intro, a stop-motion film: frame by frame, the title's cards are put down, STOP
// MOTION START in cardboard letters (cardboard-letters.css), one more each frame, each in its own
// fixed pose, a little off its place and a little crooked, as laid by hand: the same every time, so
// the cards can lie close together and are sure not to touch. Other things on the
// page can be frames of it too, `after` the cards (the page shows them: onProgress says how many of
// those are down).
// A click on the title takes everything away at once and plays it again. With reduced motion, or coming back from the studio (introSeen), it's all simply there.
// The cards (TitleCard, each with its place among them) are counted on the page when a run starts,
// so adding or removing one needs nothing else. Once a run has put everything down, all of it
// stays down, frames added later too: `down` is then Infinity.

const FRAME = 100;       // ms a frame: 10 frames a second
const SLOW = 2;          // the frames from `slowAfter` on (the home page's buttons, then its animations' column sliding up) take this many times as long: 200 ms each
// Each card's pose, at most (the gaps in projects.scss are worked out from these).
const REST_PX = 1;       // how far off its place a card lies (px)
const REST_DEG = 1.4;    // how crooked it lies (degrees)

type Pose = { shown: boolean; style: CSSProperties };
const Frame = createContext<(order: number) => Pose>(() => ({ shown: true, style: {} }));

// The same "random" number for the same card: its pose never changes.
function noise(order: number, salt: number): number {
  let h = (order * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967295) * 2 - 1;   // -1 to 1
}

// A run: `down` of its `count` frames down so far (one more each step).
type Film = { down: number; count: number };

// after: how many frames come after the title's cards. onProgress: how many of those are down,
// whenever that changes. slowAfter: the first of them that go slower (SLOW).
export function HomeTitle({ play, label, after = 0, slowAfter = Infinity, onProgress, children }: { play: boolean; label: string; after?: number; slowAfter?: number; onProgress?: (down: number) => void; children: ReactNode }) {
  const [film, setFilm] = useState<Film | null>(null);   // the run playing, and its frame
  const [rest, setRest] = useState(() => (skipIntro() ? Infinity : 0));   // how many frames are down after a run (all of them from the start, back from the studio)
  const started = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const cards = () => button.current?.querySelectorAll("[data-shown]").length ?? 0;   // the TitleCards in it
  const frameCount = () => cards() + after;

  const run = useCallback((count: number) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setFilm(null); setRest(Infinity); return; }
    setFilm({ down: 0, count });
  }, []);

  // The first run, once the page shows; none coming back from the studio.
  useEffect(() => {
    if (!play || started.current) return;
    introPlayed();
    if (rest === Infinity) return;   // skipped: everything's already down
    // Once the page has been drawn. (Started only then: Strict Mode runs this twice, cancelling the first.)
    const frame = requestAnimationFrame(() => { started.current = true; run(frameCount()); });
    return () => cancelAnimationFrame(frame);
  }, [play, run]);   // eslint-disable-line react-hooks/exhaustive-deps -- frameCount() reads the page when it starts

  // A frame at a time (the next one, film.down, slower from slowAfter on); then it stays as it is.
  useEffect(() => {
    if (!film) return;
    const slow = film.down >= cards() + slowAfter;
    const timer = setTimeout(() => {
      if (film.down >= film.count) { setRest(film.down >= frameCount() ? Infinity : film.down); setFilm(null); return; }
      setFilm({ ...film, down: film.down + 1 });
    }, FRAME * (slow ? SLOW : 1));
    return () => clearTimeout(timer);
  }, [film, after, slowAfter]);   // eslint-disable-line react-hooks/exhaustive-deps -- cards() reads the page

  const down = film ? film.down : rest;

  // How many of the frames after the cards are down.
  useEffect(() => {
    onProgress?.(Math.min(Math.max(down - cards(), 0), after));
  }, [down, after, onProgress]);

  // Everything taken away at once, and the intro again (a click while it plays starts it over).
  const replay = () => run(frameCount());

  const pose = (order: number): Pose => {
    const shown = order < down;
    const x = noise(order, 1) * REST_PX, y = noise(order, 2) * REST_PX, turn = noise(order, 3) * REST_DEG;
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
