"use client";

import { Trash2 } from "lucide-react";
import { bubbleProps, createBubble, DRAWING, createOverlay, createShape, createText, hasText, objectLabel, overlayEnd, shapeProps, SHAPE, SPEECH_BUBBLE, TEXT, textProps, formatTicks, withProps, type Element } from "@/core/model";
import { useEditor } from "@/store/useEditor";
import { ObjectIcon } from "@/studio/ObjectIcon";
import { addOverlay } from "@/studio/overlayEditing";
import { saveSoon } from "@/studio/saveSoon";
import { BubbleSettings } from "./BubbleSettings";
import { addToPicture, commitPlaced, focusObjectText, previewPlaced, removePlaced, useStageObjects, type ObjectSaves } from "./objectEditing";
import { ObjectTile, type Place } from "./ObjectTile";
import { ShapeSettings } from "./ShapeSettings";
import { TextSettings } from "./TextSettings";
import "./_objects.scss";

const OVERLAY_SECONDS = 2;   // how long an object dropped on the overlay track shows, to start with

// The Objects tab (steps 23-24):
//   - the kinds of object, as icons: drag one onto the picture on the stage (camera off) and it
//     belongs to that picture; drag it onto the overlay track under the pictures and it lives in
//     time, from where it was dropped; a click or the keyboard puts it on the picture, near the top;
//   - below, apart, the settings of the picked object, placed here by kind, the same wherever it
//     lives.
// Where an object is, how big and how it's turned are set on the stage itself (ObjectEditor), the
// same for every kind. A new kind of object adds a tile and a settings component.
export function ObjectsPanel({ saves, onStage }: { saves: ObjectSaves; onStage: boolean }) {
  const { frame, overlays, placed, picked: selected } = useStageObjects();
  const fps = useEditor((state) => state.project?.fps ?? 8);

  if (!frame) return <p className="placeholder">Take a picture first, then put things on it.</p>;

  // Dropped on the track: in time from there. Dropped on the picture, or clicked: on the picture.
  // Either way it's picked, with the keyboard in its text if it has some.
  const add = (object: Element, place: Place | null) => {
    if (place?.on === "track") addOverlay(createOverlay(object, place.tick, OVERLAY_SECONDS * fps), saves.overlays, `Add ${objectLabel(object)}`);
    else addToPicture(frame, object, place?.at ?? null, saves.objects);
    if (hasText(object)) focusObjectText();
  };

  const off = onStage ? undefined : "Turn the camera off to put things on a picture";
  const tile = (label: string, kind: string, make: () => Element) => <ObjectTile label={label} icon={<ObjectIcon kind={kind} size={30} />} disabled={!onStage} title={off} onPlace={(place) => add(make(), place)} />;

  let settings = null;
  if (selected) {
    const { element } = selected;
    const name = objectLabel(element);
    // The settings components' two callbacks (controls.tsx): `set` is one undo step, `type` shows
    // the text as it's typed and saves it once typing stops.
    const set = (patch: Record<string, unknown>, label: string) => { previewPlaced(frame, overlays, selected, withProps(element, patch)); commitPlaced(frame, selected, saves, label); };
    const type = (text: string) => {
      previewPlaced(frame, overlays, selected, withProps(element, { text }));
      saveSoon("object", element.id, () => commitPlaced(frame, selected, saves, element.kind === TEXT ? "Change text" : "Change bubble text"));
    };
    const { overlay } = selected;
    const time = overlay && `from ${formatTicks(overlay.start, fps)} to ${formatTicks(overlayEnd(overlay), fps)}`;
    const where = !overlay ? "On this picture only" : selected.onStage ? `Shows ${time}, over every picture then` : `Not on this picture: it shows ${time}`;
    settings = (
      <section className="settings" aria-label={`${name} settings`}>
        <h3 className="settings-title">{name[0].toUpperCase() + name.slice(1)}</h3>
        <p className="where">{where}</p>
        {element.kind === SPEECH_BUBBLE && <BubbleSettings key={element.id} props={bubbleProps(element)} set={set} type={type} />}
        {element.kind === TEXT && <TextSettings key={element.id} props={textProps(element)} set={set} type={type} />}
        {element.kind === SHAPE && <ShapeSettings key={element.id} props={shapeProps(element)} set={set} type={type} />}
        {element.kind === DRAWING && <p className="hint">Draw more on it, or rub lines out, in the Draw tab. Here it moves, sizes and turns as one.</p>}
        <button type="button" className="icon-button is-small is-danger" aria-label={`Delete ${name}`} onClick={() => removePlaced(frame, selected, saves)}><Trash2 size={18} /><span>Delete</span></button>
      </section>
    );
  }

  return (
    <div className="nsc-objects-panel">
      <div className="tiles" role="group" aria-label="Objects to add">
        {tile("Speech bubble", SPEECH_BUBBLE, () => createBubble())}
        {tile("Text", TEXT, () => createText())}
        {tile("Shape", SHAPE, () => createShape())}
      </div>
      <p className="hint">{onStage ? "Drag one onto the picture, or onto the track under the pictures to show it over several." : off}</p>
      {settings ?? (onStage && placed.length > 0 && <p className="hint">Click something on the picture to change it.</p>)}
    </div>
  );
}
