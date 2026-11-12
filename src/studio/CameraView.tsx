"use client";

import { useEffect, useRef } from "react";

// The live picture. Not mirrored: what you see is exactly what a capture will be.
export function CameraView({ stream }: { stream: MediaStream }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = stream;
    return () => { element.srcObject = null; };
  }, [stream]);

  return <video ref={video} className="camera-video" autoPlay playsInline muted />;
}
