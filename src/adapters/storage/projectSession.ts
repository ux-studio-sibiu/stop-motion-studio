// Cleaning up an animation's unused pictures safely (step 21), across tabs.
//
// Deleting a picture keeps its photo, so undo can bring it back. Those photos can only go once no
// undo history anywhere can still need them. Each studio holds a shared Web Lock on the animation
// it has open; the clean-up runs only when it can take the lock alone, so no other tab has that
// animation open (with its own undo history). It runs when the studio opens it (this tab's
// history is empty then) and again when the studio leaves it.
// Without Web Locks (very old browsers) it never cleans up: keeping a few photos too many is safe,
// deleting one an undo still needs isn't.

export function openProjectSession(projectId: string, cleanUp: () => Promise<unknown>, locks: LockManager | null = globalThis.navigator?.locks ?? null): () => void {
  if (!locks) return () => {};
  const name = `stop-motion-studio:project:${projectId}`;
  let closed = false;
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });

  const whenAlone = () => locks.request(name, { mode: "exclusive", ifAvailable: true }, async (lock) => { if (lock) await cleanUp(); }).catch((error) => console.warn("Couldn't clean up unused pictures", error));

  // Clean up first, then hold the shared lock while the animation is open.
  const holding = whenAlone().then(() => (closed ? undefined : locks.request(name, { mode: "shared" }, () => held)));

  return () => {
    if (closed) return;
    closed = true;
    release();
    void holding.then(whenAlone);   // once this tab's lock is let go
  };
}
