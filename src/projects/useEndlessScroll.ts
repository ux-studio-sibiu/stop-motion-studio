"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

// The home page's column of animations, scrolled by the wheel anywhere on the page and by a finger
// on it, round and round: past the last animation come the first ones again, with no end and no
// jump to see. Only from tablet width on, where the column scrolls on its own (on a phone the page
// scrolls as usual), and only when the animations are more than the column shows.
//
// How: the list is drawn three times, a copy before and after the real one (ProjectsPage renders
// the copies while `looping`). The column starts on the real list; whenever the middle of the view
// passes the real list's top or bottom, it's put back one list's height (`period`) the other way,
// in the same frame, onto the same cards in the next copy. Nothing on screen moves. Measured by
// the middle of the view, so a card the keyboard brings into view (the real one) is never wrapped
// away.
//
// All scrolling jumps, never glides (stop motion): the wheel moves it at once, a finger drags it
// along, and a flick carries on in a few jumps a frame apart (FLING), each shorter than the last.
// The finger is followed by the page itself, not the browser (touch-action: none on the column,
// projects.scss), so nothing the browser does (Safari's momentum) can fight the wrap. A press that
// barely moves is a tap: the card under it gets its click as usual.

const TAP = 8;   // px a finger moves before a press becomes a drag
const FLING = { frame: 80, keep: 0.75, stop: 3 };   // ms between a flick's jumps, how much of each it keeps, px it stops under

// Moves a scrolling box by dy at once (never smooth).
const shift = (box: HTMLElement, dy: number) => box.scrollBy({ top: dy, left: 0, behavior: "instant" });

export function useEndlessScroll(page: RefObject<HTMLElement | null>, column: RefObject<HTMLDivElement | null>, list: RefObject<HTMLUListElement | null>, count: number) {
  const [looping, setLooping] = useState(false);
  const period = useRef(0);   // one list's height, with the gap after it: copy to copy

  // The column scrolls on its own here (not a phone), with more than it shows.
  const scrolls = () => {
    const box = column.current;
    return Boolean(box) && getComputedStyle(box!).overflowY === "auto";
  };

  // Loops when the real list is taller than the column: then the copies never show twice at once.
  useLayoutEffect(() => {
    const box = column.current;
    const real = list.current;
    if (!box || !real) return;
    const observer = new ResizeObserver(() => setLooping(scrolls() && real.offsetHeight > box.clientHeight));   // also once, on observing
    observer.observe(real);
    observer.observe(box);
    return () => observer.disconnect();
  }, [count]);   // eslint-disable-line react-hooks/exhaustive-deps -- the list is a new element when the count changes

  // Puts the view back onto the real list when its middle has left it.
  // (Offsets are the column's own: it's positioned, projects.scss.) A few turns at most: a jump is
  // always possible there, since the list is taller than the view.
  const wrap = () => {
    const box = column.current;
    const real = list.current;
    const p = period.current;
    if (!box || !real || p <= 0) return;
    const middle = () => box.scrollTop + box.clientHeight / 2 - real.offsetTop;   // into the real list
    for (let turn = 0; turn < 4 && middle() < 0; turn++) shift(box, p);
    for (let turn = 0; turn < 4 && middle() >= p; turn++) shift(box, -p);
  };

  // Copies drawn (or redrawn at a new size): measure the period, and keep what's on screen in place
  // on the real list (it starts there: the first animation at the top, as without the loop).
  const wasLooping = useRef(false);
  useLayoutEffect(() => {
    const box = column.current;
    const real = list.current;
    const copy = real?.previousElementSibling as HTMLElement | null;
    if (!looping || !box || !real || !copy) { period.current = 0; wasLooping.current = false; return; }
    const measure = () => {
      const before = period.current;
      period.current = real.offsetTop - copy.offsetTop;
      if (!wasLooping.current) shift(box, period.current);   // the copy above pushed the real list down
      else if (before > 0 && before !== period.current) shift(box, period.current - before);
      wasLooping.current = true;
      wrap();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(real);
    return () => observer.disconnect();
  }, [looping, count]);   // eslint-disable-line react-hooks/exhaustive-deps -- the list is a new element when the count changes

  // The wheel, a finger, and the wrap after any scroll (the keyboard's too).
  useEffect(() => {
    const area = page.current;
    const box = column.current;
    if (!area || !box) return;
    let fling: ReturnType<typeof setTimeout> | undefined;
    const stopFling = () => clearTimeout(fling);
    const scrollBy = (dy: number) => shift(box, dy);

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || !scrolls() || box.scrollHeight <= box.clientHeight) return;
      event.preventDefault();
      stopFling();
      scrollBy(event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY);
    };

    // A finger (or pen) on the column: a tap until it moves TAP px, then a drag the column follows.
    let press: { id: number; y: number; dragging: boolean; moves: { y: number; t: number }[] } | null = null;
    let dragged = false;   // swallow the click a drag ends with
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !scrolls()) return;
      stopFling();
      press = { id: event.pointerId, y: event.clientY, dragging: false, moves: [{ y: event.clientY, t: event.timeStamp }] };
    };
    const onMove = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.id) return;
      if (!press.dragging) {
        if (Math.abs(event.clientY - press.y) < TAP) return;
        press.dragging = true;
        box.setPointerCapture(event.pointerId);
      }
      scrollBy(press.y - event.clientY);
      press.y = event.clientY;
      press.moves = [...press.moves.filter((move) => event.timeStamp - move.t < 100), { y: event.clientY, t: event.timeStamp }];
    };
    const onUp = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.id) return;
      const { dragging, moves } = press;
      press = null;
      if (!dragging) return;
      dragged = true;
      // A flick: its speed over the last 100 ms, carried on in jumps a frame apart.
      const first = moves[0];
      const last = moves[moves.length - 1];
      let step = last.t > first.t ? ((first.y - last.y) / (last.t - first.t)) * FLING.frame : 0;
      const next = () => {
        if (Math.abs(step) < FLING.stop) return;
        scrollBy(step);
        step *= FLING.keep;
        fling = setTimeout(next, FLING.frame);
      };
      fling = setTimeout(next, FLING.frame);
    };
    const onCancel = (event: PointerEvent) => { if (press?.id === event.pointerId) press = null; };
    const onClick = (event: MouseEvent) => {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    };

    area.addEventListener("wheel", onWheel, { passive: false });
    box.addEventListener("pointerdown", onDown);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerup", onUp);
    box.addEventListener("pointercancel", onCancel);
    box.addEventListener("click", onClick, true);
    box.addEventListener("scroll", wrap);
    return () => {
      stopFling();
      area.removeEventListener("wheel", onWheel);
      box.removeEventListener("pointerdown", onDown);
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerup", onUp);
      box.removeEventListener("pointercancel", onCancel);
      box.removeEventListener("click", onClick, true);
      box.removeEventListener("scroll", wrap);
    };
  }, [page, column]);   // eslint-disable-line react-hooks/exhaustive-deps -- set up once; reads the refs when it runs

  return looping;
}
