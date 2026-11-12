import { describe, expect, it } from "vitest";
import { STUDIO_NAME } from "@/core/meta";

// Smoke test: Vitest runs, TypeScript compiles and the "@/" alias resolves.
// Replaced by real model tests in step 02.
describe("setup", () => {
  it("resolves core modules through the @/ alias", () => {
    expect(STUDIO_NAME).toBe("Stop-motion Studio");
  });
});
