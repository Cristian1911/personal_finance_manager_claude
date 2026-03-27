---
phase: 04-dashboard-performance
plan: 01
subsystem: dashboard
tags: [performance, suspense, streaming, skeletons, mobile]
dependency_graph:
  requires: []
  provides: [suspense-tier-split, dashboard-skeletons, mobile-tier-split]
  affects: [dashboard-page, mobile-dashboard, all-dashboard-sections]
tech_stack:
  added: []
  patterns: [suspense-streaming, async-server-components, content-shaped-skeletons]
key_files:
  created:
    - webapp/src/components/dashboard/dashboard-skeletons.tsx
  modified:
    - webapp/src/app/(dashboard)/dashboard/page.tsx
    - webapp/src/components/mobile/mobile-dashboard.tsx
decisions:
  - Tier 1 Promise.all reduced to exactly getDashboardHeroData + getHealthMeters — hero and health meters render before any other fetch completes
  - CashFlowHeroStrip deferred to tier 2 (not tier 1) — sits visually between hero and health but requires its own cashflow fetch; deferring avoids adding 3rd fetch to critical path
  - AccountsSection combines AccountsOverview + DashboardAlerts + latestSnapshotDates into single async sub-component — reduces visual churn by streaming them together
  - MobileDashboard interface stripped to tier 1 props only; tier 2 content moved to Suspense sub-components rendered from page.tsx
metrics:
  duration_seconds: 325
  completed_date: "2026-03-26"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
requirements_satisfied: [PERF-01, PERF-05]
---

# Phase 04 Plan 01: Suspense Tier Split + Content-Shaped Skeletons — Summary

Dashboard hero and health meters now render before any chart or secondary section. Content-shaped skeletons for all 12 tier 2 sections prevent layout shift when real content streams in.

## What Was Built

### Task 1: Dashboard Skeleton Components

Created `/webapp/src/components/dashboard/dashboard-skeletons.tsx` with 12 named skeleton exports:

**Desktop skeletons:**
- `BurnRateSkeleton` — card with header toggle + chart area + subtitle rows
- `AccountsSkeleton` — card with 3 account rows (dot + name + balance + sparkline)
- `FlujoWaterfallSkeleton` — card with h-320 chart area
- `FlujoChartsSkeleton` — card with tab toggle header + h-280 chart area
- `PresupuestoSkeleton` — two-card grid (donut h-280 + pace h-240)
- `PatrimonioSkeleton` — two-card grid (net worth h-300 + debt h-240)
- `HeatmapSkeleton` — card with h-160 heatmap area
- `UpcomingPaymentsSkeleton` — card with 4 payment rows
- `CashFlowHeroStripSkeleton` — full-width h-10 pulse strip

**Mobile skeletons:**
- `MobileBurnRateSkeleton` — compact card with chart area
- `MobileAllocationSkeleton` — card with 3 progress bar rows
- `MobileDebtSkeleton` — card with countdown area

All use `animate-pulse` + `bg-muted`. No `"use client"`, no chart library imports.

### Task 2: Suspense Tier Split

**`page.tsx` restructured:**

Tier 1 (awaited at page level — renders immediately):
```
Promise.all([getDashboardHeroData, getHealthMeters])
```

Tier 2 (async Server Components wrapped in `<Suspense>`):
- `BurnRateSection` — calls `getBurnRate()`
- `CashFlowHeroStripSection` — calls `getMonthlyCashflow()`
- `AccountsSection` — calls `getAccountsWithSparklineData()` + `getLatestSnapshotDates()` together
- `MobileBurnRateSection`, `MobileAllocationSection`, `MobileDebtSection` — mobile tier 2

Total Suspense boundaries: 12 (3 mobile + 9 desktop including MonthSelector).

**`mobile-dashboard.tsx` refactored:**
- Removed props: `burnRateData`, `allocationData`, `debtCountdownData`, `cashFlowStrip`
- Removed imports: `BurnRateCard`, `BurnRateCardEmpty`, `AllocationBars5030`, `DebtFreeCountdown`, `DashboardSection`, `BurnRateResponse`, `AllocationData`, `DebtCountdownData`, `CurrencyCode`
- Kept props: `heroData`, `upcomingPayments`, `recentTransactions`, `healthMetersData`
- Simplified hero card (removed inline cashflow strip — now rendered separately from page)

## Verification

- `pnpm build` passes clean (0 errors, 0 warnings)
- `npx tsc --noEmit` passes clean
- `page.tsx` tier 1 `Promise.all` has exactly 2 items
- All 12 Suspense fallbacks use named skeletons (except MonthSelector which uses inline div — acceptable for a navigation element)
- `MobileDashboardProps` has no tier 2 props

## Deviations from Plan

### Auto-selected — CashFlowHeroStrip placement

**Found during:** Task 2
**Issue:** Plan spec listed CashFlowHeroStrip as a possible tier 1 item but the research noted it as an "open question" and D-01 explicitly listed only `getDashboardHeroData` + `getHealthMeters` as tier 1.
**Decision:** Deferred to tier 2 with `CashFlowHeroStripSkeleton`. The strip sits above the fold visually but requires a separate cashflow fetch — deferring keeps tier 1 at exactly 2 fetches.

### AccountsSection groups accounts + alerts

**Found during:** Task 2
**Issue:** Plan sketched AccountsSection and DashboardAlerts as potentially separate sub-components.
**Decision:** Combined into single `AccountsSection` that fetches `accountsData` + `latestSnapshotDates` together — avoids two separate Suspense boundaries replacing what was one contiguous section.

## Known Stubs

None — all rendered sections are wired to real data sources.

## Self-Check: PASSED

- `/Users/cristian/Documents/developing/current-projects/zeta/webapp/src/components/dashboard/dashboard-skeletons.tsx` — exists, 225 lines
- `/Users/cristian/Documents/developing/current-projects/zeta/webapp/src/app/(dashboard)/dashboard/page.tsx` — modified with tier split
- `/Users/cristian/Documents/developing/current-projects/zeta/webapp/src/components/mobile/mobile-dashboard.tsx` — tier 2 props removed
- Commits: `227964a` (skeletons) and `14ca484` (tier split)
