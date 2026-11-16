"use client";

import { RotateCcw } from "lucide-react";
import { DEFAULT_ADJUST, MAX_ADJUST, MIN_ADJUST, sameAdjust, type Adjust } from "@/core/model";
import type { EditorState } from "@/store/editorStore";
import { editorStore, useEditor } from "@/store/useEditor";
import { saveSoon, settleSoon } from "@/studio/saveSoon";
import type { AdjustChange } from "@/studio/useStudioCommands";
import { useEditTargets } from "./transformEditing";

export type SaveAdjusts = (changes: AdjustChange[], label: string) => Promise<boolean>;

// Brightness and contrast (step 20), in the Picture tab under the position. Non-destructive: the
// photo is never changed, the renderer applies the values. While a slider moves, the stage shows
// the new values (a preview in the store); letting go saves one undoable step. A run of arrow
// presses on a slider is saved once it stops, like nudges (saveSoon), so it's one undo too.
// With several pictures selected, the sliders and Reset change them all, as one undo.

const shownAdjust = (state: EditorState, id: string): Adjust => state.adjustPreview[id] ?? state.frames[id]?.adjust ?? DEFAULT_ADJUST;

export function AdjustControls({ save }: { save: SaveAdjusts }) {
  const targets = useEditTargets();
  const adjust = useEditor((state) => (targets[0] ? shownAdjust(state, targets[0]) : undefined));
  const changed = useEditor((state) => targets.some((id) => !sameAdjust(shownAdjust(state, id), DEFAULT_ADJUST)));
  if (!adjust) return null;

  const preview = (field: keyof Adjust, percent: number) => {
    const state = editorStore.getState();
    state.previewAdjusts(Object.fromEntries(targets.map((id) => [id, { ...shownAdjust(state, id), [field]: percent / 100 }])));
  };

  // From what's saved to what's shown (or to `to`), for the pictures being edited; nothing if
  // nothing changed.
  const commit = (label: string, to?: Adjust) => {
    settleSoon("adjust");
    const state = editorStore.getState();
    const changes = targets.flatMap((id) => {
      const from = state.frames[id]?.adjust;
      const next = to ?? shownAdjust(state, id);
      return from && !sameAdjust(from, next) ? [{ id, from, to: next }] : [];
    });
    if (to || changes.length === 0) state.clearAdjustPreview(targets);   // Reset replaces anything not saved yet
    if (changes.length === 0) return;
    void save(changes, label).then((ok) => { if (!ok) editorStore.getState().clearAdjustPreview(targets); });
  };

  const slider = (field: keyof Adjust, label: string) => {
    const percent = Math.round(adjust[field] * 100);
    const done = () => commit(`Change ${label.toLowerCase()}`);
    return (
      <label className="slider">
        <span>{label}: {percent}%</span>
        <input type="range" min={MIN_ADJUST * 100} max={MAX_ADJUST * 100} step={5} value={percent} aria-label={label} aria-valuetext={`${percent}%`} onChange={(event) => preview(field, Number(event.target.value))} onPointerUp={done} onKeyUp={() => saveSoon("adjust", `${field}:${targets.join()}`, done)} onBlur={done} />
      </label>
    );
  };

  return (
    <div className="adjust-controls">
      {slider("brightness", "Brightness")}
      {slider("contrast", "Contrast")}
      <div className="buttons">
        <button type="button" className="icon-button is-small" aria-label="Reset brightness and contrast" title="Back to the photo as it was taken" disabled={!changed} onClick={() => commit("Reset brightness and contrast", { ...DEFAULT_ADJUST })}><RotateCcw size={18} /><span>Reset</span></button>
      </div>
    </div>
  );
}
