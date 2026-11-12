import type { NextConfig } from "next";

// Client-only app: `next build` writes a static site to `out/`, no server needed.
// cacheComponents / partialPrefetching (create-next-app defaults) are left out:
// they cache server-rendered data, and this app has none.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
