"use client";

import { ChevronDown, Layers } from "lucide-react";
import { MAX_SAFE_MARGIN, SAFE_MARGIN, safeMargin } from "@/core/model";
import { editorStore, useEditor } from "@/store/useEditor";
import { useDropdown } from "./useDropdown";

// See-through: the button turns it on and off; the arrow beside it opens its options (how
// strong, how many pictures back, outline only or spot the difference, the safe zone). Escape or a
// click outside closes them.
export function SeeThroughMenu({ onSafeMargin }: { onSafeMargin: (from: number, to: number) => Promise<boolean> }) {
  const onion = useEditor((state) => state.onionSkin);
  const saved = useEditor((state) => (state.project ? safeMargin(state.project) : SAFE_MARGIN));
  const dragged = useEditor((state) => state.safeMarginPreview);
  const margin = dragged ?? saved;
  // While dragging, only the stage changes; letting go (or a key press) saves one undoable step.
  const commit = () => {
    const to = editorStore.getState().safeMarginPreview;
    if (to === null) return;
    if (to === saved) { editorStore.getState().previewSafeMargin(null); return; }
    void onSafeMargin(saved, to).then((ok) => { if (!ok) editorStore.getState().previewSafeMargin(null); });
  };
  const { open, toggle, ref } = useDropdown();
  const set = editorStore.getState().setOnionSkin;

  return (
    <div ref={ref} className="nsc-see-through option-menu">
      <button type="button" className={`icon-button toggle${onion.on ? " is-on" : ""}`} aria-label="See-through" aria-pressed={onion.on} title="Show the picture before faintly on top, to line up the next one" onClick={() => set({ on: !onion.on })}>
        <Layers size={24} /><span className="desktop-only">See-through</span>
      </button>
      <button type="button" className={`icon-button more${onion.on ? " is-on" : ""}`} aria-label="See-through options" aria-expanded={open} aria-haspopup="true" onClick={toggle}><ChevronDown size={20} /></button>

      {open && (
        <div className="options" role="group" aria-label="See-through options">
          <label className="option">
            <span>How strong</span>
            <input type="range" min={10} max={90} step={10} disabled={onion.difference} value={Math.round(onion.opacity * 100)} aria-valuetext={`${Math.round(onion.opacity * 100)}%`} onChange={(event) => set({ opacity: Number(event.target.value) / 100, on: true })} />
          </label>
          <label className="option is-check">
            <input type="checkbox" checked={onion.outline} onChange={(event) => set({ outline: event.target.checked, on: true })} />
            <span>Outline only</span>
          </label>
          <label className="option is-check" title="What lines up goes black; what doesn't, glows">
            <input type="checkbox" checked={onion.difference} onChange={(event) => set({ difference: event.target.checked, on: true })} />
            <span>Spot the difference</span>
          </label>
          <label className="option">
            <span>Safe zone: {margin} px</span>
            <input type="range" min={0} max={MAX_SAFE_MARGIN} step={5} value={margin} aria-label="Safe zone" aria-valuetext={`${margin} pixels`} onChange={(event) => editorStore.getState().previewSafeMargin(Number(event.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
          </label>
          <div className="option">
            <span>Pictures shown</span>
            <div className="counts">
              {[1, 2, 3].map((count) => (
                <button key={count} type="button" className={`icon-button is-small${onion.count === count ? " is-on" : ""}`} aria-pressed={onion.count === count} disabled={onion.difference} aria-label={count === 1 ? "1 picture" : `${count} pictures`} onClick={() => set({ count, on: true })}>{count}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
