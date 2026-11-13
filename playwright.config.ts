import { defineConfig, devices } from "@playwright/test";
import { FAKE_CAMERA_FILE } from "./e2e/fake-camera";
import type { StudioOptions } from "./e2e/fixtures";

const PORT = 3200;   // away from `next dev` on 3000, so both can run at once

export default defineConfig<StudioOptions>({
  testDir: "e2e",
  globalSetup: "./e2e/fake-camera.ts",   // writes the fake webcam video before browsers start
  fullyParallel: true,
  forbidOnly: !!process.env.CI,          // a stray test.only fails CI instead of skipping the rest
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],

  // Build the static export and serve it, the way it ships. A server already on the port is
  // reused locally, so reruns skip the build; CI always starts fresh.
  webServer: {
    command: `npm run build && npx serve out -l ${PORT} --no-port-switching`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",          // every failed test keeps a trace to open in the trace viewer
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["camera"],
        fakeCamera: "device",
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",                          // answer the permission prompt with "allow"
            "--use-fake-device-for-media-stream",                      // replace real webcams with a fake one
            `--use-file-for-fake-video-capture=${FAKE_CAMERA_FILE}`,   // ...that plays this video
          ],
        },
      },
    },
    {
      // WebKit (Safari's engine) has no file-backed fake camera; a script fakes getUserMedia
      // instead, so storage and layout still get tested in it. Real-camera tests are skipped.
      name: "webkit",
      use: { ...devices["Desktop Safari"], fakeCamera: "script" },
      grepInvert: /@real-camera/,
      // Playwright's WebKit on Windows crashes now and then when many copies run at once
      // ("Target page, context or browser has been closed"); two at a time is stable.
      workers: 2,
    },
  ],
});
