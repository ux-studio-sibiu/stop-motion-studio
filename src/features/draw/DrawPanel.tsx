"use client";

import { useId } from "react";
import { Eraser, Pencil, Trash2 } from "lucide-react";
import { PENCIL_WIDTHS, type PencilWidth } from "@/core/model";
import { commitObjects, previewObjects, type SaveObjects } from "@/studio/pictureObjects";
import { Swatches } from "@/studio/Swatches";
import { DRAW_COLOURS, useDrawFrame, useDrawSettings, withDrawing } from "./drawSettings";
import "./_draw.scss";

const WIDTH_NAMES: Readonly<Record<PencilWidth, string>> = { thin: "Thin", medium: "Medium", thick: "Thick", huge: "Huge" };
const DOT: Readonly<Record<PencilWidth, number>> = { thin: 4, medium: 8, thick: 14, huge: 22 };   // px, to show the widths

// The Draw tab (step 24b): free drawing on the picture on the stage, with the camera off. The pencil
// or the eraser, the pencil's colour and width (all remembered after a reload), and clearing the
// picture's drawing. The drawing itself happens on the stage (DrawLayer). Picking a colour or a
// width takes the pencil again.
export function DrawPanel({ save, onStage }: { save: SaveObjects; onStage: boolean }) {
  const { frame, drawing } = useDrawFrame();
  const { tool, setTool, colour, setColour, width, setWidth } = useDrawSettings();
  const widthsId = useId();

  if (!frame) return <p className="placeholder">Take a picture first, then draw on it.</p>;

  const clearDrawing = () => {
    previewObjects(frame.id, withDrawing(frame.elements, drawing, null));
    commitObjects(frame.id, save, "Clear drawing");
  };

  return (
    <div className="nsc-draw-panel">
      <div className="tools" role="group" aria-label="Tool">
        <button type="button" className={`icon-button${tool === "pencil" ? " is-on" : ""}`} aria-pressed={tool === "pencil"} onClick={() => setTool("pencil")}><Pencil size={22} /><span>Pencil</span></button>
        <button type="button" className={`icon-button${tool === "eraser" ? " is-on" : ""}`} aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}><Eraser size={22} /><span>Eraser</span></button>
      </div>
      <Swatches label="Colour" colours={DRAW_COLOURS} value={colour} onPick={(next) => { setColour(next); setTool("pencil"); }} />
      <div className="field">
        <span id={widthsId}>Width</span>
        <div className="widths" role="group" aria-labelledby={widthsId}>
          {PENCIL_WIDTHS.map((id) => (
            <button key={id} type="button" className={`width${width === id ? " is-on" : ""}`} aria-label={WIDTH_NAMES[id]} title={WIDTH_NAMES[id]} aria-pressed={width === id} onClick={() => { setWidth(id); setTool("pencil"); }}>
              <span className="dot" style={{ width: DOT[id], height: DOT[id], background: colour }} />
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="icon-button is-small is-danger" disabled={!drawing} onClick={clearDrawing}><Trash2 size={18} /><span>Clear drawing</span></button>
      <p className="hint">{onStage ? "Draw on the picture. Each line is one undo step." : "Turn the camera off to draw on a picture."}</p>
    </div>
  );
}
