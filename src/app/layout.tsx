import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "@/styles/globals.scss";

// Rounded, very legible at large sizes. next/font self-hosts it, so no request to Google at runtime.
const nunito = Nunito({ subsets: ["latin"], variable: "--font-ui" });

export const metadata: Metadata = {
  title: "Stop-motion Studio",
  description: "Make stop-motion animations with your webcam, right in the browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={nunito.variable}>
      <body>{children}</body>
    </html>
  );
}
