# Phase 2: Income & Data Foundation — Research

**Date:** 2026-03-25
**Phase:** 02-income-data-foundation
**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04

## RESEARCH COMPLETE

## 1. Income Column Mismatch (DATA-01)

### Current State
- `getEstimatedIncomeCached()` in `webapp/src/actions/income.ts` (line 42) reads **only** `monthly_salary` from `profiles`
- Onboarding (`webapp/src/actions/onboarding.ts`, line 63) writes to `estimated_monthly_income`
- Settings profile form (`webapp/src/actions/profile.ts`, line 59) writes to `monthly_salary`
- Both columns exist in `profiles` table: `estimated_monthly_income` (line 592 in database.ts) and `monthly_salary` (both nullable numbers)

### Fix
- Modify the `.select("monthly_salary")` on line 42 to `.select("monthly_salary, estimated_monthly_income")`
- Priority chain: `estimated_monthly_income` > `monthly_salary` > transaction inference
- Check: `if (profile?.estimated_monthly_income && profile.estimated_monthly_income > 0)` first, then existing `monthly_salary` check
- Return type already has `source: "profile" | "transactions"` — both profile sources use `"profile"`

### Consumers
1. `webapp/src/actions/health-meters.ts:119` — `getEstimatedIncome(currency, month)`
2. `webapp/src/app/(dashboard)/deudas/page.tsx:35` — `getEstimatedIncome(currency, month)`
3. `webapp/src/app/(dashboard)/deudas/planificador/page.tsx:17` — `getEstimatedIncome(currency)`

All 3 get the fix for free since they call the same function.

## 2. Health Meters Null Income (DATA-02)

### Current Behavior
- When `incomeEstimate` is null: `monthlyIncome = null` (line 126)
- `gastoValue = income > 0 ? (expenses / income) * 100 : 0` → fallback to 0 (not 0%)
- `effectiveIncome = monthlyIncome ?? income` → falls through to cashflow income, then 0
- `deudaValue` uses `effectiveIncome` → if 0, deuda = 0
- `ahorroValue` = `income > 0 ? ((income - expenses) / income) * 100 : 0` → 0 if no income
- **Problem**: 0 values get classified by `classifyLevel()` → gasto: 0 → "excelente", deuda: 0 → "excelente", ahorro: 0 → "critico", colchon: varies

### Fix Required
- When `monthlyIncome` is null AND cashflow `income` is 0, meters should show "Sin datos de ingresos" state
- Need to handle at the meter-building level (lines 130-210) or at the component level
- Best approach: return a flag in `HealthMetersData` like `hasIncomeData: boolean`
- Component already receives `monthlyIncome: number | null` — can check this to show null state
- **Do NOT change `classifyLevel`** — it should remain pure. The null-state check belongs in the action or component.

### UI Changes
- Health meter widgets need a "no data" variant: neutral color, "Sin datos de ingresos" message
- This is the `gasto` and `deuda` meters specifically — `colchon` doesn't depend on income, and `ahorro` rate of 0 means something even without income data

## 3. Category UUID Constants (DATA-03)

### Current State — Hardcoded UUIDs
1. **`packages/shared/src/utils/auto-categorize.ts`** (lines 21-41) — Master list of 21 category UUIDs as `SEED_CATEGORY_IDS` object
2. **`webapp/src/actions/recurring-templates.ts`** (lines 21-22) — `DEBT_PAYMENT_CATEGORY_ID`, `TRANSFER_CATEGORY_ID`
3. **`mobile/lib/transaction-semantics.ts`** (line 1) — `DEBT_PAYMENT_CATEGORY_ID`
4. **`mobile/app/subscriptions.tsx`** (line 18) — `SUBSCRIPTIONS_CATEGORY_ID`
5. **`mobile/lib/demo-data.ts`** (lines 8-35, 174-206) — Hardcoded category UUIDs in demo data
6. **`mobile/app/transaction/[id].tsx`** (lines 30, 184, 214) — Imports `DEBT_PAYMENT_CATEGORY_ID` from transaction-semantics
7. **`mobile/app/(tabs)/import.tsx`** (lines 44, 614) — Imports `DEBT_PAYMENT_CATEGORY_ID`

### Plan
- Create `packages/shared/src/constants/categories.ts` with all 21 UUIDs as named exports
- Export from barrel: add `export * from "./constants/categories"` to `packages/shared/src/index.ts`
- Update `auto-categorize.ts` to import from constants file
- Update `recurring-templates.ts` to import from `@zeta/shared`
- Update mobile files to import from `@zeta/shared`

### Naming Convention
```typescript
export const CATEGORY_VIVIENDA = "a0000001-0001-4000-8000-000000000001";
export const CATEGORY_ALIMENTACION = "a0000001-0001-4000-8000-000000000002";
// ... etc
// Aliases for common use
export const DEBT_PAYMENT_CATEGORY_ID = CATEGORY_PAGOS_DEUDA;
export const TRANSFER_CATEGORY_ID = CATEGORY_TRANSFERENCIAS;
export const SUBSCRIPTIONS_CATEGORY_ID = CATEGORY_SUSCRIPCIONES;
```

### Also export the map for auto-categorize
```typescript
export const SEED_CATEGORY_IDS = { VIVIENDA: CATEGORY_VIVIENDA, ... } as const;
```

## 4. UUID Validation Fix (DATA-04)

### Current z.string().uuid() Usage
1. `webapp/src/actions/purchase-decision.ts:25` — `accountId: z.string().uuid()`
2. `webapp/src/actions/purchase-decision.ts:26` — `categoryId: z.string().uuid().nullable().optional()`
3. `webapp/src/actions/recurring-templates.ts:390` — `templateId: z.string().uuid()`
4. `webapp/src/actions/recurring-templates.ts:394` — `sourceAccountId: z.string().uuid().nullable().optional()`

### Existing Pattern
`webapp/src/lib/validators/transaction.ts` (lines 1-7):
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidStr = (msg = "UUID inválido") => z.string().regex(UUID_RE, msg);
```

### Fix
- Either import `uuidStr` from transaction validator or create a shared UUID validator
- Best approach: extract `UUID_RE` and `uuidStr` to a shared validators file (e.g. `webapp/src/lib/validators/shared.ts`) since it's used in 6+ validator files
- Replace `z.string().uuid()` with `uuidStr()` in both files
- Also do a full audit — the 4 instances above are the only `z.string().uuid()` calls in the codebase

## Validation Architecture

### Success Criteria Mapping
| Criterion | Test |
|-----------|------|
| SC-1: Real health meter percentages | `getEstimatedIncomeCached` reads `estimated_monthly_income` first; returns non-zero income for users who completed onboarding |
| SC-2: "Sin datos de ingresos" shown | Health meters action returns flag or component checks null income; UI shows message instead of misleading 0% |
| SC-3: Single constants file | `packages/shared/src/constants/categories.ts` exists; grep finds no hardcoded UUID strings outside this file and demo data |
| SC-4: Seed UUIDs accepted | No `z.string().uuid()` calls remain in actions that receive category/account IDs |

### Build Verification
- `pnpm install` (shared package change)
- `pnpm build` must pass (validates all imports and types across packages)
