"use client";

// lucide names its flip icons after the mirror line: FlipVertical2 has a vertical line (left to right).
import { FlipHorizontal2, FlipVertical2, RotateCcw } from "lucide-react";
import { flip, normaliseAngle, resetTransform, type Transform } from "@/core/model";
import { useEditor } from "@/store/useEditor";
import { commitPreview, commitSoon, previewEach, useEditTargets, type SaveTransforms } from "./transformEditing";

// The Picture tab: exact numbers for where the picture is, how big and how turned, plus flip and
// reset. Positions are project pixels from the centre (0, 0 is centred). With several pictures
// selected, a typed number goes to all of them; flip and reset too.
export function PictureControls({ save }: { save: SaveTransforms }) {
  const targets = useEditTargets();
  const width = useEditor((state) => state.project?.width ?? 1280);
  const height = useEditor((state) => state.project?.height ?? 720);
  const transform = useEditor((state) => (targets[0] ? state.transformPreview[targets[0]] ?? state.frames[targets[0]]?.transform : undefined));

  if (!transform) return <p className="placeholder">Take a picture first, then move, size and turn it here or on the stage (with the camera off).</p>;

  const type = (field: "x" | "y" | "size" | "angle", value: string) => {
    const number = Number(value);
    if (value.trim() === "" || !Number.isFinite(number)) return;
    const change = (t: Transform): Transform => {
      if (field === "x") return { ...t, x: number / width };
      if (field === "y") return { ...t, y: number / height };
      if (field === "size") return { ...t, scale: Math.min(10, Math.max(0.1, number / 100)) };
      return { ...t, rotation: normaliseAngle(number) };
    };
    previewEach(targets, change);
    commitSoon(targets, field === "angle" ? "Turn picture" : field === "size" ? "Size picture" : "Move picture", save);
  };

  const now = (label: string, change: (t: Transform) => Transform) => { previewEach(targets, change); commitPreview(targets, label, save); };

  return (
    <div className="picture-controls">
      <div className="fields">
        <NumberField label="Left / right" unit="px" value={Math.round(transform.x * width)} step={1} onChange={(v) => type("x", v)} />
        <NumberField label="Up / down" unit="px" value={Math.round(transform.y * height)} step={1} onChange={(v) => type("y", v)} />
        <NumberField label="Size" unit="%" value={Math.round(transform.scale * 100)} step={1} min={10} max={1000} onChange={(v) => type("size", v)} />
        <NumberField label="Turn" unit="°" value={Math.round(transform.rotation * 10) / 10} step={0.5} min={-180} max={180} onChange={(v) => type("angle", v)} />
      </div>
      <div className="buttons">
        <button type="button" className={`icon-button is-small${transform.flipX ? " is-on" : ""}`} aria-label="Flip left to right" aria-pressed={transform.flipX} title="Flip left to right" onClick={() => now("Flip picture", (t) => flip(t, "x"))}><FlipVertical2 size={20} /></button>
        <button type="button" className={`icon-button is-small${transform.flipY ? " is-on" : ""}`} aria-label="Flip upside down" aria-pressed={transform.flipY} title="Flip upside down" onClick={() => now("Flip picture", (t) => flip(t, "y"))}><FlipHorizontal2 size={20} /></button>
        <button type="button" className="icon-button is-small" aria-label="Reset position" title="Back to where it was taken: centred, full size, not turned" onClick={() => now("Reset picture", () => resetTransform())}><RotateCcw size={20} /><span>Reset</span></button>
      </div>
    </div>
  );
}

function NumberField({ label, unit, value, step, min, max, onChange }: { label: string; unit: string; value: number; step: number; min?: number; max?: number; onChange: (value: string) => void }) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <span className="input">
        <input type="number" value={value} step={step} min={min} max={max} onChange={(event) => onChange(event.target.value)} />
        <span className="unit" aria-hidden="true">{unit}</span>
      </span>
    </label>
  );
}
