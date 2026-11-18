"use client";

import { Trash2, X } from "lucide-react";
import type { HTMLAttributes } from "react";
import { bubbleProps, DRAWING, objectLabel, shapeProps, SHAPE, SPEECH_BUBBLE, TEXT, textProps, withProps } from "@/core/model";
import { editorStore } from "@/store/useEditor";
import { saveSoon } from "@/studio/saveSoon";
import { BubbleSettings } from "./BubbleSettings";
import { commitPlaced, previewPlaced, removePlaced, useStageObjects, type ObjectSaves } from "./objectEditing";
import { ShapeSettings } from "./ShapeSettings";
import { TextSettings } from "./TextSettings";

// The picked object's settings, placed by kind, the same wherever it lives. Nothing when nothing
// is picked. A compact card (shown floating by the object, ObjectFloat): a header with its name,
// Delete and Close, then its kind's settings. (When it shows is on the overlay track already.) `header` goes on the header, so the
// floating panel can be dragged by it.
export function ObjectSettings({ saves, header }: { saves: ObjectSaves; header?: HTMLAttributes<HTMLElement> }) {
  const { frame, overlays, picked: selected } = useStageObjects();
  if (!frame || !selected) return null;

  const { element } = selected;
  const name = objectLabel(element);
  // The settings components' two callbacks (controls.tsx): `set` is one undo step, `type` shows
  // the text as it's typed and saves it once typing stops.
  const set = (patch: Record<string, unknown>, label: string) => { previewPlaced(frame, overlays, selected, withProps(element, patch)); commitPlaced(frame, selected, saves, label); };
  const type = (text: string) => {
    previewPlaced(frame, overlays, selected, withProps(element, { text }));
    saveSoon("object", element.id, () => commitPlaced(frame, selected, saves, element.kind === TEXT ? "Change text" : "Change bubble text"));
  };

  return (
    <section className="settings" aria-label={`${name} settings`}>
      <SettingsHeader name={name} header={header} onDelete={() => removePlaced(frame, selected, saves)} onClose={() => editorStore.getState().selectElement(null)} />
      {element.kind === SPEECH_BUBBLE && <BubbleSettings key={element.id} props={bubbleProps(element)} set={set} type={type} />}
      {element.kind === TEXT && <TextSettings key={element.id} props={textProps(element)} set={set} type={type} />}
      {element.kind === SHAPE && <ShapeSettings key={element.id} props={shapeProps(element)} set={set} type={type} />}
      {element.kind === DRAWING && <p className="hint">Draw more on it, or rub lines out, in the Draw tab. Here it moves, sizes and turns as one.</p>}
    </section>
  );
}

// The card's header: the name, Delete and Close. `header` goes on it (the floating panel drags by
// it). Also drawn on the design page, which has no animation open.
export function SettingsHeader({ name, header, onDelete, onClose }: { name: string; header?: HTMLAttributes<HTMLElement>; onDelete?: () => void; onClose?: () => void }) {
  return (
    <header className="settings-head" {...header}>
      <h3 className="settings-title">{name[0].toUpperCase() + name.slice(1)}</h3>
      <button type="button" className="icon-button is-small" aria-label={`Delete ${name}`} title={`Delete ${name}`} onClick={onDelete}><Trash2 size={18} /></button>
      <button type="button" className="icon-button is-small" aria-label="Close settings" title="Close (Esc on the picture)" onClick={onClose}><X size={18} /></button>
    </header>
  );
}
