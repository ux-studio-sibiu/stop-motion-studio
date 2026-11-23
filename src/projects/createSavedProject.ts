import { appRepository } from "@/adapters/storage/appRepository";
import { requestPersistentStorage } from "@/adapters/storage/storageInfo";
import { createProject } from "@/core/model";
import { remembered } from "@/studio/remembered";

// Makes a new, empty project and saves it. Also asks the browser to keep the studio's data
// for good: the request happens while the child is starting something they'll care about, and
// it never waits for the answer (some browsers ask the user, some decide silently). A new animation
// opens on the Camera tab, whichever tab was open last (it starts with taking pictures).
export async function createSavedProject(): Promise<string> {
  const project = createProject();
  await appRepository().createProject(project);
  remembered.panelTab.save("camera");
  void requestPersistentStorage();
  return project.id;
}
