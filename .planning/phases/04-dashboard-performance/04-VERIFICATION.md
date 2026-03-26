---
phase: 04-dashboard-performance
verified: 2026-03-26T14:41:41Z
status: gaps_found
score: 4/5 success criteria verified
gaps:
  - truth: "No chart component is in the initial JavaScript bundle — all load via next/dynamic on demand"
    status: partial
    reason: "Four recharts-using chart components (CashFlowViewToggle, CategoryDonut, BudgetPaceChart, NetWorthHistoryChart) are statically imported in async Server Component sections (flujo-charts.tsx, presupuesto-section.tsx, patrimonio-section.tsx). Although these are separate chunks due to the use-client boundary, they are part of the dashboard page's client manifest and are downloaded eagerly on page load — not deferred on demand. The dynamic() declarations for these four charts in page.tsx are dead code (never rendered from page.tsx)."
    artifacts:
      - path: "webapp/src/components/dashboard/flujo-charts.tsx"
        issue: "Statically imports CashFlowViewToggle from recharts — not wrapped in next/dynamic"
      - path: "webapp/src/components/dashboard/presupuesto-section.tsx"
        issue: "Statically imports CategoryDonut and BudgetPaceChart from recharts — not wrapped in next/dynamic"
      - path: "webapp/src/components/dashboard/patrimonio-section.tsx"
        issue: "Statically imports NetWorthHistoryChart from recharts — not wrapped in next/dynamic"
      - path: "webapp/src/app/(dashboard)/dashboard/page.tsx"
        issue: "Lines 80-111: dynamic() declarations for NetWorthHistoryChart, BudgetPaceChart, CashFlowViewToggle, CategoryDonut are orphaned dead code — these consts are defined but never rendered in page.tsx JSX. The actual rendering goes through FlujoCharts, PresupuestoSection, PatrimonioSection which use their own static imports."
    missing:
      - "Add dynamic() import for CashFlowViewToggle in flujo-charts.tsx (replacing the static import)"
      - "Add dynamic() imports for CategoryDonut and BudgetPaceChart in presupuesto-section.tsx (replacing static imports)"
      - "Add dynamic() import for NetWorthHistoryChart in patrimonio-section.tsx (replacing static import)"
      - "Remove orphaned dynamic declarations from page.tsx (lines ~80-111) for NetWorthHistoryChart, BudgetPaceChart, CashFlowViewToggle, CategoryDonut — these consts are never used"
human_verification:
  - test: "Observe first-paint behavior on dashboard"
    expected: "Health meters and hero data visible before charts appear; charts stream in with skeleton placeholders"
    why_human: "~50ms timing claim for hero render requires browser DevTools Network throttling; cannot verify programmatically without running server"
  - test: "Verify chart lazy-loading in browser Network tab"
    expected: "Chart JS chunks (category-donut, budget-pace-chart, etc.) should only download after initial page paint, not before"
    why_human: "Bundle analysis requires running app and inspecting Network waterfall; static code analysis alone cannot determine actual download order for static imports in Server Components"
---

# Phase 04: Dashboard Performance Verification Report

**Phase Goal:** The dashboard hero loads near-instantly and heavy chart libraries do not block first paint
**Verified:** 2026-03-26T14:41:41Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dashboard hero/health section visible within ~50ms; charts stream with skeleton placeholders | ✓ VERIFIED | Tier-1 `Promise.all` at line 400 has exactly 2 fetches: `getDashboardHeroData` + `getHealthMeters`. 12 Suspense boundaries in page.tsx wrap all tier-2 content with named skeleton fallbacks. |
| 2 | No chart component in initial JavaScript bundle — all load via `next/dynamic` on demand | ✗ PARTIAL | `BurnRateCard`, `Sparkline`, `SalaryTimelineChart`, `UtilizationGauge`, `BalanceHistoryChart` are correctly lazy. But `CashFlowViewToggle`, `CategoryDonut`, `BudgetPaceChart`, `NetWorthHistoryChart` are statically imported in their section components — not deferred on demand. |
| 3 | `framer-motion` absent from `package.json`; onboarding transitions animate with CSS classes | ✓ VERIFIED | `framer-motion` absent from `webapp/package.json`. No `framer-motion` imports in `webapp/src/`. 6 occurrences of `animate-in fade-in slide-in-from-right-4 duration-200` in onboarding page.tsx. |
| 4 | Recharts upgraded to v3; chart color tokens use `var(--chart-1)` not `hsl(var(--chart-1))` | ✓ VERIFIED | `"recharts": "3.8.1"` in package.json. Zero results for `hsl(var(--chart` across all src files. `chart.tsx` uses `TooltipContentProps` (v3 API). |
| 5 | Each dashboard section has a meaningful skeleton matching eventual content layout | ✓ VERIFIED | `dashboard-skeletons.tsx` exports 12 named skeleton components (9 desktop + 3 mobile). All used as Suspense fallbacks except `UpcomingPaymentsSkeleton` (minor dead code — UpcomingPayments renders from tier-1 data directly). |

**Score:** 4/5 truths verified (Truth 2 is partial)

---

### Required Artifacts

#### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `webapp/src/components/dashboard/dashboard-skeletons.tsx` | Content-shaped skeleton components for all dashboard sections | ✓ VERIFIED | 225 lines, 12 named exports, no `"use client"`, no recharts imports, uses `animate-pulse` + `bg-muted` |
| `webapp/src/app/(dashboard)/dashboard/page.tsx` | Tier 1/tier 2 Suspense architecture | ✓ VERIFIED | Tier-1 `Promise.all` with exactly 2 items. 12 `<Suspense>` boundaries. All tier-2 sections deferred. |
| `webapp/src/components/mobile/mobile-dashboard.tsx` | Mobile dashboard with tier 1 only props | ✓ VERIFIED | No `burnRateData`, `allocationData`, `debtCountdownData`, `cashFlowStrip` in `MobileDashboardProps`. |

#### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `webapp/package.json` | Clean dependencies without framer-motion | ✓ VERIFIED | `framer-motion` absent |
| `webapp/src/app/onboarding/page.tsx` | CSS-based step transitions | ✓ VERIFIED | 6 divs with `animate-in fade-in slide-in-from-right-4 duration-200`. No `motion.div` or `AnimatePresence`. |

#### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `webapp/package.json` | recharts@3.x dependency | ✓ VERIFIED | `"recharts": "3.8.1"` |
| `webapp/src/components/ui/chart.tsx` | shadcn chart wrapper compatible with recharts v3 | ✓ VERIFIED | Uses `TooltipContentProps`, `LegendPayload` array — v3 API patterns |

#### Plan 04 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `webapp/src/components/dashboard/presupuesto-section.tsx` | Dynamic imports for CategoryDonut, BudgetPaceChart | ✗ STUB | Still has static `import { BudgetPaceChart }` and `import { CategoryDonut }` from chart files. No `dynamic()` calls in this file. |
| `webapp/src/components/dashboard/patrimonio-section.tsx` | Dynamic import for NetWorthHistoryChart | ✗ STUB | Still has static `import { NetWorthHistoryChart }` from chart file. No `dynamic()` calls in this file. |
| `webapp/src/components/dashboard/flujo-charts.tsx` | Dynamic import for CashFlowViewToggle | ✗ STUB | Still has static `import { CashFlowViewToggle }` from chart file at line 1. No `dynamic()` calls in this file. |
| `webapp/src/components/dashboard/accounts-overview.tsx` | Dynamic import for Sparkline with ssr: false | ✓ VERIFIED | `const Sparkline = dynamic(...)` at line 14, `ssr: false` at line 17 |
| `webapp/src/app/(dashboard)/deudas/page.tsx` | Dynamic import for UtilizationGauge | ✓ VERIFIED | `const UtilizationGauge = dynamic(` at line 9. Comment confirms Server Component — no `ssr: false`. |
| `webapp/src/app/(dashboard)/accounts/[id]/page.tsx` | Dynamic import for BalanceHistoryChart | ✓ VERIFIED | `const BalanceHistoryChart = dynamic(` at line 19. No `ssr: false` (correct for Server Component). |
| `webapp/src/components/debt/planner/detail-step.tsx` | Dynamic import for SalaryTimelineChart | ✓ VERIFIED | `const SalaryTimelineChart = dynamic(` at line 52, `ssr: false` at line 55. Note: detail-step.tsx also has a direct `import { Area, AreaChart, ... } from "recharts"` at line 13 for its inline chart — this is acceptable since detail-step is loaded dynamically via scenario-planner.tsx. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `dashboard/page.tsx` | `dashboard-skeletons.tsx` | Suspense fallback imports | ✓ WIRED | 11 of 12 skeleton exports used as fallbacks. `UpcomingPaymentsSkeleton` imported but unused (minor dead code). |
| `dashboard/page.tsx` | Tier 2 async sub-components | async function + Suspense | ✓ WIRED | `BurnRateSection`, `CashFlowHeroStripSection`, `AccountsSection`, `MobileBurnRateSection`, `MobileAllocationSection`, `MobileDebtSection` defined and wrapped in Suspense |
| `dashboard/page.tsx` | BurnRateCard | `dynamic()` + `BurnRateSection` | ✓ WIRED | `const BurnRateCard = dynamic(...)` defined in page.tsx scope; `BurnRateSection` references this local const → lazy-loading works |
| `dashboard/page.tsx` | NetWorthHistoryChart, BudgetPaceChart, CashFlowViewToggle, CategoryDonut | `dynamic()` declarations | ✗ ORPHANED | `dynamic()` consts declared in page.tsx but never rendered from page.tsx JSX. Actual rendering goes through `PatrimonioSection`, `PresupuestoSection`, `FlujoCharts` which have their own static imports. |
| `onboarding/page.tsx` | tw-animate-css | Tailwind CSS animation classes | ✓ WIRED | `animate-in fade-in slide-in-from-right-4 duration-200` on 6 conditional divs; `key` prop triggers re-animation on step change |
| Chart components | `recharts@3` | `import from "recharts"` | ✓ WIRED | All 17 recharts-importing files confirmed. recharts@3.8.1 installed. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `DashboardHero` | `heroData` | `getDashboardHeroData()` (tier 1 await) | Yes — Supabase query | ✓ FLOWING |
| `HealthMetersCard` | `healthMetersData` | `getHealthMeters()` (tier 1 await) | Yes — Supabase query | ✓ FLOWING |
| `BurnRateSection` | `burnRateData` | `getBurnRate()` in async sub-component | Yes — Supabase query | ✓ FLOWING |
| `AccountsSection` | `accountsData`, `latestSnapshotDates` | `getAccountsWithSparklineData()` + `getLatestSnapshotDates()` | Yes — Supabase queries | ✓ FLOWING |
| `PresupuestoSection` | `allocationData` | `get503020Allocation()` | Yes — Supabase query | ✓ FLOWING |
| `PatrimonioSection` | `netWorthHistory` | `getNetWorthHistory()` | Yes — Supabase query | ✓ FLOWING |
| Mobile `MobileAllocationSection` | `allocationData` | `get503020Allocation()` | Yes — Supabase query | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| framer-motion absent from package.json | `grep "framer-motion" webapp/package.json` | No output | ✓ PASS |
| framer-motion absent from all src files | `grep -r "framer-motion" webapp/src/` | No output | ✓ PASS |
| Onboarding CSS animations present | `grep -c "animate-in fade-in" webapp/src/app/onboarding/page.tsx` | 6 matches | ✓ PASS |
| recharts v3 in package.json | `grep '"recharts"' webapp/package.json` | `"recharts": "3.8.1"` | ✓ PASS |
| No hsl(var(--chart)) color tokens | `grep -r "hsl(var(--chart" webapp/src/` | No output | ✓ PASS |
| Tier-1 Promise.all has exactly 2 items | Inspect lines 400-403 of page.tsx | `getDashboardHeroData` + `getHealthMeters` | ✓ PASS |
| Mobile dashboard has no tier-2 props | `grep "burnRateData\|allocationData" mobile-dashboard.tsx` | No output | ✓ PASS |
| Suspense boundary count | `grep -c "<Suspense" dashboard/page.tsx` | 12 | ✓ PASS |
| accounts-overview uses dynamic+ssr:false for Sparkline | `grep "ssr.*false" accounts-overview.tsx` | Match at line 17 | ✓ PASS |
| CashFlowViewToggle in flujo-charts.tsx | `grep "dynamic" flujo-charts.tsx` | No output | ✗ FAIL — static import |
| CategoryDonut/BudgetPaceChart in presupuesto-section.tsx | `grep "dynamic" presupuesto-section.tsx` | No output | ✗ FAIL — static imports |
| NetWorthHistoryChart in patrimonio-section.tsx | `grep "dynamic" patrimonio-section.tsx` | No output | ✗ FAIL — static import |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PERF-01 | 04-01-PLAN.md | Dashboard Suspense streaming — tier 1 renders immediately, tier 2 streams with skeletons | ✓ SATISFIED | Tier-1 `Promise.all(2)` at line 400. 12 `<Suspense>` boundaries. |
| PERF-02 | 04-04-PLAN.md | Lazy-load recharts via `next/dynamic` — chart components not in initial bundle | ✗ PARTIAL | BurnRateCard, Sparkline, SalaryTimelineChart, UtilizationGauge, BalanceHistoryChart are lazy. CashFlowViewToggle, CategoryDonut, BudgetPaceChart, NetWorthHistoryChart are NOT behind `next/dynamic` in their actual render path. |
| PERF-03 | 04-02-PLAN.md | Remove framer-motion dependency | ✓ SATISFIED | Absent from package.json and all src files. |
| PERF-04 | 04-03-PLAN.md | Upgrade recharts v2 → v3; CSS variable color format | ✓ SATISFIED | recharts@3.8.1. No `hsl(var(--chart-N))` patterns. |
| PERF-05 | 04-01-PLAN.md | Meaningful skeleton components for each dashboard section | ✓ SATISFIED | 12 named skeleton components, 11 used as Suspense fallbacks. |

**Orphaned requirements check:** All PERF-01 through PERF-05 are claimed by plans 04-01 through 04-04 and are accounted for. No orphaned requirements.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `webapp/src/app/(dashboard)/dashboard/page.tsx` lines 80-111 | Four `const X = dynamic(...)` declarations for `NetWorthHistoryChart`, `BudgetPaceChart`, `CashFlowViewToggle`, `CategoryDonut` that are never rendered in page.tsx JSX | ✗ BLOCKER | These dynamic declarations are dead code. The actual rendering of these charts happens through `FlujoCharts`, `PresupuestoSection`, `PatrimonioSection` which have their own static imports — the dead dynamic consts provide zero code-splitting benefit. |
| `webapp/src/app/(dashboard)/dashboard/page.tsx` line 68 | `UpcomingPaymentsSkeleton` imported but never used in JSX | ℹ INFO | Minor dead code. `UpcomingPayments` renders from tier-1 data (no Suspense needed). Not a correctness issue. |

---

### Human Verification Required

#### 1. Dashboard First-Paint Timing

**Test:** Open dashboard in Chrome with DevTools Network tab, enable "Slow 3G" throttling, navigate to `/dashboard`
**Expected:** Hero card and health meters visible within ~50ms of navigation (before any chart section appears). Charts stream in one-by-one with skeleton placeholders visible during load.
**Why human:** Timing claim (~50ms) and progressive streaming behavior requires browser devtools observation.

#### 2. Chart Bundle Download Order

**Test:** Open dashboard in Chrome Network tab (no throttling), load the dashboard page, sort network requests by initiator
**Expected:** Chart JS chunks for `category-donut`, `budget-pace-chart`, `net-worth-history-chart`, `cash-flow-view-toggle` should appear AFTER initial page render, not in the initial request waterfall. (Note: given the gap found, these may actually appear in the initial page manifest — this test will confirm or deny.)
**Why human:** Actual bundle download order can only be verified with live browser observation. The static code analysis identified a gap but live observation confirms the practical impact.

---

### Gaps Summary

**One gap blocks full goal achievement (PERF-02 partial):**

The plan intended to wrap all recharts-using chart components in `next/dynamic` so they are truly lazy-loaded on demand. The implementation correctly applied `next/dynamic` to `BurnRateCard`, `Sparkline`, `SalaryTimelineChart`, `UtilizationGauge`, and `BalanceHistoryChart`. However, the four chart components used inside `FlujoCharts`, `PresupuestoSection`, and `PatrimonioSection` were not updated in their actual import files:

- `flujo-charts.tsx` still has `import { CashFlowViewToggle } from "@/components/charts/cash-flow-view-toggle"` (static)
- `presupuesto-section.tsx` still has `import { CategoryDonut } from "..."` and `import { BudgetPaceChart } from "..."` (static)
- `patrimonio-section.tsx` still has `import { NetWorthHistoryChart } from "..."` (static)

The `dynamic()` declarations added to `page.tsx` for these four components (lines 80-111) are **dead code** — they define module-scoped constants that are never referenced in `page.tsx` JSX. The page renders `<FlujoCharts>`, `<PresupuestoSection>`, and `<PatrimonioSection>` directly, and those components use their own static imports — completely separate from the dynamic consts in page.tsx.

**Fix:** Move the `dynamic()` wrappers from page.tsx into the section files themselves (`flujo-charts.tsx`, `presupuesto-section.tsx`, `patrimonio-section.tsx`), replacing the static imports. Since these are async Server Components (no `"use client"`), omit `ssr: false` (as established in plan 04's documented deviation). Remove the now-redundant dead code from page.tsx.

---

_Verified: 2026-03-26T14:41:41Z_
_Verifier: Claude (gsd-verifier)_
