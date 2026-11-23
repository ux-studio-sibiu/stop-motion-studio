"use client";

import { Camera, Check, ChevronDown, ChevronLeft, CopyPlus, Download, Eraser, HardDrive, Image as ImageIcon, ImagePlus, Layers, Music, Pause, Pencil, Play, Redo2, RotateCcw, Shapes, Trash2, Undo2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { bubbleProps, createBubble, createProject, createShape, createText, SHAPE, shapeProps, SPEECH_BUBBLE, TEXT, textProps, withProps, type Project } from "@/core/model";
import { BubbleSettings } from "@/features/objects/BubbleSettings";
import { SettingsHeader } from "@/features/objects/ObjectSettings";
import { CameraPanel } from "@/features/camera/CameraPanel";
import { ProjectCard } from "@/projects/ProjectCard";
import { CaptureSoundToggle } from "@/features/camera/CaptureSoundToggle";
import { GifExportMenu } from "@/features/gif-export/GifExportMenu";
import { VideoExportButton } from "@/features/video-export/VideoExportButton";
import { ObjectTile } from "@/features/objects/ObjectTile";
import { ShapeSettings } from "@/features/objects/ShapeSettings";
import { TextSettings } from "@/features/objects/TextSettings";
import { ObjectIcon } from "@/studio/ObjectIcon";
import { DEFAULT_LAYERS } from "@/studio/remembered";
import { LayersMenu } from "@/studio/timeline/LayersMenu";
import { PanelTab, SidePanel } from "@/studio/SidePanel";
import type { Camera as CameraState } from "@/studio/useCamera";
import { FILLS, INKS, Swatches } from "@/studio/Swatches";
import { colourAction, cursorFor, useCopyKeys } from "./colourCopy";
import { Section, Specimen, TokenSpecimen } from "./Specimen";
import { TokenPanel } from "./TokenPanel";
import { TOKEN_GROUPS, tokensIn } from "./tokens";
import { TokenValues, useTokenTweaks } from "./tweaks";
// The studio's own styles, so every specimen looks exactly as it does in the studio.
import "@/studio/studio.scss";
import "@/features/camera/_camera.scss";
import "@/features/picture/_picture.scss";
import "@/features/onion-skin/_onion-skin.scss";
import "@/features/objects/_objects.scss";
import "@/features/draw/_draw.scss";
import "@/projects/projects.scss";
import "./_design.scss";

// The design system page (Part 8b, D1): every UI element the studio uses, as a gallery to look at,
// with nothing that does anything. Stand-alone: it uses no store, storage or camera. Specimens are
// the real components where those take only props (the side panel, swatches, tiles, the settings
// of each kind of object), and otherwise the same markup and class names as the component, so
// every style is the studio's own. Sections are placed by hand, one after another: moving or
// adding a specimen is moving or adding a line.

const nothing = () => {};

// A sample animation and its cover, for the project card specimen (a fixed id and date, so the
// page renders the same on the server and in the browser).
const SAMPLE_PROJECT: Project = { ...createProject({ name: "My animation", now: Date.UTC(2026, 10, 17, 12) }), id: "sample", frameIds: Array.from({ length: 24 }, (_, i) => `sample-${i}`) };
const SAMPLE_COVER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#d9d4cb"/><rect y="62" width="160" height="28" fill="#b9b2a6"/><circle cx="70" cy="34" r="9" fill="#a27b55"/><rect x="62" y="43" width="16" height="22" rx="5" fill="#a27b55"/><circle cx="120" cy="22" r="8" fill="#f2c94c"/></svg>')}`;
// A live camera with a choice of two, for the Camera tab specimen (no real camera on this page).
const TWO_CAMERAS: CameraState = {
  status: "live", settled: true, stream: null, deviceId: "usb", start: nothing, stop: nothing, selectDevice: nothing,
  devices: [{ deviceId: "laptop", label: "Integrated Camera" }, { deviceId: "usb", label: "HD Pro Webcam C920" }].map((device) => ({ ...device, kind: "videoinput", groupId: "", toJSON: () => device }) as MediaDeviceInfo),
};

// Stand-ins for photos: plain colours, so nothing needs a picture.
const PHOTOS = ["#b4553c", "#c09a3a", "#5f9a3c", "#3c8f9a", "#3c4f9a"];
const photo = (index: number): CSSProperties => ({ background: `linear-gradient(135deg, ${PHOTOS[index % PHOTOS.length]}, color-mix(in srgb, ${PHOTOS[index % PHOTOS.length]} 55%, #000))` });

export function DesignPage() {
  const tokens = useTokenTweaks();
  // Copying colours between tokens (colourCopy.ts): Alt+click copies, Ctrl+Alt+click pastes, on the
  // token board here and in the panel; a note says what happened.
  const keys = useCopyKeys();
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const noteTimer = useRef(0);
  const colourClick = (event: MouseEvent, name: string): string | null => {
    const action = colourAction(event, name, tokens.values[name] ?? "", copied);
    if (action.kind === "none") return null;
    event.preventDefault();
    event.stopPropagation();
    if (action.kind === "copy") setCopied(action.value);
    if (action.kind === "paste") tokens.set(name, action.value);
    return action.message;
  };
  const say = (text: string) => { setNote(text); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(""), 2200); };
  const onBoardClick = (event: MouseEvent) => {
    const name = (event.target as Element).closest<HTMLElement>("[data-colour-token]")?.dataset.colourToken;
    const message = name ? colourClick(event, name) : null;
    if (message) say(message);
  };
  const copyCursor = cursorFor(keys, copied);
  return (
    <TokenValues.Provider value={tokens.values}>
    <TokenPanel {...tokens} onColourClick={colourClick} colourCursor={copyCursor} />
    <main className="nsc-design" onClickCapture={onBoardClick} style={copyCursor ? ({ "--ds-copy-cursor": copyCursor } as CSSProperties) : undefined}>
      {note && <p className="ds-copy-note" role="status">{note}</p>}
      <header className="ds-masthead">
        <p className="ds-eyebrow">Stop-motion Studio</p>
        <h1>Design system</h1>
        <p className="ds-lede">Every part of the studio&apos;s interface, as it looks in the studio, in one place. Nothing here does anything. Tune the design tokens in the floating panel (Shift+T): everything follows. Alt+click a colour token to copy it, Ctrl+Alt+click another to paste it there.</p>
        <nav className="ds-contents" aria-label="Sections">
          {[["tokens", "Tokens"], ["words", "Words"], ["controls", "Controls"], ["panel", "Side panel"], ["objects", "Objects"], ["stage", "Stage"], ["timeline", "Timeline"], ["bars", "Bars and menus"], ["projects", "Projects"]].map(([id, name]) => <a key={id} href={`#${id}`}>{name}</a>)}
        </nav>
      </header>

      <Section id="tokens" title="Tokens" intro="Every design token in globals.scss and _colours.scss (src/design-system/tokens.ts), by family. Hover or focus one for its value and what it's for.">
        <Specimen label="All tokens" note="light or dark, whichever shows; tweaked in the panel" wide board>
          <div className="ds-token-board">
            {TOKEN_GROUPS.map((group) => (
              <div key={group} className="ds-token-group" role="group" aria-label={`${group} tokens`}>
                <h3>{group}</h3>
                {tokensIn(group).map((token) => <TokenSpecimen key={token.name} token={token} />)}
              </div>
            ))}
          </div>
        </Specimen>
      </Section>

      <Section id="words" title="Words" intro="As few words and labels as possible: children read slowly, or not yet. Say it once, in the control itself, and let icons, colours and pictures do the rest.">
        <Specimen label="Do" note="the value says what it is: no label over a dropdown">
          <ul className="ds-rules is-do">
            <li><Check size={16} aria-hidden="true" /><span>Put the meaning in the value: <b>Large text</b>, <b>Font: Rounded</b>, <b>Spiked bubble</b>, <b>Outline: thick</b>.</span></li>
            <li><Check size={16} aria-hidden="true" /><span>Name only what can&apos;t name itself: a row of colours (<b>Bubble colour</b>), a tick box (<b>Tail</b>).</span></li>
            <li><Check size={16} aria-hidden="true" /><span>An icon button gets a tooltip and a screen-reader name, not a word beside it.</span></li>
            <li><Check size={16} aria-hidden="true" /><span>A slider for a few steps of one thing (outline: none to thick), its value in words above it.</span></li>
            <li><Check size={16} aria-hidden="true" /><span>Every control still has a name for screen readers (aria-label), even when none shows.</span></li>
          </ul>
        </Specimen>
        <Specimen label="Don't" note="words that repeat what's already on screen">
          <ul className="ds-rules is-dont">
            <li><X size={16} aria-hidden="true" /><span>A label over a dropdown that already shows its value (<b>Text size</b> over <b>Large</b>).</span></li>
            <li><X size={16} aria-hidden="true" /><span>A label on a text box: what you type in it is the label (a placeholder is enough).</span></li>
            <li><X size={16} aria-hidden="true" /><span>A sentence where a word does, or a word where an icon does.</span></li>
            <li><X size={16} aria-hidden="true" /><span>Repeating the group&apos;s heading in each control under it.</span></li>
          </ul>
        </Specimen>
      </Section>

      <Section id="controls" title="Controls">
        <Specimen label="Icon buttons" note="normal, on, disabled, primary, go, danger" studio>
          <div className="ds-row">
            <button type="button" className="icon-button"><Undo2 size={24} /></button>
            <button type="button" className="icon-button"><Download size={24} /><span>Save as GIF</span></button>
            <button type="button" className="icon-button is-on"><Layers size={24} /><span>On</span></button>
            <button type="button" className="icon-button" disabled><Redo2 size={24} /></button>
            <button type="button" className="icon-button is-primary"><Camera size={24} />Turn on camera</button>
            <button type="button" className="icon-button is-go"><Play size={24} />Play</button>
            <button type="button" className="icon-button is-danger"><Trash2 size={20} /><span>Delete</span></button>
          </div>
        </Specimen>
        <Specimen label="Small icon buttons" note="the timeline's tools, menus" studio>
          <div className="ds-row">
            <button type="button" className="icon-button is-small"><ZoomOut size={20} /></button>
            <button type="button" className="icon-button is-small"><ZoomIn size={20} /></button>
            <button type="button" className="icon-button is-small"><CopyPlus size={20} /></button>
            <button type="button" className="icon-button is-small is-on">2</button>
            <button type="button" className="icon-button is-small is-danger"><Trash2 size={18} /><span>Clear drawing</span></button>
          </div>
        </Specimen>
        <Specimen label="Split buttons" note="option-menu: a main button joined to the arrow that opens its options; plain, filled (is-go), playing (is-primary, the stop look), off and on" studio>
          <div className="ds-row">
            <div className="nsc-playback-options option-menu">
              <button type="button" className="icon-button toggle play"><Play size={24} /><span className="play-label"><span>Play</span><span className="is-hidden">Pause</span></span></button>
              <button type="button" className="icon-button more" aria-label="Playback options"><ChevronDown size={20} /></button>
            </div>
            <div className="nsc-playback-options option-menu">
              <button type="button" className="icon-button toggle play is-go"><Play size={24} /><span className="play-label"><span>Play</span><span className="is-hidden">Pause</span></span></button>
              <button type="button" className="icon-button more is-go" aria-label="Playback options, filled"><ChevronDown size={20} /></button>
            </div>
            <div className="nsc-playback-options option-menu">
              <button type="button" className="icon-button toggle play is-primary"><Pause size={24} /><span className="play-label"><span className="is-hidden">Play</span><span>Pause</span></span></button>
              <button type="button" className="icon-button more is-primary" aria-label="Playback options, playing"><ChevronDown size={20} /></button>
            </div>
            <div className="nsc-see-through option-menu">
              <button type="button" className="icon-button toggle"><Layers size={24} /><span>See-through</span></button>
              <button type="button" className="icon-button more" aria-label="See-through options"><ChevronDown size={20} /></button>
            </div>
            <div className="nsc-see-through option-menu">
              <button type="button" className="icon-button toggle is-on" aria-pressed="true"><Layers size={24} /><span>See-through</span></button>
              <button type="button" className="icon-button more is-on" aria-label="See-through options, on"><ChevronDown size={20} /></button>
            </div>
          </div>
        </Specimen>
        <Specimen label="Capture button" note="big-button is-capture" studio>
          <div className="camera-controls ds-capture">
            <div className="capture-area">
              <button type="button" className="big-button is-capture" aria-label="Take a picture"><Camera size={40} /></button>
              <p className="picture-count">12 pictures</p>
            </div>
          </div>
        </Specimen>
        <Specimen label="Fields" note="select, text, checkbox, radio, slider: one border for all" studio>
          <div className="nsc-side-panel ds-loose"><div>
            <div className="ds-stack">
              <label className="field"><span>Shape</span><select defaultValue="speech"><option value="speech">Speech</option><option>Thought</option></select></label>
              <label className="field"><span>Text</span><textarea rows={2} defaultValue="Hello!" /></label>
              <label className="check"><input type="checkbox" defaultChecked /><span>Tail</span></label>
              <label className="check"><input type="checkbox" /><span>Off</span></label>
              <div className="ds-row">
                <label className="check"><input type="radio" name="ds-radio" defaultChecked /><span>One</span></label>
                <label className="check"><input type="radio" name="ds-radio" /><span>Other</span></label>
              </div>
              <div className="adjust-controls ds-flat">
                <label className="slider"><span>Brightness: 120%</span><input type="range" min={0} max={200} defaultValue={120} /></label>
              </div>
            </div>
          </div></div>
        </Specimen>
        <Specimen label="Colour swatches" note="with and without None" studio>
          <div className="nsc-side-panel ds-loose">
            <div className="ds-stack">
              <Swatches label="Text colour" colours={INKS} value={INKS[2][0]} onPick={nothing} />
              <Swatches label="Background colour" colours={FILLS} value="none" none onPick={nothing} />
            </div>
          </div>
        </Specimen>
        <Specimen label="Pencil widths and tools" note="the Draw tab" studio>
          <div className="nsc-draw-panel">
            <div className="tools">
              <button type="button" className="icon-button is-on" aria-pressed="true"><Pencil size={22} /><span>Pencil</span></button>
              <button type="button" className="icon-button"><Eraser size={22} /><span>Eraser</span></button>
            </div>
            <div className="widths">
              {[4, 8, 14, 22].map((size, i) => <button key={size} type="button" className={`width${i === 1 ? " is-on" : ""}`} aria-label={`${size} px`}><span className="dot" style={{ width: size, height: size, background: "#d62828" }} /></button>)}
            </div>
          </div>
        </Specimen>
      </Section>

      <Section id="panel" title="Side panel" intro="The tabs stick out of the panel's left edge: the open one joins it, the others are pushed back behind it.">
        <Specimen label="Side panel with its tabs" note="the real SidePanel, with the Picture tab open" wide studio>
          <div className="ds-panel-frame">
            <SidePanel active="picture" onChange={nothing}>
              <PanelTab id="camera" label="Camera" icon={<Camera size={31} />}><p className="placeholder">The camera&apos;s tab.</p></PanelTab>
              <PanelTab id="picture" label="Picture" title="Adjust your picture" icon={<ImageIcon size={31} />}>
                <div className="picture-controls">
                  <div className="fields">
                    <label className="number-field"><span>Left / right</span><span className="input"><input type="number" defaultValue={0} /><span>px</span></span></label>
                    <label className="number-field"><span>Size</span><span className="input"><input type="number" defaultValue={109} /><span>%</span></span></label>
                  </div>
                  <div className="buttons"><button type="button" className="icon-button is-small"><RotateCcw size={20} /><span>Reset</span></button></div>
                </div>
                <div className="adjust-controls">
                  <label className="slider"><span>Brightness: 100%</span><input type="range" min={0} max={200} defaultValue={100} /></label>
                  <label className="slider"><span>Contrast: 100%</span><input type="range" min={0} max={200} defaultValue={100} /></label>
                </div>
                <p className="hint">A line of help in muted text.</p>
              </PanelTab>
              <PanelTab id="objects" label="Objects" icon={<Shapes size={31} />}><p className="placeholder">Objects.</p></PanelTab>
              <PanelTab id="draw" label="Draw" icon={<Pencil size={31} />}><p className="placeholder">Drawing.</p></PanelTab>
            </SidePanel>
          </div>
        </Specimen>
        <Specimen label="Scrollbar" note="the browser's own, inside the side panel's rounded corners" studio>
          <div className="nsc-side-panel ds-scroller">
            <section className="panel">
              <h2 className="panel-title">A long tab</h2>
              {Array.from({ length: 12 }, (_, i) => <p key={i} className="hint">Line {i + 1} of a tab long enough to scroll.</p>)}
            </section>
          </div>
        </Specimen>
      </Section>

      <Section id="objects" title="Objects" intro="The Objects tab: icons to drag onto the picture. A picked object's settings float by it (ObjectFloat), with no labels but the colour rows'.">
        <Specimen label="Object tiles" studio>
          <div className="nsc-objects-panel">
            <div className="tiles">
              <ObjectTile label="Speech bubble" icon={<ObjectIcon kind={SPEECH_BUBBLE} size={30} />} onPlace={nothing} />
              <ObjectTile label="Text" icon={<ObjectIcon kind={TEXT} size={30} />} onPlace={nothing} />
              <ObjectTile label="Shape" icon={<ObjectIcon kind={SHAPE} size={30} />} onPlace={nothing} />
              <ObjectTile label="Disabled" icon={<ObjectIcon kind={SHAPE} size={30} />} disabled onPlace={nothing} />
            </div>
          </div>
        </Specimen>
        <Specimen label="Speech bubble settings" note="the real BubbleSettings, in the floating panel" wide studio>
          <FloatCard name="Speech bubble">
            <BubbleSettings props={bubbleProps(withProps(createBubble(), { text: "Hello!" }))} set={nothing} type={nothing} />
          </FloatCard>
        </Specimen>
        <Specimen label="Text settings" wide studio>
          <FloatCard name="Text">
            <TextSettings props={textProps(createText("THE END"))} set={nothing} type={nothing} />
          </FloatCard>
        </Specimen>
        <Specimen label="Shape settings" wide studio>
          <FloatCard name="Arrow">
            <ShapeSettings props={shapeProps(createShape("arrow"))} set={nothing} type={nothing} />
          </FloatCard>
        </Specimen>
      </Section>

      <Section id="stage" title="Stage">
        <Specimen label="The stage, with a picked object" note="stage frame, safe zone, object handles" wide studio>
          <main className="stage ds-stage-box">
            <div className="stage-frame">
              <div className="ds-picture" style={photo(1)} />
              <svg className="safe-zone" viewBox="0 0 1280 720" preserveAspectRatio="none" aria-hidden="true">
                <path className="veil" fillRule="evenodd" d="M0 0h1280v720h-1280z M20 20v680h1240v-680z" />
                <rect className="edge" x={20} y={20} width={1240} height={680} />
              </svg>
              <div className="nsc-object-editor">
                <svg viewBox="0 0 1280 720" preserveAspectRatio="none" aria-hidden="true">
                  <polygon className="object is-selected" points="384,58 896,58 896,230 384,230" />
                  <g className="handles">
                    {[[384, 58], [896, 58], [896, 230], [384, 230]].map(([x, y], i) => <circle key={i} className="corner" cx={x} cy={y} r={14} />)}
                    <line className="stem" x1={640} y1={58} x2={640} y2={15} />
                    <circle className="turn" cx={640} cy={15} r={18} />
                    <circle className="tail" cx={512} cy={310} r={14} />
                  </g>
                </svg>
              </div>
            </div>
          </main>
        </Specimen>
        <Specimen label="Camera message" note="the stage while the camera is off" studio>
          <main className="stage ds-stage-box is-small">
            <div className="stage-frame">
              <div className="camera-message">
                <Camera size={48} />
                <p>Turn on the camera to start taking pictures.</p>
                <button type="button" className="icon-button is-primary"><Camera size={24} />Turn on camera</button>
              </div>
            </div>
          </main>
        </Specimen>
      </Section>

      <Section id="timeline" title="Timeline">
        <Specimen label="The timeline" note="tools (the real Layers menu first, zoom, undo and redo), ruler, pictures (selected, on the stage, long), the grip, objects in time, sounds" wide studio>
          <section className="timeline ds-timeline">
            <div className="timeline-tools">
              <LayersMenu layers={DEFAULT_LAYERS} onChange={nothing} />
              <span className="tools-gap" />
              <button type="button" className="icon-button is-small"><ZoomOut size={20} /></button>
              <button type="button" className="icon-button is-small"><ZoomIn size={20} /></button>
              <span className="tools-gap" />
              <button type="button" className="icon-button is-small" aria-label="Undo"><Undo2 size={20} /></button>
              <button type="button" className="icon-button is-small" aria-label="Redo"><Redo2 size={20} /></button>
              <span className="tools-gap" />
              <button type="button" className="icon-button is-small"><CopyPlus size={20} /></button>
              <button type="button" className="icon-button is-small"><ImagePlus size={20} /></button>
              <button type="button" className="icon-button is-small"><Trash2 size={20} /></button>
            </div>
            <div className="timeline-scroll">
              <div className="ruler" style={{ width: 640, backgroundSize: "160px 100%" }}>
                {[0, 1, 2, 3].map((at) => <span key={at} className="ruler-label" style={{ left: at * 160 }}>{at}s</span>)}
              </div>
              <ol className="track" style={{ "--thumb-ratio": "16 / 9" } as CSSProperties}>
                <TimelinePicture number={1} width={80} index={0} />
                <TimelinePicture number={2} width={200} index={1} selected grip="1.25 s" />
                <TimelinePicture number={3} width={60} index={2} onStage />
                <TimelinePicture number={4} width={40} index={3} />
                <li className="next-slot" aria-hidden="true"><Camera size={24} /></li>
              </ol>
              <div className="overlay-track" style={{ width: 640, "--lanes": 2 } as CSSProperties}>
                <OverlayBar left={0} width={240} lane={0} kind={TEXT} text="Once upon a time" />
                <OverlayBar left={120} width={220} lane={1} kind={SHAPE} text="arrow" selected />
              </div>
              <div className="sound-track" style={{ width: 640, "--lanes": 1 } as CSSProperties}>
                <div className="sound-bar" style={{ left: 40, width: 120, "--lane": 0 } as CSSProperties}><span className="bar-label"><Music size={14} /><span>Boing</span></span></div>
                <div className="sound-bar is-selected" style={{ left: 300, width: 80, "--lane": 0 } as CSSProperties}><span className="bar-label"><Music size={14} /><span>Pop</span></span></div>
              </div>
            </div>
          </section>
        </Specimen>
      </Section>

      <Section id="bars" title="Bars and menus">
        <Specimen label="Toolbar" wide studio>
          <header className="toolbar">
            <a className="icon-button" href="#bars" aria-label="All projects"><ChevronLeft size={24} /></a>
            <h1 className="project-name">My animation</h1>
            <div className="toolbar-actions">
              <button type="button" className="icon-button" aria-label="Undo"><Undo2 size={24} /></button>
              <button type="button" className="icon-button" aria-label="Redo" disabled><Redo2 size={24} /></button>
              <GifExportMenu />
              <VideoExportButton />
            </div>
          </header>
        </Specimen>
        <Specimen label="Playback bar, a menu open" note="Play, its options, see-through" wide studio>
          <div className="ds-menu-room">
            <footer className="playback-bar">
              <div className="nsc-playback-options option-menu">
                <button type="button" className="icon-button toggle play is-go"><Play size={24} /><span className="play-label"><span>Play</span><span className="is-hidden">Pause</span></span></button>
                <button type="button" className="icon-button more is-go" aria-expanded="true"><ChevronDown size={20} /></button>
                <div className="options" role="group" aria-label="Playback options">
                  <label className="option"><span>Speed</span><span className="range-ends"><span>Slow</span><input type="range" min={0} max={5} defaultValue={2} /><span>Fast</span></span></label>
                  <label className="option is-check"><input type="checkbox" defaultChecked /><span>Loop</span></label>
                  <label className="option"><span>Safe zone: 20 px</span><input type="range" min={0} max={60} defaultValue={20} /></label>
                </div>
              </div>
              <div className="nsc-see-through option-menu">
                <button type="button" className="icon-button toggle is-on"><Layers size={24} /><span className="desktop-only">See-through</span></button>
                <button type="button" className="icon-button more is-on"><ChevronDown size={20} /></button>
              </div>
            </footer>
          </div>
        </Specimen>
        <Specimen label="Storage notice" note="almost full, and full" wide studio>
          <div className="ds-stack">
            <div className="nsc-storage-notice ds-inline" role="status"><HardDrive size={22} /><p><strong>This device is almost full.</strong> Delete animations you don&apos;t need to make room for more pictures.</p><button type="button" className="icon-button is-small" aria-label="Close message"><X size={18} /></button></div>
            <div className="nsc-storage-notice is-full ds-inline" role="status"><HardDrive size={22} /><p><strong>There&apos;s no room left on this device.</strong> That wasn&apos;t saved.</p><button type="button" className="icon-button is-small" aria-label="Close message"><X size={18} /></button></div>
          </div>
        </Specimen>
        <Specimen label="Camera tab" note="the real CameraPanel, with two cameras: on/off, and the arrow lists them; the capture sound above them" studio>
          <div className="nsc-side-panel ds-loose ds-camera-tab"><CameraPanel camera={TWO_CAMERAS} canCapture onCapture={nothing} capturing={false}><CaptureSoundToggle on onChange={nothing} /></CameraPanel></div>
        </Specimen>
      </Section>

      <Section id="projects" title="Projects">
        <Specimen label="A project card" note="the real ProjectCard: the cover across the top, name, details, actions; the controls' line and --shadow-card">
          <ul className="ds-cards">
            <ProjectCard project={SAMPLE_PROJECT} coverUrl={SAMPLE_COVER} size={3_250_000} onDelete={nothing} onBackUp={nothing} />
            <ProjectCard project={{ ...SAMPLE_PROJECT, id: "sample-empty", name: "A new one", frameIds: [] }} size={0} onDelete={nothing} onBackUp={nothing} />
          </ul>
        </Specimen>
      </Section>
    </main>
    </TokenValues.Provider>
  );
}

// The floating object settings panel as ObjectSettings draws it (that one needs an open animation),
// with its real header, in place on the page instead of fixed by an object.
function FloatCard({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="nsc-object-float ds-in-place">
      <section className="settings" aria-label={`${name} settings`}>
        <SettingsHeader name={name} />
        {children}
      </section>
    </div>
  );
}

// A picture on the timeline, as TimelineFrame draws it (its thumbnail is a plain colour here).
function TimelinePicture({ number, width, index, selected = false, onStage = false, grip }: { number: number; width: number; index: number; selected?: boolean; onStage?: boolean; grip?: string }) {
  return (
    <li role="option" aria-selected={selected} aria-label={`Picture ${number}`} className={`frame${selected ? " is-selected" : ""}${onStage ? " is-on-stage" : ""}`} style={{ width }}>
      <span className="picture">
        <span className="thumb"><span className="view"><span className="photo" style={photo(index)} /></span></span>
        {width >= 24 && <span className="frame-number">{number}</span>}
      </span>
      {selected && <span className="grip" aria-hidden="true" />}
      {grip && <span className="hold-bubble">{grip}</span>}
    </li>
  );
}

// A bar on the overlay track, as OverlayTrack draws it.
function OverlayBar({ left, width, lane, kind, text, selected = false }: { left: number; width: number; lane: number; kind: string; text: string; selected?: boolean }) {
  return (
    <div className={`overlay-bar${selected ? " is-selected" : ""}`} style={{ left, width, "--lane": lane } as CSSProperties}>
      <span className="edge is-start" />
      <span className="bar-label"><ObjectIcon kind={kind} size={14} /><span>{text}</span></span>
      <span className="edge is-end" />
    </div>
  );
}
