// The tweak panel's styles (D3), inside its shadow root: in the look of the type and texture kits
// in the other repos (black and white, mono labels, a hard shadow), written small for this page.
// Its own variables only, never the app's tokens, so tuning the tokens can't restyle the panel.
export const PANEL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.panel {
  --bg: #ffffff; --ink: #000000; --muted: #6b6b6b; --faint: #e4e4e4; --wash: #f4f4f2; --on: #000000;
  --mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
  position: fixed; z-index: 2147483000; width: 360px; max-height: min(82vh, 760px);
  display: flex; flex-direction: column;   /* bar, filter, the picked strip when there is one, then the list */
  background: var(--bg); color: var(--ink); border: 1.5px solid var(--ink);
  box-shadow: 6px 6px 0 var(--ink); font: 12px/1.35 var(--sans);
}
.bar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1.5px solid var(--ink); cursor: grab; user-select: none; }
.bar:active { cursor: grabbing; }
.title { flex: 1; font: 700 12px var(--mono); letter-spacing: 0.04em; text-transform: uppercase; }
.count { font: 11px var(--mono); color: var(--muted); }
button { font: inherit; color: inherit; cursor: pointer; }
.seg { display: inline-flex; border: 1.5px solid var(--ink); }
.seg button { padding: 3px 8px; border: 0; background: var(--bg); font: 11px var(--mono); }
.seg button + button { border-left: 1.5px solid var(--ink); }
.seg button[aria-pressed="true"] { background: var(--on); color: var(--bg); }
.close { width: 24px; height: 24px; border: 1.5px solid var(--ink); background: var(--bg); line-height: 1; }
.find { display: flex; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--faint); }
.pick { flex: none; padding: 4px 10px; border: 1.5px solid var(--ink); background: var(--bg); font: 700 11px var(--mono); }
.pick[aria-pressed="true"] { background: var(--on); color: var(--bg); }
.picked { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--faint); background: var(--wash); font-size: 11px; }
.picked .what { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.picked .states { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); white-space: nowrap; }
.picked .close { width: 20px; height: 20px; }
.outline { position: fixed; z-index: 2147482999; pointer-events: none; box-sizing: border-box; border: 2px solid #ff2d55; background: rgb(255 45 85 / 0.06); }
.outline.is-marked { border-style: dashed; background: none; }
.find input { flex: 1; min-width: 0; width: 100%; padding: 5px 8px; border: 1.5px solid var(--ink); background: var(--bg); color: var(--ink); font: 12px var(--mono); }
.body { flex: 1 1 auto; min-height: 0; overflow: auto; background: var(--bg); padding: 4px 0 10px; scrollbar-width: thin; }
.group { padding: 8px 10px 2px; font: 700 10px var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.row { display: grid; grid-template-columns: 1fr auto; gap: 4px 6px; align-items: center; padding: 6px 10px; border-left: 3px solid transparent; }
.row.is-changed { border-left-color: var(--ink); background: var(--wash); }
.name { font: 11.5px var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note { grid-column: 1 / -1; color: var(--muted); font-size: 11px; margin-top: -2px; }
.control { grid-column: 1 / -1; display: flex; align-items: center; gap: 6px; }
.control input[type="text"], .control input[type="number"] { min-width: 0; flex: 1; padding: 3px 6px; border: 1px solid var(--ink); background: var(--bg); color: var(--ink); font: 11.5px var(--mono); }
.control input[type="number"] { flex: 0 0 76px; }
.control input[type="range"] { flex: 1; min-width: 0; accent-color: var(--ink); }
.control input[type="color"] { flex: none; width: 30px; height: 24px; padding: 0; border: 1px solid var(--ink); background: none; }
.unit { font: 11px var(--mono); color: var(--muted); min-width: 22px; }
.reset { padding: 1px 6px; border: 1px solid var(--ink); background: var(--bg); font: 10px var(--mono); }
.reset[hidden] { display: none; }
.empty { padding: 12px 10px; color: var(--muted); }
.foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 10px; border-top: 1.5px solid var(--ink); }
.copy { padding: 5px 10px; border: 1.5px solid var(--ink); background: var(--on); color: var(--bg); font: 700 11px var(--mono); }
.reset-all { padding: 5px 10px; border: 1.5px solid var(--ink); background: var(--bg); font: 700 11px var(--mono); }
.copy:disabled, .reset-all:disabled { opacity: 0.35; cursor: default; }
.said { flex-basis: 100%; color: var(--muted); font-size: 11px; }
.open {
  position: fixed; right: 18px; bottom: 18px; z-index: 2147483000; padding: 8px 12px;
  background: #fff; color: #000; border: 1.5px solid #000; box-shadow: 4px 4px 0 #000;
  font: 700 12px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace; text-transform: uppercase;
}
`;
