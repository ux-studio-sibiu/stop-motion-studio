import type { ProjectRepository } from "@/core/model";
import { studioDb } from "./db";
import { createDexieRepository } from "./dexieRepository";

let shared: ProjectRepository | null = null;

// The repository the app uses. A function, not a constant, so the database is only opened
// in the browser the first time something needs it (see studioDb).
export function appRepository(): ProjectRepository {
  shared ??= createDexieRepository(studioDb());
  return shared;
}
