import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Playwright owns ./e2e (testDir in playwright.config.ts); keep vitest off
    // those .spec.ts files so `vitest run` only collects unit tests.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
