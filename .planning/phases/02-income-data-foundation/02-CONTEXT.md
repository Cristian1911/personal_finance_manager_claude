# Phase 2: Income & Data Foundation - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the income column mismatch so health meters show real data, add null-income handling across all consumers, consolidate seed category UUIDs into a single shared constants file, and fix `z.string().uuid()` validators that reject seed UUIDs. No new features — this is data plumbing that makes downstream phases (health score, categorization, dashboard redesign) trustworthy.

</domain>

<decisions>
## Implementation Decisions

### Income Column Resolution
- **D-01:** `getEstimatedIncomeCached` must read `estimated_monthly_income` (what onboarding writes) as the primary source. Fall back to `monthly_salary` (what the settings profile form writes) only if `estimated_monthly_income` is null/0.
- **D-02:** Both columns remain in the `profiles` table — `estimated_monthly_income` for onboarding, `monthly_salary` for manual settings entry. The income action unifies them with clear priority: `estimated_monthly_income > monthly_salary > transaction-based inference`.
- **D-03:** The settings profile form continues to write to `monthly_salary`. No schema migration needed — just the read logic in `getEstimatedIncomeCached`.

### Null Income UX
- **D-04:** When income is genuinely null (no `estimated_monthly_income`, no `monthly_salary`, no transaction-inferred income), health meters display "Sin datos de ingresos" with neutral styling (not red/warning, not green/good — just informational).
- **D-05:** The 0% / "excelente" misleading fallback must be eliminated — a null income is NOT a 0% spending ratio.
- **D-06:** All consumers of `getEstimatedIncome` must handle the null case: health-meters, deudas page, deudas planificador page, and any 50/30/20 budget logic.

### Category Constants Consolidation
- **D-07:** Create `packages/shared/src/constants/categories.ts` exporting all seed category UUIDs as named constants (e.g., `DEBT_PAYMENT_CATEGORY_ID`, `TRANSFER_CATEGORY_ID`, `SUBSCRIPTIONS_CATEGORY_ID`, etc.).
- **D-08:** All hardcoded UUID strings in `webapp/src/actions/recurring-templates.ts`, `mobile/lib/transaction-semantics.ts`, `mobile/app/subscriptions.tsx`, and `packages/shared/src/utils/auto-categorize.ts` must import from this single file.
- **D-09:** Export the constants from `packages/shared/src/index.ts` so they're available as `@zeta/shared/constants/categories` or via the barrel export.

### UUID Validation Fix
- **D-10:** Replace `z.string().uuid()` with the permissive regex pattern in `recurring-templates.ts` (lines 390, 394) and `purchase-decision.ts` (lines 25-26).
- **D-11:** Grep audit for any other `z.string().uuid()` usage that might receive category or account IDs derived from seed data. Fix all found instances.
- **D-12:** The permissive regex pattern is already established: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` — reuse existing validator pattern from `webapp/src/lib/validators/transaction.ts`.

### Claude's Discretion
- Exact null-state component design for health meters (inline message vs card vs banner)
- Whether to extract a shared `permissiveUuid` Zod schema helper to avoid duplicating the regex
- How to structure the income priority logic (early return chain vs ternary vs separate function)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Income
- `webapp/src/actions/income.ts` — `getEstimatedIncomeCached` reads `monthly_salary` (line 42); should read `estimated_monthly_income` first
- `webapp/src/actions/onboarding.ts` — Writes `estimated_monthly_income` during onboarding (line 63)
- `webapp/src/actions/health-meters.ts` — Calls `getEstimatedIncome()` for health meter calculations (line 119)
- `webapp/src/actions/profile.ts` — Settings form writes `monthly_salary` (line 59)
- `webapp/src/components/settings/profile-form.tsx` — UI for `monthly_salary` input (line 72-76)
- `webapp/src/types/database.ts` — Both columns defined: `estimated_monthly_income` (line 592), `monthly_salary` (line 596)

### Health Meters / Consumers
- `webapp/src/app/(dashboard)/deudas/page.tsx` — Calls `getEstimatedIncome()` (line 35)
- `webapp/src/app/(dashboard)/deudas/planificador/page.tsx` — Calls `getEstimatedIncome()` (line 17)
- `webapp/src/lib/health-levels.ts` — `classifyLevel`, `getRoastMessage` — may need null-level handling

### Category Constants
- `packages/shared/src/utils/auto-categorize.ts` — Full seed UUID map (lines 21-30)
- `webapp/src/actions/recurring-templates.ts` — Hardcoded `DEBT_PAYMENT_CATEGORY_ID`, `TRANSFER_CATEGORY_ID` (lines 21-22)
- `mobile/lib/transaction-semantics.ts` — Hardcoded `DEBT_PAYMENT_CATEGORY_ID` (line 1)
- `mobile/app/subscriptions.tsx` — Hardcoded `SUBSCRIPTIONS_CATEGORY_ID` (line 18)
- `packages/shared/src/index.ts` — Barrel export (add constants re-export here)

### UUID Validation
- `webapp/src/actions/recurring-templates.ts` — `z.string().uuid()` on lines 390, 394
- `webapp/src/actions/purchase-decision.ts` — `z.string().uuid()` on lines 25-26
- `webapp/src/lib/validators/transaction.ts` — Permissive regex pattern reference (lines 4-6)

### Research Findings
- `.planning/codebase/CONCERNS.md` — Documents income column mismatch, hardcoded UUIDs, Zod UUID rejection

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `webapp/src/lib/validators/transaction.ts` — Permissive UUID regex already exists, can be extracted to shared validator
- `packages/shared/src/utils/auto-categorize.ts` — Already has the full map of seed category UUIDs (lines 21-30) — source of truth for the constants file
- `webapp/src/lib/health-levels.ts` — `classifyLevel()` and `getRoastMessage()` — may need a "no data" level variant

### Established Patterns
- Income action uses `unstable_cache` with `"income"` tag for server-side caching
- Health meters aggregate multiple data sources via `Promise.all`
- Validators in `webapp/src/lib/validators/` use the permissive regex pattern consistently (6 validator files)
- `@zeta/shared` barrel export pattern: named exports from `packages/shared/src/index.ts`

### Integration Points
- `webapp/src/actions/income.ts` — Single file to fix the column read
- `packages/shared/src/constants/categories.ts` — New file, then update 4 consumer files
- `webapp/src/actions/recurring-templates.ts` and `purchase-decision.ts` — UUID validator fixes
- All files importing `getEstimatedIncome` — null handling updates

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward data plumbing with clear before/after states.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-income-data-foundation*
*Context gathered: 2026-03-25*
