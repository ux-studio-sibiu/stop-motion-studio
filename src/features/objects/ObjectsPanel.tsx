"use client";

import { createBubble, createOverlay, createShape, createText, hasText, objectLabel, SHAPE, SPEECH_BUBBLE, TEXT, type Element } from "@/core/model";
import { useEditor } from "@/store/useEditor";
import { ObjectIcon } from "@/studio/ObjectIcon";
import { addOverlay } from "@/studio/overlayEditing";
import { addToPicture, focusObjectText, useStageObjects, type ObjectSaves } from "./objectEditing";
import { ObjectTile, type Place } from "./ObjectTile";
import "./_objects.scss";

const OVERLAY_SECONDS = 2;   // how long an object dropped on the overlay track shows, to start with

// The Objects tab (steps 23-24):
//   - the kinds of object, as icons: drag one onto the picture on the stage (camera off) and it
//     belongs to that picture; drag it onto the overlay track under the pictures and it lives in
//     time, from where it was dropped; a click or the keyboard puts it on the picture, near the top;
//   - the picked object's settings aren't here: they float by the object on the stage
//     (ObjectFloat, ObjectSettings).
// Where an object is, how big and how it's turned are set on the stage itself (ObjectEditor), the
// same for every kind. A new kind of object adds a tile here and a settings component in ObjectSettings.
export function ObjectsPanel({ saves, onStage }: { saves: ObjectSaves; onStage: boolean }) {
  const { frame, placed, picked: selected } = useStageObjects();
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

  return (
    <div className="nsc-objects-panel">
      <div className="tiles" role="group" aria-label="Objects to add">
        {tile("Speech bubble", SPEECH_BUBBLE, () => createBubble())}
        {tile("Text", TEXT, () => createText())}
        {tile("Shape", SHAPE, () => createShape())}
      </div>
      <p className="hint">{onStage ? "Drag one onto the picture, or onto the track under the pictures to show it over several." : off}</p>
      {onStage && placed.length > 0 && !selected && <p className="hint">Click something on the picture to change it: its settings open next to it.</p>}
    </div>
  );
}
