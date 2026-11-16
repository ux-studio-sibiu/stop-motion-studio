import { Camera, CameraOff, RotateCcw } from "lucide-react";
import type { Camera as CameraState } from "./useCamera";

// What the stage says when there's no live picture, in words a child (or the grown-up
// helping) can act on, with the one button that helps.
// `more`: there are pictures already (the message sits over one on the stage).
export function CameraMessage({ camera, more = false }: { camera: CameraState; more?: boolean }) {
  const retry = <button type="button" className="icon-button" onClick={camera.start}><RotateCcw size={24} />Try again</button>;

  switch (camera.status) {
    case "idle":
      return (
        <div className="camera-message">
          <Camera size={48} />
          <p>{more ? "Turn on the camera to take more pictures." : "Turn on the camera to start taking pictures."}</p>
          <button type="button" className="icon-button is-primary" onClick={camera.start}><Camera size={24} />Turn on camera</button>
        </div>
      );
    case "asking":
      return <div className="camera-message"><Camera size={48} /><p>When the browser asks, say yes to the camera.</p></div>;
    case "denied":
      return <div className="camera-message"><CameraOff size={48} /><p>The camera is blocked. Ask a grown-up to allow it with the camera icon in the address bar, then try again.</p>{retry}</div>;
    case "no-camera":
      return <div className="camera-message"><CameraOff size={48} /><p>No camera found. Plug one in, then try again.</p>{retry}</div>;
    case "busy":
      return <div className="camera-message"><CameraOff size={48} /><p>Another app is using the camera. Close it, then try again.</p>{retry}</div>;
    case "insecure":
      return <div className="camera-message"><CameraOff size={48} /><p>The camera only works on a secure page: open the studio with https:// or on localhost.</p></div>;
    case "unsupported":
      return <div className="camera-message"><CameraOff size={48} /><p>This browser can&apos;t use a camera. Try a recent Chrome, Edge, Firefox or Safari.</p></div>;
    case "error":
      return <div className="camera-message"><CameraOff size={48} /><p>Something went wrong with the camera.</p>{retry}</div>;
    default:
      return null;
  }
}
