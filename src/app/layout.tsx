import type { Metadata } from "next";
import "@/styles/globals.scss";
import { OfflineSupport } from "@/offline/OfflineSupport";

// The app's font, Nunito, is self-hosted from public/fonts/nunito/ (src/styles/_fonts.scss): no
// request to Google at runtime, while building or while developing.

export const metadata: Metadata = {
  title: "Stop-motion Studio",
  description: "Make stop-motion animations with your webcam, right in the browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        {/* The font almost every page needs, fetched straight away instead of once the CSS asks for it. */}
        <link rel="preload" href="/fonts/nunito/nunito-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}<OfflineSupport /></body>
    </html>
  );
}
