# Phase 2: Income & Data Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 02-income-data-foundation
**Areas discussed:** income column resolution, null income UX, category constants consolidation, UUID validation fix scope
**Mode:** Auto (all recommended defaults selected)

---

## Income Column Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Read `estimated_monthly_income` first | Primary source from onboarding, fallback to `monthly_salary` | ✓ |
| Read `monthly_salary` only | Current behavior — ignores onboarding data | |
| Merge columns into one | Schema migration to unify — more disruptive | |

**User's choice:** Read `estimated_monthly_income` first (auto-selected recommended default)
**Notes:** Onboarding writes `estimated_monthly_income`, settings writes `monthly_salary`. Priority chain: estimated > salary > transaction inference.

---

## Null Income UX

| Option | Description | Selected |
|--------|-------------|----------|
| "Sin datos de ingresos" with neutral styling | Clear null state, not misleading | ✓ |
| Show 0% with warning badge | Technically correct but confusing | |
| Hide meters entirely when no income | Clean but loses dashboard real estate | |

**User's choice:** "Sin datos de ingresos" with neutral styling (auto-selected recommended default)
**Notes:** Eliminates the misleading "0% — excelente" when income is genuinely absent.

---

## Category Constants Consolidation

| Option | Description | Selected |
|--------|-------------|----------|
| `packages/shared/src/constants/categories.ts` | Single source importable by all packages | ✓ |
| `webapp/src/lib/constants/categories.ts` | Webapp-only, mobile would need its own copy | |

**User's choice:** `packages/shared/src/constants/categories.ts` (auto-selected recommended default)
**Notes:** Exported via barrel in `packages/shared/src/index.ts`.

---

## UUID Validation Fix Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fix known sites + grep audit | Fix 2 known files, audit for others | ✓ |
| Fix only known 2 call sites | Minimal, might miss others | |

**User's choice:** Fix known sites + grep audit (auto-selected recommended default)
**Notes:** Permissive regex pattern already established in 6 validator files.

---

## Claude's Discretion

- Null-state component design for health meters
- Whether to extract shared `permissiveUuid` Zod schema helper
- Income priority logic structure

## Deferred Ideas

None.
