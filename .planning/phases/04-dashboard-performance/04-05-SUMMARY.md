---
phase: 04-dashboard-performance
plan: 05
subsystem: ui
tags: [next/dynamic, recharts, code-splitting, performance, dashboard]

# Dependency graph
requires:
  - phase: 04-dashboard-performance-plan-04
    provides: "Dynamic chart loading pattern established in page.tsx (to be migrated to section files)"
provides:
  - "PERF-02 gap closed: all four chart components (CashFlowViewToggle, CategoryDonut, BudgetPaceChart, NetWorthHistoryChart) loaded via next/dynamic in their rendering section files"
  - "Clean page.tsx with no orphaned dynamic() consts or unused imports"
affects:
  - dashboard-performance
  - recharts bundle analysis

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dynamic() wrappers belong in the section file that renders the chart, not in the top-level page"
    - "Server Component section files use dynamic() without ssr:false — chart components own their use client boundary"

key-files:
  created: []
  modified:
    - webapp/src/components/dashboard/flujo-charts.tsx
    - webapp/src/components/dashboard/presupuesto-section.tsx
    - webapp/src/components/dashboard/patrimonio-section.tsx
    - webapp/src/app/(dashboard)/dashboard/page.tsx

key-decisions:
  - "dynamic() wrappers moved from page.tsx into the section files that actually render each chart — colocation is clearer and prevents accidental dead code"
  - "No ssr:false on any of the new dynamic() calls — Server Component section files let chart components own their use client boundary"

patterns-established:
  - "Pattern: chart dynamic() import lives in the same file that uses it, not in the parent page"

requirements-completed: [PERF-02]

# Metrics
duration: 2min
completed: 2026-03-26
---

# Phase 04 Plan 05: PERF-02 Gap Closure — Dynamic Chart Imports Summary

**Relocated four orphaned dynamic() chart wrappers from dashboard page.tsx into their rendering section files, fully satisfying PERF-02 (recharts excluded from initial JS bundle)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-26T21:53:28Z
- **Completed:** 2026-03-26T21:55:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- CashFlowViewToggle, BudgetPaceChart, CategoryDonut, NetWorthHistoryChart all loaded via `next/dynamic()` in their own section files
- No static chart imports remain in any dashboard section file
- page.tsx cleaned of four orphaned `dynamic()` consts and one unused `UpcomingPaymentsSkeleton` import
- Build passes clean with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace static chart imports with dynamic() in section files** - `06a1e89` (feat)
2. **Task 2: Remove orphaned dead code from page.tsx** - `3026d7e` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `webapp/src/components/dashboard/flujo-charts.tsx` - Static CashFlowViewToggle import replaced with dynamic()
- `webapp/src/components/dashboard/presupuesto-section.tsx` - Static BudgetPaceChart and CategoryDonut imports replaced with dynamic()
- `webapp/src/components/dashboard/patrimonio-section.tsx` - Static NetWorthHistoryChart import replaced with dynamic()
- `webapp/src/app/(dashboard)/dashboard/page.tsx` - Removed 4 orphaned dynamic() consts and UpcomingPaymentsSkeleton import

## Decisions Made

- dynamic() wrappers moved into section files (not page.tsx) — this is the correct colocation; the section file renders the chart and owns the loading boundary
- No `ssr: false` on any new dynamic() calls — these are Server Component files; the "use client" boundary inside each chart component ensures recharts DOM APIs never run server-side

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PERF-02 is fully satisfied: recharts code is not in the initial JavaScript bundle
- Phase 04 is now complete (all 5 plans done)
- Phase 05 (onboarding audit) can begin

---
*Phase: 04-dashboard-performance*
*Completed: 2026-03-26*
