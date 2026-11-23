import type { ProjectRepository } from "@/core/model";

// Cleaning up an animation's unused pictures safely (step 21), across tabs.
//
// Deleting a picture keeps its photo, so undo can bring it back. Those photos can only go once no
// undo history anywhere can still need them. Each studio holds a shared Web Lock on the animation
// it has open; the clean-up runs only when it can take the lock alone, so no other tab has that
// animation open (with its own undo history). It runs when the studio opens it (this tab's
// history is empty then) and again when the studio leaves it.
// Without Web Locks (very old browsers) it never cleans up: keeping a few photos too many is safe,
// deleting one an undo still needs isn't.

const lockName = (projectId: string) => `stop-motion-studio:project:${projectId}`;
const defaultLocks = (): LockManager | null => globalThis.navigator?.locks ?? null;

// Runs `task` only while no studio has the animation open. Straight away, or not at all if one
// has it; with `wait` (ms), it waits that long for it to be let go (a studio that's just closing).
async function whenAlone(projectId: string, task: () => Promise<unknown>, locks: LockManager, wait = 0): Promise<void> {
  const options: LockOptions = wait > 0 ? { mode: "exclusive", signal: AbortSignal.timeout(wait) } : { mode: "exclusive", ifAvailable: true };
  await locks.request(lockName(projectId), options, async (lock) => { if (lock) await task(); }).catch((error) => {
    if (!(error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError"))) console.warn("Couldn't clean up", error);
  });
}

export function openProjectSession(projectId: string, cleanUp: () => Promise<unknown>, locks: LockManager | null = defaultLocks()): () => void {
  if (!locks) return () => {};
  let closed = false;
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });

  // Clean up first, then hold the shared lock while the animation is open.
  const holding = whenAlone(projectId, cleanUp, locks).then(() => (closed ? undefined : locks.request(lockName(projectId), { mode: "shared" }, () => held)));

  return () => {
    if (closed) return;
    closed = true;
    release();
    void holding.then(() => whenAlone(projectId, cleanUp, locks));   // once this tab's lock is let go
  };
}

// Animations with no pictures aren't kept: a New that never took a picture leaves nothing behind.
// Deletes every animation without frames last changed before `before` (not one being made right
// now), unless a studio has it open: one that's just closing (coming home from it) is waited for,
// up to `wait` ms. Returns the ids deleted, so what was remembered about them can go too.
// Without Web Locks it deletes nothing: an empty card is better than an animation lost under an
// open studio.
export async function discardEmptyProjects(repository: ProjectRepository, { before = Date.now(), wait = 1000, locks = defaultLocks() }: { before?: number; wait?: number; locks?: LockManager | null } = {}): Promise<string[]> {
  if (!locks) return [];
  const empty = (await repository.listProjects()).filter((project) => project.frameIds.length === 0 && project.updatedAt < before);
  const discarded: string[] = [];
  await Promise.all(empty.map((project) => whenAlone(project.id, async () => {
    const now = await repository.getProject(project.id);   // still empty, now that no one has it open?
    if (!now || now.frameIds.length > 0) return;
    await repository.deleteProject(project.id);
    discarded.push(project.id);
  }, locks, wait)));
  return discarded;
}
