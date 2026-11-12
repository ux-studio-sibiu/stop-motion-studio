import { Suspense } from "react";
import { Studio } from "@/studio/Studio";

// Server component shell. <Studio> reads ?project= with useSearchParams, which needs a
// Suspense boundary or the static export fails.
export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <Studio />
    </Suspense>
  );
}
