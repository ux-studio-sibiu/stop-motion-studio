import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Two kinds of Vitest tests (ROADMAP step 15):
//   unit     *.test.ts in Node: fast, no browser. `npm test`.
//   browser  *.browser.test.ts in a real Chromium (through Playwright, the same browser as the
//            end-to-end tests), for code that needs a real canvas. `npm run test:browser`.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.ts"], exclude: ["src/**/*.browser.test.ts"], environment: "node" },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.ts"],
          browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: "chromium" }] },
        },
      },
    ],
  },
});
