"use client";

import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { VOLUMES, VOLUME_NAMES, formatTicks, soundsOf } from "@/core/model";
import { SOUND_CATEGORIES, SOUND_LIBRARY } from "@/core/sound";
import { previewSound } from "@/adapters/sound/sound";
import { useEditor } from "@/store/useEditor";
import { addSound, changeSound, deleteSound, placeForSound, soundName, type SaveSounds } from "@/studio/soundEditing";
import { SoundTile } from "./SoundTile";
import "./_sounds.scss";

// The Sounds tab (step 29b): sound effects to put in the animation, on the timeline's bottom row.
//   - the picked sound (one picked on the row) first: how loud it is, and Delete;
//   - then the library by category, as small pills: a click plays one; dragged onto the stage it's
//     added at the picture shown (the first selected one, or the start), dragged onto the Sound
//     Layer at the time it's dropped. Either way it's picked and played.
// Moving a sound in time is done on the row itself (SoundTrack).
export function SoundsPanel({ save }: { save: SaveSounds }) {
  const hasProject = useEditor((state) => state.project !== null);
  const fps = useEditor((state) => state.project?.fps ?? 8);
  const pickedId = useEditor((state) => state.pickedSound);
  const project = useEditor((state) => state.project);
  const picked = useMemo(() => soundsOf(project).find((clip) => clip.id === pickedId), [project, pickedId]);

  return (
    <div className="nsc-sounds-panel">
      {picked && (
        <section className="picked" aria-label="Picked sound">
          <p className="picked-name"><strong>{soundName(picked.sound)}</strong> at {formatTicks(picked.start, fps)}</p>
          <div className="volume" role="group" aria-label="Volume">
            {VOLUMES.map((volume) => (
              <button key={volume} type="button" className={`icon-button is-small${picked.volume === volume ? " is-on" : ""}`} aria-pressed={picked.volume === volume}
                onClick={() => { if (picked.volume === volume) return; previewSound(picked.sound, volume); void changeSound(picked.id, (clip) => ({ ...clip, volume }), save, (name) => `Make ${name} ${VOLUME_NAMES[volume].toLowerCase()}`); }}>
                {VOLUME_NAMES[volume]}
              </button>
            ))}
          </div>
          <button type="button" className="icon-button is-small is-danger" onClick={() => void deleteSound(picked.id, save)}><Trash2 size={18} />Delete sound</button>
        </section>
      )}

      {SOUND_CATEGORIES.map((category) => (
        <section key={category} className="category" aria-label={category}>
          <h3>{category}</h3>
          <ul>
            {SOUND_LIBRARY.filter((entry) => entry.category === category).map((entry) => (
              <li key={entry.id}>
                <SoundTile id={entry.id} name={entry.name} disabled={!hasProject} onPlace={(place) => void addSound(entry.id, place.on === "track" ? place.tick : placeForSound(), save)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
