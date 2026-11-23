"use client";

import type { ReactNode } from "react";
import type { Token } from "./tokens";
import { useTokenValue } from "./tweaks";

// The design system page's own building blocks: a section, a labelled specimen, and a token shown
// with its value.

export function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="ds-section" id={id} aria-labelledby={`${id}-title`}>
      <h2 className="ds-section-title" id={`${id}-title`}>{title}</h2>
      {intro && <p className="ds-intro">{intro}</p>}
      <div className="ds-specimens">{children}</div>
    </section>
  );
}

// One thing to look at, with its name under it. `wide`: the whole row; `studio`: inside the
// studio's own scope (.nsc-studio), so its styles apply, without the studio's full-screen layout.
export function Specimen({ label, note, wide = false, studio = false, board = false, children }: { label: string; note?: string; wide?: boolean; studio?: boolean; board?: boolean; children: ReactNode }) {
  return (
    <figure className={`ds-specimen${wide ? " is-wide" : ""}${board ? " is-board" : ""}`}>
      <div className="ds-stage">{studio ? <div className="nsc-studio is-ready is-specimen">{children}</div> : children}</div>
      <figcaption>
        <span className="ds-label">{label}</span>
        {note && <span className="ds-note">{note}</span>}
      </figcaption>
    </figure>
  );
}

// A token's value as the page has it now: the scheme shown, with any tweak (tweaks.ts).
export function TokenValue({ name }: { name: string }) {
  return <code className="ds-value">{useTokenValue(name)}</code>;
}

// A token as its kind shows it: a colour as a swatch, a text size as text at that size, a shadow
// on a card, a corner, a line, a space or a size as a bar, with its name. Its value and what it's
// for are in a tooltip box, on hover or keyboard focus.
export function TokenSpecimen({ token }: { token: Token }) {
  const v = `var(${token.name})`;
  const look = token.kind === "colour" ? <span className="ds-swatch" style={{ background: v }} /> : {
    "Text size": <span className="ds-sample" style={{ fontSize: v }}>Aa</span>,
    Shadow: <span className="ds-shadow" style={{ boxShadow: v }} />,
    Corner: <span className="ds-length is-corner" style={{ borderTopLeftRadius: v }} />,
    Line: <span className="ds-length is-line" style={{ height: v }} />,
    Font: <span className="ds-sample" style={{ fontFamily: v }}>Aa</span>,
  }[token.group as string] ?? <span className="ds-length" style={{ width: `min(${v}, 4rem)` }} />;
  return (
    <div className="ds-token" tabIndex={0} aria-describedby={`tip${token.name}`} data-colour-token={token.kind === "colour" ? token.name : undefined}>
      {look}
      <code className="ds-name">{token.name}</code>
      <span className="ds-tip" role="tooltip" id={`tip${token.name}`}>
        <TokenValue name={token.name} />
        <span className="ds-tip-note">{token.note}</span>
      </span>
    </div>
  );
}
