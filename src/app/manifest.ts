import type { MetadataRoute } from "next";

// The web app manifest (step 32): with it and the service worker, the studio can be installed
// like an app and opens in its own window. Written to out/manifest.webmanifest by the build.
// The icons are the favicon's bars (src/app/icon.svg) as PNGs, in public/icons/.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stop-motion Studio",
    short_name: "Stop-motion",
    description: "Make stop-motion animations with your webcam, right in the browser.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbf7f0",   // --color-bg (light)
    theme_color: "#fbf7f0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
