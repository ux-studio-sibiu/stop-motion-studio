import Link from "next/link";
import { Clapperboard } from "lucide-react";
import "./home.scss";

// Placeholder home. Becomes the projects list in step 09.
export default function Home() {
  return (
    <main id="nsc--home">
      <h1>Stop-motion Studio</h1>
      <p className="lede">Take pictures, move your toys a little, take more pictures. Then press play.</p>
      <Link className="start" href="/studio"><Clapperboard size={32} />Start animating</Link>
      <p className="notes"><a href="steps/index.html">How it&apos;s built, step by step</a></p>
    </main>
  );
}
