// Random ids, created on the device. UUIDs never collide across projects or devices,
// so an imported archive can't clash with existing data.
export function newId(): string {
  return globalThis.crypto.randomUUID();
}
