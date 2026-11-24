"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Clapperboard, Plus, Settings } from "lucide-react";
import { exportArchive, importArchives } from "@/adapters/archive/projectArchive";
import { decodePicture } from "@/adapters/images/thumbnail";
import { ArchiveError } from "@/core/archive";
import { download } from "@/studio/useExport";
import { forgetAnimation } from "@/studio/remembered";
import { appRepository } from "@/adapters/storage/appRepository";
import type { Project } from "@/core/model";
import { createSavedProject } from "./createSavedProject";
import { addDemosOnce } from "./demos";
import { CardboardBurst } from "./CardboardBurst";
import { DeleteDialog } from "./DeleteDialog";
import { HomeTitle, TitleCard } from "./HomeTitle";
import { ProjectCard } from "./ProjectCard";
import { SettingsDialog } from "./SettingsDialog";
import { StorageWarning } from "./StorageMeter";
import { useEndlessScroll } from "./useEndlessScroll";
import { covers, useProjects } from "./useProjects";
import "./projects.scss";

// The home page: every animation saved in this browser, newest first. Each can be backed up as a
// .zip (step 27), and a backup restored here, as a new animation, on this device or another; the
// backup of all animations (Settings) restores here too, every animation in it.
export function ProjectsPage() {
  const router = useRouter();
  const list = useProjects();
  const waited = useWaited(SHOW_AFTER);   // slow to list: show the page anyway, with "Loading…"
  const ready = list !== null || waited;
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveNote, setArchiveNote] = useState<{ text: string; problem: boolean } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const page = useRef<HTMLElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const realList = useRef<HTMLUListElement>(null);
  // The wheel anywhere on the page and a finger on the column scroll it, round and round: copies of
  // the list before and after the real one, enough to fill the window (useEndlessScroll).
  const copies = useEndlessScroll(page, column, realList, list?.projects.length ?? 0);
  const copyLists = () => Array.from({ length: copies }, (_, i) => <ul key={i} className="projects is-copy" aria-hidden="true">{cards(true)}</ul>);
  const listed = list !== null;
  useEffect(() => { if (listed) addDemosOnce(); }, [listed]);   // the demo animations, once per browser, once the page is showing
  // The intro (HomeTitle, INTRO): how many of its frames after the title's cards are down so far.
  const [after, setAfter] = useState(0);
  const piecesShown = Math.min(after, TITLE_BURST.shape.pieces);   // the burst's frames come first
  const buttonStyle = (k: number) => (after > INTRO.buttonsAt + k ? undefined : HIDDEN);
  const slide = SLIDE[Math.min(Math.max(after - INTRO.slideAt, 0), SLIDE.length - 1)];   // how far below its place the column still is

  const backUp = async (project: Project) => {
    try {
      const { blob, name } = await exportArchive(appRepository(), project.id);
      download(blob, name);
      setArchiveNote({ text: `Saved a backup of ${project.name}: ${name}`, problem: false });
    } catch (error) {
      console.warn("Backup failed", error);
      setArchiveNote({ text: `The backup of ${project.name} couldn't be made. Try again.`, problem: true });
    }
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    setRestoring(true);
    setArchiveNote(null);
    try {
      const { restored, failed } = await importArchives(appRepository(), file, { decode: decodePicture });
      const done = restored.length === 1 && failed === 0 ? `Restored ${restored[0].name}` : `Restored ${restored.length} animation${restored.length === 1 ? "" : "s"}`;
      setArchiveNote(failed === 0
        ? { text: done, problem: false }
        : { text: `${done}. ${failed} couldn't be restored.`, problem: true });
    } catch (error) {
      if (!(error instanceof ArchiveError)) console.warn("Restore failed", error);
      setArchiveNote({ text: error instanceof ArchiveError ? error.message : "That backup couldn't be restored. Try again.", problem: true });
    } finally {
      setRestoring(false);
      if (picker.current) picker.current.value = "";   // the same file can be picked again
    }
  };

  const startNew = async () => {
    setCreating(true);
    router.push(`/studio?project=${await createSavedProject()}`);
  };

  const confirmDelete = async () => {
    const project = deleting;
    setDeleting(null);
    if (!project) return;
    await appRepository().deleteProject(project.id);
    forgetAnimation(project.id);   // what was remembered about it goes too
  };

  const coverUrl = (project: Project) => {
    const imageId = list?.coverOf[project.id];
    return imageId ? covers.url(imageId) : undefined;
  };
  // Every animation's card, for the real list or one of its copies.
  const cards = (copy: boolean) => list?.projects.map((project) => <ProjectCard key={project.id} copy={copy} project={project} coverUrl={coverUrl(project)} size={list.sizeOf[project.id] ?? 0} onDelete={() => setDeleting(project)} onBackUp={() => void backUp(project)} />);

  return (
    // The full-screen backdrop (the page colour and texture, projects.scss), with the page on it.
    <div className={`nsc-home-page${ready ? " is-ready" : ""}`} aria-busy={list === null}>
      <main ref={page} id="nsc--home">
        {/* Left, fixed: the title, the three buttons, and the small print. Right: the animations, scrolling on their own. */}
        <div className="home-side">
          <header className="masthead">
            {/* The title in cardboard letters, a word a row, put down like a stop-motion film (HomeTitle): STOP with a pause sign in a circle for its O, on blue like START; MOTION and the rest of STOP on white paper; START in white on blue. A click plays it again. */}
            {/* Round it, a big roundish burst: a thin ring of coloured paper in five pieces, each its own colour on its own piece of cardboard, lying a little apart (CardboardBurst, TITLE_BURST), put down a piece a frame. */}
            <CardboardBurst className="title-burst" {...TITLE_BURST.shape} shownPieces={piecesShown} style={{ "--burst-cards": TITLE_BURST.cards } as CSSProperties}>
            <HomeTitle play={ready} after={INTRO.total} slowAfter={INTRO.buttonsAt} onProgress={setAfter} label="Stop motion start">
              <span className="title-word is-white">
                <TitleCard order={0} className="base-1">S</TitleCard>
                <TitleCard order={1} className="base-3">T</TitleCard>
                <TitleCard order={2} className="base-4 is-symbol symbol-pause-o is-blue">{"⏸⃝"}</TitleCard>
                <TitleCard order={3} className="base-2">P</TitleCard>
              </span>
              <span className="title-word is-white">
                <TitleCard order={4} className="base-5 is-wide">M</TitleCard>
                <TitleCard order={5} className="base-7">O</TitleCard>
                <TitleCard order={6} className="base-6">T</TitleCard>
                <TitleCard order={7} className="base-9">I</TitleCard>
                <TitleCard order={8} className="base-8">O</TitleCard>
                <TitleCard order={9} className="base-10">N</TitleCard>
              </span>
              {/* START: white letters on blue. */}
              <span className="title-word is-blue">
                <TitleCard order={10} className="base-3">S</TitleCard>
                <TitleCard order={11} className="base-6">T</TitleCard>
                <TitleCard order={12} className="base-9">A</TitleCard>
                <TitleCard order={13} className="base-1">R</TitleCard>
                <TitleCard order={14} className="base-7">T</TitleCard>
              </span>
            </HomeTitle>
            </CardboardBurst>
            {/* Side by side, below the title: a new animation (green, the main one), one loaded from a backup file, and the settings (icons only; their names in a tooltip and for screen readers). */}
            <div className="ctas">
              <button type="button" className="icon-button is-go new-button" style={buttonStyle(0)} aria-label="New animation" onClick={startNew} disabled={creating}><Plus size={42} strokeWidth={3.5} />NEW</button>
              <button type="button" className="icon-button" style={buttonStyle(1)} aria-label={restoring ? "Loading the backup…" : "Load project"} title="Open .zip project" onClick={() => picker.current?.click()} disabled={restoring} aria-busy={restoring}><ArchiveRestore size={36} /></button>
              <button type="button" className="icon-button" style={buttonStyle(2)} aria-label="Settings" title="Settings: storage on this device" onClick={() => setSettingsOpen(true)}><Settings size={36} /></button>
            </div>
            <input ref={picker} type="file" accept=".zip,application/zip" hidden aria-label="Backup file" onChange={(event) => void restore(event.currentTarget.files?.[0])} />
            {archiveNote && <p className={`archive-note${archiveNote.problem ? " is-problem" : ""}`} role="status">{archiveNote.text}</p>}
          </header>

          <footer className="home-footer">
            {list && <StorageWarning version={list.projects} />}
          </footer>
        </div>

        <div ref={column} className="home-projects" style={{ "--slide": slide } as CSSProperties}>
          {list === null && waited && <p className="status">Loading your animations…</p>}

          {list?.projects.length === 0 && (
            <div className="empty">
              <Clapperboard size={48} aria-hidden="true" />
              <p>No animations yet. Press <strong>New animation</strong> to make your first one.</p>
            </div>
          )}

          {list && list.projects.length > 0 && (
            <section className="project-list" aria-label="Your animations">
              {/* The copies can be clicked like the real cards, but screen readers and the keyboard meet each animation once, in the real list. */}
              {copyLists()}
              <ul ref={realList} className="projects">
                {cards(false)}
              </ul>
              {copyLists()}
            </section>
          )}
        </div>

        <SettingsDialog open={settingsOpen} version={list?.projects} animations={list?.projects.length ?? 0} onClose={() => setSettingsOpen(false)} />
        <DeleteDialog project={deleting} coverUrl={deleting ? coverUrl(deleting) : undefined} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />
      </main>

    </div>
  );
}

// The page shows all at once, once the animations are listed (with their covers), and fades in,
// instead of "Loading…" flashing up and the cards popping in after it. A slow list shows the
// page anyway after SHOW_AFTER ms, saying it's loading.
const SHOW_AFTER = 1500;

// The animations' column sliding up into place at the end of the intro: how far below its place it
// is (1: a whole window below, out of sight) before its frames and after each one, slowing as it
// arrives. A frame each, in jumps (stop motion, no easing in between).
const SLIDE = [1, 0.75, 0.5, 0.25, 0];   // 4 jumps, each as far as the others

// The burst round the title: its shape, and its width in title cards' heights (--size), which keeps
// the title inside its valleys whatever the cards' size. The two go together: deeper valleys, more
// spikes or a narrower shape leave less room in the middle, so the width has to grow with them
// (the widest row, MOTION, is about 5 card heights wide; the title, 3 rows, about 3.5 high).
const TITLE_BURST = {
  // Five pieces lying a little apart, a colour each (red, green, blue, yellow, purple), each its own
  // piece of cardboard under its paper, its cut edge thicker on the sides facing down.
  shape: { width: 700, height: 560, spikes: 11, depth: 0.3, seed: 7, paint: ["#d9302a", "#2a9d4a", "#1e6fd0", "#f2c12e", "#8a3fd0"], paintInset: 26, paintWidth: 12, edge: 8, margin: 0, paperReach: 0.4, pieces: 5, spread: 23 },   // the paper up to the corrugated rim, as on the page's other pieces;   // the ring 26 in from the edge: pushed out, the pieces and their cardboard end at the box
  cards: 10,   // a card wider than with paper alone: the ring sits further in, to leave room for the pieces' cardboard
};

// The intro after the title's cards, frame by frame: the burst's pieces, the three buttons, then the
// animations' column sliding up (SLIDE); the buttons' and the slide's frames slower. Where the buttons and the slide start
// among those frames, and how many there are in all.
const INTRO = {
  buttonsAt: TITLE_BURST.shape.pieces,
  slideAt: TITLE_BURST.shape.pieces + 3,
  total: TITLE_BURST.shape.pieces + 3 + (SLIDE.length - 1),
};

const HIDDEN: CSSProperties = { visibility: "hidden" };   // not put down yet (it keeps its room)

function useWaited(ms: number): boolean {
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return waited;
}
