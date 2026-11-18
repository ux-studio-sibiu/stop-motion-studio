import type { NextConfig } from "next";

// Client-only app: `next build` writes a static site to `out/`, no server needed.
// cacheComponents / partialPrefetching (create-next-app defaults) are left out:
// they cache server-rendered data, and this app has none.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // The dev indicator ("N" badge) sat over the toolbar's last button (Save as GIF's arrow, step
  // 25) and caught its clicks. Off: Next.js still shows compile and runtime errors.
  devIndicators: false,
};

export default nextConfig;
