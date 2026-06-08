import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Z-index discipline: forbid raw z-index literals in Tailwind classes. Every
// layered surface must use a --z-layer-* token via z-[var(--z-layer-*)]. The
// pattern targets z-[<2+ digits>] so it catches every escalation (z-[50],
// z-[9999], z-[10000]) while still allowing standard utilities (z-10, z-40),
// single-digit local micro-stacking (z-[1]/z-[2]), and token/calc references
// (z-[var(--z-layer-*)], z-[calc(var(--z-layer-dev)+2)]).
// See docs/design-system/Z_INDEX.md.
const Z_INDEX_MESSAGE =
  "Raw z-index literal. Use a --z-layer-* token via z-[var(--z-layer-*)] (defined in globals.css) — see docs/design-system/Z_INDEX.md.";
const noRawZIndex = {
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "Literal[value=/z-\\[\\d{2,}\\]/]",
        message: Z_INDEX_MESSAGE,
      },
      {
        selector: "TemplateElement[value.cooked=/z-\\[\\d{2,}\\]/]",
        message: Z_INDEX_MESSAGE,
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noRawZIndex,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
