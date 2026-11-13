import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Layering (see PLAN.md §2): core <- adapters <- store <- ui.
// core/ is plain TypeScript and must not depend on frameworks or other layers.
const coreRules = {
  files: ["src/core/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["react", "react-dom", "react/*", "next", "next/*"], message: "core/ is framework-free: no React or Next." },
        { group: ["dexie", "dexie-*", "zustand", "zustand/*"], message: "core/ defines interfaces; storage and state live in adapters/ and store/." },
        { group: ["@/adapters/*", "@/store/*", "@/studio/*", "@/features/*", "@/app/*"], message: "core/ must not import from outer layers." },
      ],
    }],
  },
};

// adapters/ implement core interfaces; they never reach into UI or store.
const adapterRules = {
  files: ["src/adapters/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["@/store/*", "@/studio/*", "@/features/*", "@/app/*"], message: "adapters/ may only import from core/." },
      ],
    }],
  },
};

// Playwright tests aren't React: its fixtures call a function named `use`, which the React
// hooks rule mistakes for React's use() hook.
const e2eRules = {
  files: ["e2e/**/*.ts", "playwright.config.ts"],
  rules: { "react-hooks/rules-of-hooks": "off" },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  coreRules,
  adapterRules,
  e2eRules,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "test-results/**", "playwright-report/**", "e2e/.generated/**"]),
]);

export default eslintConfig;
