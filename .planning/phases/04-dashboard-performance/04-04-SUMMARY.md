---
phase: 04-dashboard-performance
plan: 04
subsystem: webapp/dashboard
tags: [performance, charts, lazy-loading, next-dynamic, code-splitting]
dependency_graph:
  requires: [04-03]
  provides: [PERF-02]
  affects: [dashboard, deudas, accounts]
tech_stack:
  added: []
  patterns: [next/dynamic code splitting, content-shaped loading skeletons]
key_files:
  created: []
  modified:
    - webapp/src/app/(dashboard)/dashboard/page.tsx
    - webapp/src/app/(dashboard)/deudas/page.tsx
    - webapp/src/app/(dashboard)/accounts/[id]/page.tsx
    - webapp/src/components/dashboard/accounts-overview.tsx
    - webapp/src/components/debt/planner/detail-step.tsx
decisions:
  - "Server Component pages cannot use ssr:false with next/dynamic — chart components already have use client, so recharts DOM APIs never run server-side; dynamic() without ssr:false achieves code splitting"
  - "Client Component files (accounts-overview, detail-step) use ssr:false since they are valid use client contexts"
metrics:
  duration_minutes: 6
  completed_date: "2026-03-26"
  tasks_completed: 1
  files_modified: 5
---

# Phase 04 Plan 04: Dynamic Chart Imports Summary

Next.js `next/dynamic` applied to all chart components to prevent recharts from being included in the initial JavaScript bundle. Users see content-shaped skeletons while chart chunks download on demand.

## What Was Done

All recharts-powered chart components are now loaded via `next/dynamic` with content-shaped loading skeletons. The chart JS code is split into separate chunks that download only when needed.

### Files Modified

**`dashboard/page.tsx`** — 6 dynamic imports added:
- `NetWorthHistoryChart` — `h-[300px]` skeleton
- `BudgetPaceChart` — `h-[240px]` skeleton
- `CashFlowViewToggle` — toggle bar + `h-[280px]` skeleton (matches component shape)
- `CategoryDonut` — `h-[280px]` skeleton
- `BurnRateCard` — `h-40` skeleton
- `BurnRateCardEmpty` — `h-40` skeleton

**`deudas/page.tsx`** — 1 dynamic import:
- `UtilizationGauge` — `h-[200px]` skeleton

**`accounts/[id]/page.tsx`** — 1 dynamic import:
- `BalanceHistoryChart` — `h-[300px]` skeleton

**`accounts-overview.tsx`** (Client Component) — 1 dynamic import with `ssr: false`:
- `Sparkline` — `h-8 w-24` inline skeleton

**`detail-step.tsx`** (Client Component) — 1 dynamic import with `ssr: false`:
- `SalaryTimelineChart` — `h-[250px]` skeleton

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ssr: false` not allowed in Server Component pages**

- **Found during:** Task 1 build verification
- **Issue:** Next.js App Router forbids `ssr: false` in `next/dynamic` calls inside Server Components. Build error: "`ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component."
- **Fix:** Removed `ssr: false` from dynamic imports in the three Server Component pages (`dashboard/page.tsx`, `deudas/page.tsx`, `accounts/[id]/page.tsx`). The `"use client"` directive already on each chart component ensures recharts DOM APIs never execute server-side — the SSR concern is already handled at the component boundary. `ssr: false` is only needed (and valid) in Client Component contexts, so kept for `accounts-overview.tsx` and `detail-step.tsx`.
- **Files modified:** `dashboard/page.tsx`, `deudas/page.tsx`, `accounts/[id]/page.tsx`
- **Commit:** 11d99ac

## Commits

| Hash | Message |
|------|---------|
| 11d99ac | feat(04-04): wrap all chart components in next/dynamic with loading skeletons |

## Known Stubs

None — all dynamic imports reference real chart components. Loading states are pure CSS skeletons with no hardcoded data.

## Self-Check: PASSED

- `dashboard/page.tsx` contains `dynamic(` — FOUND
- `deudas/page.tsx` contains `dynamic(` — FOUND
- `accounts/[id]/page.tsx` contains `dynamic(` — FOUND
- `accounts-overview.tsx` contains `dynamic(` and `ssr: false` — FOUND
- `detail-step.tsx` contains `dynamic(` and `ssr: false` — FOUND
- All dynamic imports have `loading` prop with skeletons — VERIFIED
- `pnpm build` passes clean (exit code 0) — VERIFIED
