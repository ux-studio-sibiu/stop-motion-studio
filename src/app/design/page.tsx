import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignPage } from "@/design-system/DesignPage";

// The design system page (Part 8b): every UI element the studio uses, in a gallery. A tool for
// development: the build leaves it out (a 404 there). Everything it is lives in src/design-system/.
export const metadata: Metadata = { title: "Design system · Stop-motion Studio" };

export default function Design() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignPage />;
}
