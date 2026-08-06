import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Z-index discipline: forbid raw z-index literals in Tailwind classes. Every
// layered surface must use a --z-layer-* token via the arbitrary form,
// e.g. z-[var(--z-layer-modal)]. The pattern targets 2+ digit literals
// so it catches every escalation (z-[50], z-[9999], z-[10000]) while still
// allowing standard utilities (z-10, z-40), single-digit local micro-stacking
// (z-[1]/z-[2]), and token/calc references like z-[var(--z-layer-nav)] or
// z-[calc(var(--z-layer-dev)+2)]. See docs/design-system/Z_INDEX.md.
//
// NOTE: never write a *wildcard* class-shaped example here (z-[var(--z-layer-
// star)] with a literal asterisk) — Tailwind v4 scans this file for class
// candidates and emits it as invalid CSS, crashing the dev server.
const Z_INDEX_MESSAGE =
  "Raw z-index literal. Use a --z-layer-* token, e.g. z-[var(--z-layer-modal)] (defined in globals.css) — see docs/design-system/Z_INDEX.md.";

// Debt-account discipline: forbid hand-inlining the debt predicate. An INFLOW to
// a CREDIT_CARD or LOAN is a payment against debt, never income, and every copy
// of that check is a place the rule can silently rot. charts.ts alone had five
// copies while importing the shared helper and using it once.
//
// The target is the *pair* — a single expression testing both CREDIT_CARD and
// LOAN — because that pair is the debt predicate spelled out by hand. Comparing
// against one of them alone is legitimate and common (loan amortization,
// credit-card utilization, loan-only form fields), so those are not flagged.
const DEBT_PREDICATE_MESSAGE =
  'Inlined debt-account check. Use isDebtAccountType() / isDebtInflow() from "@zeta/shared" — an INFLOW to CREDIT_CARD or LOAN is a debt payment, not income.';
// NOTE: `no-restricted-syntax` must be configured ONCE. In flat config a later
// config object replaces a rule's options wholesale rather than merging them, so
// a second entry silently disables every selector in the first. Both guards live
// in the single object below for that reason.
const noRestrictedSyntax = {
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
      {
        // Catches both `x === "CREDIT_CARD" || x === "LOAN"` and the negated
        // `x !== "CREDIT_CARD" && x !== "LOAN"`.
        selector:
          'LogicalExpression:has(BinaryExpression[right.value="CREDIT_CARD"]):has(BinaryExpression[right.value="LOAN"])',
        message: DEBT_PREDICATE_MESSAGE,
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noRestrictedSyntax,
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
