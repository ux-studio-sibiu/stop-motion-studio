"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { PANEL_CSS } from "./panelStyles";
import { changeLines, changesMessage } from "./changes";
import { describe, elementsUsing, tokensUsedBy } from "./tokenScan";
import { TOKEN_GROUPS, TOKENS, tokensIn, type Token } from "./tokens";
import { baseValue, type Scheme, type Tweaks } from "./tweaks";

// The floating tweak panel (D3): the tokens in their groups, a control for each kind, a filter,
// light / dark (which scheme is shown and tuned), and reset for one token. Dragged by its bar;
// Shift+T (or the Tokens button) opens and closes it. It lives in a shadow root of its own, so
// the tokens being tuned can't restyle it.
// Pick: click an element on the page and the list shows only the tokens it uses (tokenScan.ts),
// with or without its hover, focus and pressed looks; hovering a token outlines every element
// that uses it.
// Copy and paste a colour (colourCopy.ts): Alt+click a colour token copies it, Ctrl+Alt+click another
// pastes it there; the page does it (onColourClick, the same as on its token board), the panel says so.

const KNOWN = new Set(TOKENS.map((token) => token.name));
type Box = { left: number; top: number; width: number; height: number };
// What a pointer is over, for picking: an icon (an SVG, or a part of one) counts as the element that
// holds it, since icons only inherit their colour.
const pickable = (target: EventTarget | null): Element | null => {
  let element = target instanceof Element ? target : null;
  while (element && (element instanceof SVGElement)) element = element.parentElement;
  return element;
};
const boxOf = (element: Element): Box => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };

type Props = { scheme: Scheme; setScheme: (scheme: Scheme) => void; tweaks: Tweaks; values: Record<string, string>; set: (name: string, value: string) => void; reset: (name: string) => void; resetAll: () => void; onColourClick: (event: ReactMouseEvent, name: string) => string | null; colourCursor?: string };

export function TokenPanel(props: Props) {
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  // The host gets its shadow root, with the panel's styles, when it's in the page.
  const attach = (host: HTMLDivElement | null) => {
    if (!host || root) return;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = PANEL_CSS;
    shadow.replaceChildren(style);
    setRoot(shadow);
  };
  return <div data-design-panel="" ref={attach}>{root && createPortal(<Panel {...props} host={root.host} />, root)}</div>;
}

function Panel({ scheme, setScheme, tweaks, values, set, reset, resetAll, onColourClick, colourCursor, host }: Props & { host: Element }) {
  const [open, setOpen] = useState(true);
  const [find, setFind] = useState("");
  const [at, setAt] = useState(() => ({ x: Math.max(16, window.innerWidth - 360 - 24), y: 64 }));   // top right, below the dev server's badge, to start with
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<{ element: Element; label: string } | null>(null);
  const [states, setStates] = useState(true);
  const [note, setNote] = useState("");   // what Copy changes or Reset all just did
  const [hover, setHover] = useState<Element | null>(null);       // under the pointer while picking
  const [marked, setMarked] = useState<Element[]>([]);            // using the token under the pointer in the list
  const [, redraw] = useState(0);                                 // outlines follow scrolling
  const pickedTokens = useMemo(() => (picked ? tokensUsedBy(picked.element, KNOWN, { states }) : null), [picked, states, values]);   // eslint-disable-line react-hooks/exhaustive-deps -- values: a tweak can change what applies (rare), cheap to redo

  // Picking: the element under the pointer is outlined; a click picks it, Esc stops. The page
  // doesn't get the click, and the panel itself can't be picked.
  useEffect(() => {
    if (!picking) return;
    const outside = (event: Event) => !event.composedPath().includes(host);
    const onMove = (event: globalThis.PointerEvent) => setHover(outside(event) ? pickable(event.target) : null);
    const onClick = (event: MouseEvent) => {
      const element = outside(event) ? pickable(event.target) : null;
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      setPicked({ element, label: describe(element) });
      setPicking(false);
      setHover(null);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setPicking(false); setHover(null); } };
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    document.documentElement.style.cursor = "crosshair";
    return () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      document.documentElement.style.removeProperty("cursor");
    };
  }, [picking, host]);

  // While something is outlined, outlines move with the page.
  const outlining = Boolean(hover || marked.length);
  useEffect(() => {
    if (!outlining) return;
    const again = () => redraw((n) => n + 1);
    window.addEventListener("scroll", again, true);
    window.addEventListener("resize", again);
    return () => { window.removeEventListener("scroll", again, true); window.removeEventListener("resize", again); };
  }, [outlining]);

  // Shift+T opens and closes it, except while typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.composedPath().some((node) => node instanceof HTMLElement && (node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.isContentEditable));
      if (event.shiftKey && event.key.toLowerCase() === "t" && !event.ctrlKey && !event.metaKey && !event.altKey && !typing) { event.preventDefault(); setOpen((now) => !now); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onBarDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { dx: event.clientX - at.x, dy: event.clientY - at.y };
  };
  const onBarMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setAt({ x: Math.min(window.innerWidth - 80, Math.max(-280, event.clientX - drag.current.dx)), y: Math.min(window.innerHeight - 40, Math.max(0, event.clientY - drag.current.dy)) });
  };

  const changed = Object.keys(tweaks[scheme]).length;
  const total = changeLines(tweaks).length;   // both themes, what Copy changes would give
  const say = (text: string) => { setNote(text); setTimeout(() => setNote(""), 2500); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(changesMessage(tweaks)); say(`Copied ${total} change${total === 1 ? "" : "s"}: paste them into the chat`); }
    catch { say("Couldn't copy: the browser blocked the clipboard"); }
  };
  const clearAll = () => { if (window.confirm(`Reset all ${total} tweak${total === 1 ? "" : "s"}, in both themes?`)) { resetAll(); say("All tweaks reset"); } };
  const outlines = (
    <>
      {hover && <div className="outline" style={boxOf(hover)} />}
      {marked.map((element, i) => <div key={i} className="outline is-marked" style={boxOf(element)} />)}
    </>
  );
  if (!open) return <>{outlines}<button type="button" className="open" onClick={() => setOpen(true)}>Tokens{total ? ` · ${total}` : ""}</button></>;

  const query = find.trim().toLowerCase();
  const matches = (token: Token) => (!pickedTokens || pickedTokens.has(token.name)) && (!query || token.name.includes(query) || token.note.toLowerCase().includes(query));
  const scope = document.querySelector(".nsc-design") ?? document.body;
  const groups = TOKEN_GROUPS.map((group) => ({ group, tokens: tokensIn(group).filter(matches) })).filter((entry) => entry.tokens.length);

  return (
    <>
    {outlines}
    <div className="panel" role="dialog" aria-label="Design tokens" style={{ left: at.x, top: at.y }}>
      <div className="bar" onPointerDown={onBarDown} onPointerMove={onBarMove} onPointerUp={() => { drag.current = null; }}>
        <span className="title">Tokens</span>
        {total > 0 && <span className="count" title={`${changed} in ${scheme}`}>{total} changed</span>}
        <span className="seg" role="group" aria-label="Scheme">
          {(["light", "dark"] as const).map((item) => <button key={item} type="button" aria-pressed={scheme === item} onClick={() => setScheme(item)}>{item}</button>)}
        </span>
        <button type="button" className="close" aria-label="Close (Shift+T)" title="Close (Shift+T)" onClick={() => setOpen(false)}>×</button>
      </div>
      <div className="find">
        <input type="text" placeholder="Filter: name or what it's for" aria-label="Filter tokens" value={find} onChange={(event) => setFind(event.target.value)} />
        <button type="button" className="pick" aria-pressed={picking} title="Click an element on the page to see only the tokens it uses (Esc stops)" onClick={() => { setPicking(!picking); setHover(null); }}>{picking ? "Picking…" : "Pick"}</button>
      </div>
      {picked && (
        <div className="picked">
          <span className="what" title={picked.label}>Tokens of <b>{picked.label}</b>: {pickedTokens?.size ?? 0}</span>
          <label className="states"><input type="checkbox" checked={states} onChange={(event) => setStates(event.target.checked)} />hover, focus</label>
          <button type="button" className="close" aria-label="Show all tokens" title="Show all tokens" onClick={() => setPicked(null)}>×</button>
        </div>
      )}
      <div className="body">
        {groups.length === 0 && <p className="empty">No token matches.</p>}
        {groups.map(({ group, tokens }) => (
          <div key={group}>
            <div className="group">{group}</div>
            {tokens.map((token) => (
              <TokenRow key={token.name} onHover={(on) => setMarked(on ? elementsUsing(token.name, scope) : [])} onColourClick={(event) => { const message = onColourClick(event, token.name); if (message) say(message); }} colourCursor={colourCursor} token={token} value={values[token.name] ?? baseValue(token, scheme)} changed={token.name in tweaks[scheme]} onChange={(value) => set(token.name, value)} onReset={() => reset(token.name)} />
            ))}
          </div>
        ))}
      </div>
      <div className="foot">
        <button type="button" className="copy" disabled={total === 0} onClick={() => void copy()} title="Copy the changes as a message for the chat, to make them permanent">Copy changes</button>
        <button type="button" className="reset-all" disabled={total === 0} onClick={clearAll}>Reset all</button>
        {note && <span className="said" role="status">{note}</span>}
      </div>
    </div>
    </>
  );
}

const LENGTH = /^(-?\d*\.?\d+)(rem|px|em|%)$/;
const HEX = /^#[0-9a-f]{6}$/i;

// One token: its name, what it's for, and a control for its kind.
function TokenRow({ token, value, changed, onChange, onReset, onHover, onColourClick, colourCursor }: { token: Token; value: string; changed: boolean; onChange: (value: string) => void; onReset: () => void; onHover: (on: boolean) => void; onColourClick: (event: ReactMouseEvent) => void; colourCursor?: string }) {
  const length = token.kind === "length" ? LENGTH.exec(value) : null;
  let control;
  if (token.kind === "colour") {
    control = (
      <>
        {HEX.test(value) && <input type="color" aria-label={`${token.name} colour`} value={value.toLowerCase()} onChange={(event) => onChange(event.target.value)} />}
        <input type="text" aria-label={token.name} value={value} spellCheck={false} onChange={(event) => onChange(event.target.value)} />
      </>
    );
  } else if (length) {
    const [, number, unit] = length;
    const n = Number(number);
    const step = unit === "px" ? 1 : 0.0625;
    const max = Math.max(unit === "px" ? 12 : 3, n * 3);
    control = (
      <>
        <input type="range" aria-label={`${token.name} slider`} min={0} max={max} step={step} value={n} onChange={(event) => onChange(`${Number(event.target.value)}${unit}`)} />
        <input type="number" aria-label={token.name} step={step} value={n} onChange={(event) => onChange(`${event.target.value}${unit}`)} />
        <span className="unit">{unit}</span>
      </>
    );
  } else {
    control = <input type="text" aria-label={token.name} value={value} spellCheck={false} onChange={(event) => onChange(event.target.value)} />;
  }
  return (
    <div className={`row${changed ? " is-changed" : ""}`} onPointerEnter={() => onHover(true)} onPointerLeave={() => onHover(false)}
      {...(token.kind === "colour" ? { onClickCapture: onColourClick, style: colourCursor ? { cursor: colourCursor } : undefined } : {})}>
      <span className="name" title={token.name}>{token.name}</span>
      <button type="button" className="reset" hidden={!changed} aria-label={`Reset ${token.name}`} onClick={onReset}>reset</button>
      <span className="note">{token.note}</span>
      <div className="control">{control}</div>
    </div>
  );
}
