import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next resolves "server-only" at build time; it is not an installed
      // package, so tests that transitively import a server-only module would
      // fail to resolve it. Stub it out — the guard still applies to the build.
      "server-only": path.resolve(__dirname, "./vitest.server-only-stub.ts"),
    },
  },
  test: {
    // Playwright owns ./e2e (testDir in playwright.config.ts); keep vitest off
    // those .spec.ts files so `vitest run` only collects unit tests.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
