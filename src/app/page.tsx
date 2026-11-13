import { ProjectsPage } from "@/projects/ProjectsPage";

// The projects live in this browser's IndexedDB, so the list is a client component; the
// static export ships an empty shell that fills in once the page runs.
export default function Home() {
  return <ProjectsPage />;
}
