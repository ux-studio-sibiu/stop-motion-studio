"use client";

import { CircleHelp, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { isTextEntry } from "./keyboard";

// The toolbar's Help button (instead of roadmap step 30): a window with how to make an animation
// and every keyboard shortcut the studio has. `?` opens it too (unless typing); Escape, the cross or
// a click outside closes it. A modal <dialog>: it keeps the keyboard inside while open and is
// announced as a dialog. When a shortcut changes in the code, change it here too.
export function HelpButton() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey || isTextEntry(event.target)) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button type="button" className="icon-button" aria-label="Help" title="How to use the studio, and its keys (?)" aria-haspopup="dialog" onClick={() => setOpen(true)}><CircleHelp size={28} /></button>
      <dialog ref={dialog} className="nsc-help" aria-labelledby="help-title" onCancel={(event) => { event.preventDefault(); setOpen(false); }} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <header className="help-header">
          <h2 id="help-title">How to use the studio</h2>
          <button type="button" className="icon-button is-small" aria-label="Close" onClick={() => setOpen(false)} autoFocus><X size={20} /></button>
        </header>

        <div className="help-body">
          <section aria-labelledby="help-steps">
            <h3 id="help-steps">Making an animation</h3>
            <ol className="help-steps">
              <li><strong>Take a picture</strong> in the Camera tab, or add photos from the computer with the picture-and-plus button on the timeline. The dashed box at the end of the timeline adds an <strong>empty picture</strong>: see-through (a checkerboard), for a title or a drawing.</li>
              <li><strong>Move your toys a little</strong>, then take the next one. See-through shows the picture before, faintly, to line them up.</li>
              <li><strong>Press Play</strong> to watch it. Make a picture last longer by dragging its right edge on the timeline.</li>
              <li><strong>Fix a picture</strong> in the Picture tab: move, size, turn it, or make it lighter.</li>
              <li><strong>Add things</strong>: speech bubbles, text and shapes from the Objects tab, drawings from the Draw tab, and sounds from the Sounds tab (drag them onto the stage or the timeline).</li>
              <li><strong>Save it</strong> as an MP4 or a GIF with Save, under the back arrow. Everything else is saved by itself.</li>
            </ol>
          </section>

          <Keys title="Anywhere in the studio">
            <Key keys={["Ctrl", "Z"]}>Undo</Key>
            <Key keys={["Ctrl", "Y"]} or={["Ctrl", "Shift", "Z"]}>Redo</Key>
            <Key keys={["Enter"]}>Play or pause</Key>
            <Key keys={["?"]}>This help</Key>
            <Key keys={["Esc"]}>Close a menu, or stop a drag</Key>
          </Keys>

          <Keys title="Camera tab">
            <Key keys={["Space"]} or={["Tab"]}>Take a picture (a presenter clicker&apos;s button works too); Tab from another tab, or with the camera off, turns it on first</Key>
          </Keys>

          <Keys title="Timeline">
            <Key keys={["←"]} or={["→"]}>Previous or next picture</Key>
            <Key keys={["Shift", "← →"]}>Select more pictures</Key>
            <Key keys={["Home"]} or={["End"]}>First or last picture</Key>
            <Key keys={["Ctrl", "A"]}>Select all pictures</Key>
            <Key keys={["Ctrl", "← →"]}>Move the selected pictures one place</Key>
            <Key keys={["["]} or={["]"]}>Make the selected pictures shorter or longer</Key>
            <Key keys={["Ctrl", "D"]}>Duplicate</Key>
            <Key keys={["Delete"]}>Delete</Key>
            <Key keys={["Ctrl", "wheel"]}>Zoom the timeline</Key>
          </Keys>

          <Keys title="Objects and Sound layers (a bar picked on the timeline)">
            <Key keys={["← →"]}>Move it in time</Key>
            <Key keys={["Shift", "← →"]}>Make an object show, or a sound play, for less or longer</Key>
            <Key keys={["Ctrl", "D"]}>Duplicate an object</Key>
            <Key keys={["Delete"]}>Delete it</Key>
            <Key keys={["Enter"]}>Pick it (and hear a sound)</Key>
          </Keys>

          <Keys title="Picture tab, on the stage">
            <Key keys={["← ↑ → ↓"]}>Nudge the picture (with Shift: 10 times as far)</Key>
            <Key keys={["+"]} or={["−"]}>Make it bigger or smaller</Key>
            <Key keys={["wheel"]}>Size it around the pointer (a trackpad pinch too)</Key>
            <Key keys={["Alt", "drag"]}>Move it without snapping to the edges</Key>
            <Key keys={["Esc"]}>Undo a change that isn&apos;t saved yet</Key>
          </Keys>

          <Keys title="Objects tab, on the stage">
            <Key keys={["← ↑ → ↓"]}>Nudge the picked object (with Shift: 10 times as far)</Key>
            <Key keys={["Enter"]}>Write in a bubble or text</Key>
            <Key keys={["Delete"]}>Delete the picked object</Key>
            <Key keys={["Ctrl", "C"]} or={["Ctrl", "V"]}>Copy it, and paste it on other pictures</Key>
            <Key keys={["Esc"]}>Let go of it</Key>
          </Keys>

          <Keys title="Side panel">
            <Key keys={["↑"]} or={["↓"]}>Next or previous tab, once a tab has the keyboard</Key>
          </Keys>

          <p className="help-note">On a Mac, use Cmd instead of Ctrl.</p>
        </div>
      </dialog>
    </>
  );
}

function Keys({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="help-keys" aria-label={title}>
      <h3>{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}

// One shortcut: its keys (pressed together), optionally another way, and what it does.
function Key({ keys, or, children }: { keys: string[]; or?: string[]; children: ReactNode }) {
  const combo = (list: string[]) => list.map((key, i) => <span key={key}>{i > 0 && "+"}<kbd>{key}</kbd></span>);
  return (
    <div className="help-key">
      <dt>{combo(keys)}{or && <> or {combo(or)}</>}</dt>
      <dd>{children}</dd>
    </div>
  );
}
