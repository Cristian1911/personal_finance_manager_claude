---
phase: 02-income-data-foundation
plan: "01"
subsystem: income-health-meters
tags: [income, health-meters, dashboard, data-fix]
dependency_graph:
  requires: []
  provides: [correct-income-estimation, hasIncomeData-flag, null-income-ui]
  affects: [dashboard, deudas, planificador]
tech_stack:
  added: []
  patterns: [income-priority-chain, null-income-guard]
key_files:
  created: []
  modified:
    - webapp/src/actions/income.ts
    - webapp/src/actions/health-meters.ts
    - webapp/src/components/dashboard/health-meters-card.tsx
decisions:
  - "estimated_monthly_income takes priority over monthly_salary — onboarding writes the former, settings writes the latter"
  - "hasIncomeData is true when EITHER profile income OR cashflow income exists — false only when genuinely absent"
  - "No-data meters use formattedValue='—' as the sentinel so the UI can detect them without an extra prop"
  - "HealthMeterExpanded left unmodified — roast message already contains the no-data explanation"
metrics:
  duration_seconds: 136
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_changed: 3
---

# Phase 02 Plan 01: Income Column Fix + Health Meters Null-Income State Summary

Income action now reads `estimated_monthly_income` as primary source (with `monthly_salary` as fallback), and health meters display a neutral "Sin datos" state instead of misleading 0%/"excelente" when no income data exists.

## What Was Built

### Task 1 — Fix income column read + add hasIncomeData flag (commit: 9d72f3b)

**`webapp/src/actions/income.ts`**

The profile select previously only fetched `monthly_salary`. Onboarding writes `estimated_monthly_income`, so users who completed onboarding always fell through to the transaction inference path (which returned null for new users), making health meters show 0% / "excelente".

Fixed by:
1. Expanding the select to `"monthly_salary, estimated_monthly_income"`
2. Replacing the single salary check with a priority chain:
   - `estimated_monthly_income > 0` — use it (onboarding source)
   - `monthly_salary > 0` — use it (settings source)
   - Neither — fall through to transaction inference

**`webapp/src/actions/health-meters.ts`**

Added `hasIncomeData: boolean` to the `HealthMetersData` interface. Computed as:

```typescript
const hasIncomeData = (monthlyIncome !== null && monthlyIncome > 0) || income > 0;
```

True when EITHER the profile income estimate OR the current-month cashflow income is > 0.

When `!hasIncomeData`, the action overrides `gasto` and `deuda` meters:
- `formattedValue` set to `"—"` (sentinel for the UI)
- `roast` set to "Sin datos de ingresos — configura tu ingreso mensual en ajustes para ver este indicador."

Returns early with summary roast: "Configura tu ingreso mensual en ajustes para obtener un diagnóstico financiero completo."

Both return paths now include `hasIncomeData` in the returned object.

### Task 2 — Render null-income state in health meters card (commit: f7e95be)

**`webapp/src/components/dashboard/health-meters-card.tsx`**

Added `isNoData` flag in `MeterRow`: `meter.formattedValue === "—"`.

When `isNoData`:
- Row header shows `<span className="text-xs text-muted-foreground">Sin datos</span>` instead of the colored value + level tag
- Gradient bar hidden (`{!isNoData && <div ...>}`)
- Info line shown: "Configura tu ingreso en ajustes"

When NOT `isNoData` (normal case): existing rendering unchanged.

`HealthMeterExpanded` was left unmodified — clicking a no-data meter still opens the expanded view, which shows the roast message explaining how to fix it.

## Acceptance Criteria Check

- `income.ts` contains `.select("monthly_salary, estimated_monthly_income")` — YES (line 42)
- `income.ts` checks `estimated_monthly_income` BEFORE `monthly_salary` — YES (lines 55-59)
- `health-meters.ts` interface includes `hasIncomeData: boolean` — YES (line 32)
- `health-meters.ts` contains `"Sin datos de ingresos"` in the no-income override — YES (line 219)
- `health-meters.ts` return statements include `hasIncomeData` — YES (lines 223, 237)
- `health-meters-card.tsx` contains `"Sin datos"` for no-data display — YES (line 51)
- `health-meters-card.tsx` contains `"Configura tu ingreso en ajustes"` — YES (line 100)
- `health-meters-card.tsx` contains `isNoData` conditional — YES (line 39)
- Gradient bar conditionally rendered with `!isNoData` — YES (line 71)
- `pnpm build` passes with zero type errors — YES

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are wired. The no-data state is intentional (shown when income is genuinely absent) and resolves when user sets income in onboarding or settings.

## Self-Check: PASSED

Files exist:
- webapp/src/actions/income.ts — FOUND
- webapp/src/actions/health-meters.ts — FOUND
- webapp/src/components/dashboard/health-meters-card.tsx — FOUND

Commits verified:
- 9d72f3b — FOUND
- f7e95be — FOUND
