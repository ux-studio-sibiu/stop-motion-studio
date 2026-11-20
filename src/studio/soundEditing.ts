"use client";

import { createSoundClip, frameStarts, sameSounds, soundsOf, withSoundClip, type SoundClip } from "@/core/model";
import { orderedFrames } from "@/store/editorStore";
import { soundById } from "@/core/sound";
import { previewSound } from "@/adapters/sound/sound";
import { editorStore } from "@/store/useEditor";
import { ALL_LAYERS, remembered, saveRemembered } from "./remembered";

// Changing the sounds in time (step 29b), shared by the timeline's sound row and the Sounds tab.

// Saves the sound list, from what it was to what it becomes, as one undoable step (the studio's
// setSounds command).
export type SaveSounds = (from: readonly SoundClip[], to: readonly SoundClip[], label: string) => Promise<boolean>;

// What every change starts from: the saved sounds, or, while a save is on its way to the store, the
// list it saves. So two sounds dropped quickly both stay: the second builds on the first instead of
// on the list from before it. `pending` goes once the store has that list (or another project
// opens, or the save fails).
let pending: { projectId: string; sounds: SoundClip[] } | null = null;
let watching = false;

export function savedSounds(): SoundClip[] {
  const project = editorStore.getState().project;
  return pending && pending.projectId === project?.id ? pending.sounds : soundsOf(project);
}

function watchStore(): void {
  if (watching) return;
  watching = true;
  editorStore.subscribe((state) => {
    if (pending && (state.project?.id !== pending.projectId || sameSounds(soundsOf(state.project), pending.sounds))) pending = null;
  });
}

// Saves `to` from what's saved now, as one step, and builds the next change on it right away.
async function saveSounds(to: SoundClip[], label: string, save: SaveSounds): Promise<boolean> {
  const projectId = editorStore.getState().project?.id;
  if (!projectId) return false;
  watchStore();
  const from = savedSounds();
  pending = { projectId, sounds: to };
  const saved = await save(from, to, label);
  if (!saved && pending?.sounds === to) pending = null;
  return saved;
}

// A sound's name for the undo button and the bar: the library's, or "Sound" for one this version
// doesn't know (from a newer studio).
export function soundName(sound: string): string {
  return soundById(sound)?.name ?? "Sound";
}

// Adds a library sound at `tick`, picks it, and plays it, so the child hears what they added. A
// hidden sound row is shown again, so they also see where it went.
export async function addSound(sound: string, tick: number, save: SaveSounds): Promise<void> {
  const clip = createSoundClip(sound, tick);
  previewSound(sound);
  const layers = remembered.timelineLayers.read() ?? ALL_LAYERS;
  if (!layers.sounds) saveRemembered(remembered.timelineLayers, { ...layers, sounds: true });
  if (await saveSounds([...savedSounds(), clip], `Add ${soundName(sound)}`, save)) editorStore.getState().pickSound(clip.id);
}

// One sound changed (or removed, when `change` gives null), as one step.
export function changeSound(id: string, change: (clip: SoundClip) => SoundClip | null, save: SaveSounds, label: (name: string) => string): Promise<boolean> {
  const from = savedSounds();
  const clip = from.find((item) => item.id === id);
  if (!clip) return Promise.resolve(false);
  return saveSounds(withSoundClip(from, id, change(clip)), label(soundName(clip.sound)), save);
}

// A list of sounds made elsewhere (the sound row's moves), saved the same way.
export const setSoundList = (to: SoundClip[], label: string, save: SaveSounds) => saveSounds(to, label, save);

export const deleteSound = (id: string, save: SaveSounds) => changeSound(id, () => null, save, (name) => `Delete ${name}`);

// Where a sound goes when it's added from the Sounds tab: at the first selected picture, else at
// the playhead (the start, unless it was playing).
export function placeForSound(): number {
  const state = editorStore.getState();
  const frames = orderedFrames(state);
  const first = frames.findIndex((frame) => state.selection.includes(frame.id));
  return first < 0 ? state.playhead : frameStarts(frames)[first];
}
