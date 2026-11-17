"use client";

import { MessageCircle, Trash2 } from "lucide-react";
import { boxAt, createBubble, SPEECH_BUBBLE, type Element, type Point } from "@/core/model";
import { editorStore, useEditor } from "@/store/useEditor";
import { BubbleSettings } from "./BubbleSettings";
import { changeObject, commitObjects, focusObjectText, labelOf, previewObjects, savedObjects, useObjectFrame, type SaveObjects } from "./objectFrame";
import { ObjectTile } from "./ObjectTile";
import "./_objects.scss";

// The Objects tab (step 23):
//   - the kinds of object, as icons: drag one onto the picture on the stage (camera off) to put it
//     there; a click or the keyboard puts it near the top;
//   - below, apart, the settings of the object picked on the stage, placed here by kind.
// Where an object is, how big and how it's turned are set on the stage itself (ObjectEditor), the
// same for every kind. A new kind of object adds a tile and a settings component.
export function ObjectsPanel({ save, onStage }: { save: SaveObjects; onStage: boolean }) {
  const frame = useObjectFrame();
  const selectedId = useEditor((state) => state.selectedElement);
  const selected = frame?.elements.find((element) => element.id === selectedId);

  if (!frame) return <p className="placeholder">Take a picture first, then put things on it.</p>;

  // Dropped: centred where it landed. Clicked: a little lower and to the right of the last one, so
  // none hides another.
  const add = (object: Element, at: Point | null) => {
    const saved = savedObjects(frame.id);
    const step = saved.length % 5;
    const box = at ? boxAt(object.box, at) : { ...object.box, x: object.box.x + step * 0.06, y: object.box.y + step * 0.1 };
    const placed = { ...object, box };
    void save(frame.id, saved, [...saved, placed], `Add ${labelOf(placed)}`).then((ok) => {
      if (!ok) return;
      editorStore.getState().selectElement(placed.id);
      if (placed.kind === SPEECH_BUBBLE) focusObjectText();   // type straight away
    });
  };

  const change = (next: Element, label: string) => changeObject(frame.id, frame.elements, next, save, label);
  const preview = (next: Element) => previewObjects(frame.id, frame.elements.map((item) => (item.id === next.id ? next : item)));

  const remove = () => {
    if (!selected) return;
    previewObjects(frame.id, frame.elements.filter((element) => element.id !== selected.id));
    commitObjects(frame.id, save, `Delete ${labelOf(selected)}`);
    editorStore.getState().selectElement(null);
  };

  const name = selected && labelOf(selected);
  return (
    <div className="nsc-objects-panel">
      <div className="tiles" role="group" aria-label="Objects to add">
        <ObjectTile label="Speech bubble" icon={<MessageCircle size={30} />} disabled={!onStage} title={onStage ? undefined : "Turn the camera off to put things on a picture"} onPlace={(at) => add(createBubble(), at)} />
      </div>
      <p className="hint">{onStage ? "Drag one onto the picture." : "Turn the camera off to put things on a picture."}</p>

      {selected && name ? (
        <section className="settings" aria-label={`${name} settings`}>
          <h3 className="settings-title">{name[0].toUpperCase() + name.slice(1)}</h3>
          {selected.kind === SPEECH_BUBBLE && <BubbleSettings key={selected.id} element={selected} frameId={frame.id} save={save} change={change} preview={preview} />}
          <button type="button" className="icon-button is-small is-danger" aria-label={`Delete ${name}`} onClick={remove}><Trash2 size={18} /><span>Delete</span></button>
        </section>
      ) : onStage && frame.elements.length > 0 && <p className="hint">Click something on the picture to change it.</p>}
    </div>
  );
}
