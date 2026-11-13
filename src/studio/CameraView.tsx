"use client";

import { useEffect, useRef } from "react";

// The live picture. Not mirrored: what you see is exactly what a capture will be.
// `onVideo` hands the element to the studio once it has a first frame (so a capture has
// something to take), and null when it goes away. Some webcams take a moment after the
// stream starts before any frame arrives; until then the capture button stays off.
export function CameraView({ stream, onVideo }: { stream: MediaStream; onVideo: (element: HTMLVideoElement | null) => void }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = stream;

    const ready = () => { if (element.videoWidth > 0) onVideo(element); };
    ready();   // already has a frame (rare, but possible with a cached stream)
    element.addEventListener("loadeddata", ready);
    element.addEventListener("resize", ready);   // a frame size arriving or changing

    return () => {
      element.removeEventListener("loadeddata", ready);
      element.removeEventListener("resize", ready);
      element.srcObject = null;
      onVideo(null);
    };
  }, [stream, onVideo]);

  return <video ref={video} className="camera-video" autoPlay playsInline muted />;
}
