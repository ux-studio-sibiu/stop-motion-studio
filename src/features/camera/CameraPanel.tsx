import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, ChevronDown, Crosshair, Power } from "lucide-react";
import type { ReactNode } from "react";
import { MAX_FRAMING_ZOOM, nudgeFraming, type Framing } from "@/core/render";
import { useEditor } from "@/store/useEditor";
import { useDropdown } from "@/studio/useDropdown";
import type { Camera as CameraState } from "@/studio/useCamera";
import "./_camera.scss";

// When the camera can't start: a short line under the on/off button. (The stage says it at
// length while there are no pictures yet.)
const PROBLEMS: Partial<Record<CameraState["status"], string>> = {
  denied: "The camera is blocked. Allow it in the address bar.",
  "no-camera": "No camera found.",
  busy: "Another app is using the camera.",
  insecure: "The camera needs https:// or localhost.",
  unsupported: "This browser can't use a camera.",
  error: "Something went wrong with the camera.",
};

// The Camera tab of the side panel: the capture button and how many pictures there are; at the
// bottom, on/off, joined to an arrow that lists the cameras when there's more than one (like
// See-through and its options). `children`: more settings, above the switch (the capture sound).
// Above them, the framing: a digital zoom and arrows that move the frame in the zoomed picture
// (`framing`, kept per animation so every picture matches), and the lock (`lock`: focus, exposure
// and white balance held, so the pictures don't flicker; only on cameras that can).
type Lock = { live: boolean; can: boolean; locked: boolean; setLocked: (locked: boolean) => void };
export function CameraPanel({ camera, canCapture, onCapture, capturing, framing, onFraming, lock, children }: { camera: CameraState; canCapture: boolean; onCapture: () => void; capturing: boolean; framing?: Framing; onFraming?: (framing: Framing) => void; lock?: Lock; children?: ReactNode }) {
  const live = camera.status === "live";
  const count = useEditor((state) => state.project?.frameIds.length ?? 0);
  // The list of cameras is fixed to the window, so the side panel's scrolling can't cut it off.
  const { open: choosing, toggle: toggleCameras, ref: menu, style: listAt } = useDropdown({ fixed: true });
  const many = camera.devices.length > 1;

  return (
    <div className="camera-controls">
      {/* The main thing, centred in the space there is. */}
      <div className="capture-area">
        <button type="button" className="big-button is-capture" aria-label="Take a picture" title="Take a picture (Space or Tab)" disabled={!canCapture} aria-busy={capturing} onClick={onCapture}><Camera size={40} /></button>
        <p className="picture-count" aria-live="polite">{count === 0 ? "No pictures yet" : count === 1 ? "1 picture" : `${count} pictures`}</p>
      </div>

      {framing && onFraming && <FramingControls framing={framing} onChange={onFraming} lock={lock} />}

      {/* The camera's settings, at the bottom. */}
      <div className="camera-settings">
        {PROBLEMS[camera.status] && <p className="camera-problem" role="status">{PROBLEMS[camera.status]}</p>}
        {children}
        <div ref={menu} className="nsc-camera-switch option-menu">
          <button type="button" className={`icon-button toggle${live ? " is-on" : ""}`} onClick={live ? camera.stop : camera.start} aria-pressed={live}><Power size={24} />{live ? "Turn camera off" : "Turn camera on"}</button>
          {many && <button type="button" className={`icon-button more${live ? " is-on" : ""}`} aria-label="Choose a camera" aria-expanded={choosing} aria-haspopup="true" onClick={toggleCameras}><ChevronDown size={20} /></button>}
          {many && choosing && (
            <div className="options" role="group" aria-label="Cameras" style={listAt}>
              {camera.devices.map((device, index) => {
                const on = device.deviceId === camera.deviceId;
                return <button key={device.deviceId} type="button" className={`icon-button camera-option${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => { toggleCameras(); camera.selectDevice(device.deviceId); }}>{device.label || `Camera ${index + 1}`}</button>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// The zoom (its value in words above the slider), the arrows round a button that centres the frame
// (only when zoomed: there's nothing to move otherwise), and the lock.
function FramingControls({ framing, onChange, lock }: { framing: Framing; onChange: (framing: Framing) => void; lock?: Lock }) {
  const zoomed = framing.zoom > 1;
  const nudge = (dx: number, dy: number) => onChange(nudgeFraming(framing, dx, dy));
  return (
    <div className="camera-framing">
      <label className="framing-zoom">
        <span>Zoom: {framing.zoom.toFixed(1)}×</span>
        <input type="range" min={1} max={MAX_FRAMING_ZOOM} step={0.1} value={framing.zoom} onChange={(event) => onChange({ ...framing, zoom: Number(event.target.value) })} />
      </label>
      <div className="framing-nudge" role="group" aria-label="Move the frame">
        <button type="button" className="icon-button is-small up" aria-label="Move the frame up" disabled={!zoomed} onClick={() => nudge(0, -1)}><ArrowUp size={18} /></button>
        <button type="button" className="icon-button is-small left" aria-label="Move the frame left" disabled={!zoomed} onClick={() => nudge(-1, 0)}><ArrowLeft size={18} /></button>
        <button type="button" className="icon-button is-small centre" aria-label="Centre the frame" disabled={!zoomed || (framing.x === 0 && framing.y === 0)} onClick={() => onChange({ ...framing, x: 0, y: 0 })}><Crosshair size={18} /></button>
        <button type="button" className="icon-button is-small right" aria-label="Move the frame right" disabled={!zoomed} onClick={() => nudge(1, 0)}><ArrowRight size={18} /></button>
        <button type="button" className="icon-button is-small down" aria-label="Move the frame down" disabled={!zoomed} onClick={() => nudge(0, 1)}><ArrowDown size={18} /></button>
      </div>
      {lock && (lock.can || !lock.live ? (
        <label className="framing-lock" title="Keep focus, brightness and colour as they are now, so the pictures don't flicker">
          <input type="checkbox" checked={lock.locked} disabled={!lock.can} onChange={(event) => lock.setLocked(event.target.checked)} />
          <span>Lock focus and light</span>
        </label>
      ) : <p className="lock-note">This camera can&apos;t lock its settings: keep the light steady.</p>)}
    </div>
  );
}
