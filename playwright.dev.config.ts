import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import type { StudioOptions } from "./e2e/fixtures";

// The same tests against the dev server instead of the production build (npm run test:e2e:dev):
// no build before each run, and every edit is picked up straight away, so a one-spec run starts
// in a second or two. It reuses the `next dev` already running on 3000 (Next allows only one per
// folder), or starts one. The production build is still what `npm run test:e2e` checks, at the
// end of a step and for changes to the build, config or storage.
const URL = "http://localhost:3000";

export default defineConfig<StudioOptions>({
  ...base,
  webServer: { command: "npm run dev", url: URL, reuseExistingServer: true, timeout: 120_000 },
  use: { ...base.use, baseURL: URL },
});
