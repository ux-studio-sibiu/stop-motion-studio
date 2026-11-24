import type { Metadata } from "next";
import { DesignPage } from "@/design-system/DesignPage";

// The design system page (Part 8b): every UI element the studio uses, in a gallery, with the token
// panel to try changes (kept in each visitor's own browser). Public on the live site too, linked
// from the home page's Settings. Everything it is lives in src/design-system/.
export const metadata: Metadata = { title: "Design system · Stop-motion Studio" };

export default function Design() {
  return <DesignPage />;
}
