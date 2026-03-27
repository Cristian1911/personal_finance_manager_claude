# Phase 4: Dashboard Performance - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the dashboard hero load near-instantly and remove heavy chart libraries from the initial bundle. Suspense streaming splits data into tier 1 (instant) and tier 2 (deferred with skeletons). All chart components lazy-loaded via `next/dynamic`. framer-motion removed entirely and replaced with CSS transitions. Recharts upgraded from v2 to v3. No new features — this is invisible performance work that makes every subsequent visual phase faster.

</domain>

<decisions>
## Implementation Decisions

### Suspense Streaming Tiers (PERF-01)
- **D-01:** Tier 1 (renders before anything else): `getDashboardHeroData` + `getHealthMeters`. These are the "Am I on track?" signals — available to spend, balance, health levels.
- **D-02:** Tier 2 (streams in with skeletons): Everything else — burn rate, accounts, cashflow, allocation, debt countdown, snapshots. Grouped per dashboard section (not per widget) to reduce visual churn.
- **D-03:** Mobile dashboard (`MobileDashboard`) gets the same tier 1/tier 2 split. Refactor from current prop-passing approach to Suspense sub-components so mobile doesn't block on all fetches.
- **D-04:** The current `Promise.all` of 8 fetches must be broken up. Tier 1 fetches are awaited at page level; tier 2 fetches happen inside async Server Components wrapped in `<Suspense>`.

### Lazy-Loading Charts (PERF-02)
- **D-05:** All recharts-importing components (17 files) must be wrapped in `next/dynamic` with `ssr: false` so chart JS is never in the initial bundle.
- **D-06:** Each chart component gets a content-shaped skeleton as its `loading` prop in the dynamic import.

### Remove framer-motion (PERF-03)
- **D-07:** Remove `framer-motion` from `package.json` entirely. Only 1 file actually imports it: `webapp/src/app/onboarding/page.tsx` (uses `motion` + `AnimatePresence` for step transitions).
- **D-08:** Replace onboarding step transitions with CSS transitions using Tailwind classes + `tw-animate-css` (already installed). Simple fade+slide. Zero JS bundle cost.

### Recharts v2 → v3 Upgrade (PERF-04)
- **D-09:** Upgrade recharts from v2.15.4 to v3 in the same pass as lazy-loading. Since all 17 chart files are being touched anyway, doing both avoids double migration.
- **D-10:** Update chart color tokens from `hsl(var(--chart-1))` to `var(--chart-1)` CSS variable format — aligns with shadcn/ui's `chart.tsx` component.
- **D-11:** Review v3 API changes (accessibilityLayer, prop renames) and update all chart files accordingly.

### Meaningful Skeletons (PERF-05)
- **D-12:** Content-shaped skeletons that mirror real layout: card headers, chart-height boxes, list rows with circle+line shapes. Each section gets a unique skeleton matching its content structure.
- **D-13:** Skeletons prevent layout shift — same height and grid structure as the real content they replace.
- **D-14:** Use Tailwind `animate-pulse` on skeleton shapes. No extra animation libraries.

### Claude's Discretion
- Exact skeleton layout per section (Claude designs each to match the real component's structure)
- Whether to create a shared `<Skeleton>` component or keep inline per section
- recharts v3 migration specifics — Claude evaluates changelog for breaking changes
- How to restructure the mobile dashboard's data flow for Suspense compatibility

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard Page
- `webapp/src/app/(dashboard)/dashboard/page.tsx` — Main dashboard: 8-fetch Promise.all (line 211), Suspense wrappers (lines 293, 322, 338, 345, 359, 467), mobile vs desktop split (lines 260-474)

### Chart Components (recharts consumers — all 17)
- `webapp/src/components/charts/category-donut.tsx`
- `webapp/src/components/charts/cash-flow-view-toggle.tsx`
- `webapp/src/components/charts/net-worth-history-chart.tsx`
- `webapp/src/components/charts/monthly-cashflow-chart.tsx`
- `webapp/src/components/charts/enhanced-cashflow-chart.tsx`
- `webapp/src/components/charts/daily-spending-chart.tsx`
- `webapp/src/components/charts/balance-history-chart.tsx`
- `webapp/src/components/charts/sparkline.tsx`
- `webapp/src/components/charts/income-vs-expenses-chart.tsx`
- `webapp/src/components/charts/budget-pace-chart.tsx`
- `webapp/src/components/dashboard/burn-rate-card.tsx`
- `webapp/src/components/debt/utilization-gauge.tsx`
- `webapp/src/components/debt/salary-timeline-chart.tsx`
- `webapp/src/components/debt/planner/detail-step.tsx`
- `webapp/src/components/debt/planner/compare-step.tsx`
- `webapp/src/components/debt/debt-simulator.tsx`
- `webapp/src/components/ui/chart.tsx` — shadcn chart wrapper (color token format lives here)

### framer-motion (sole import)
- `webapp/src/app/onboarding/page.tsx` — `motion`, `AnimatePresence` import (line 5)

### Mobile Dashboard
- `webapp/src/components/mobile/mobile-dashboard.tsx` — Currently receives all data as props from parent

### Dashboard Sections (tier 2 streaming targets)
- `webapp/src/components/dashboard/flujo-waterfall.tsx`
- `webapp/src/components/dashboard/flujo-charts.tsx`
- `webapp/src/components/dashboard/presupuesto-section.tsx`
- `webapp/src/components/dashboard/patrimonio-section.tsx`
- `webapp/src/components/dashboard/actividad-heatmap.tsx`
- `webapp/src/components/dashboard/accounts-overview.tsx`
- `webapp/src/components/dashboard/burn-rate-card.tsx`
- `webapp/src/components/dashboard/upcoming-payments.tsx`

### Performance Context
- `.planning/codebase/CONCERNS.md` (lines 128-151) — Dashboard parallel fetch bottleneck, framer-motion bundle, exchange rate timeout

### Animation Replacement
- `tw-animate-css` — Already in `package.json`, provides Tailwind animation utilities

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `webapp/src/components/ui/chart.tsx` — shadcn chart wrapper, already defines CSS variable-based color tokens
- `tw-animate-css` — Already installed, provides fade/slide animation classes
- Existing `<Suspense>` wrappers in dashboard page — partial streaming already in place for FlujoWaterfall, PresupuestoSection, PatrimonioSection, ActividadHeatmap
- `webapp/src/app/(dashboard)/loading.tsx` — Existing page-level loading skeleton

### Established Patterns
- Dashboard sections use `<DashboardSection>` wrapper with collapsible behavior
- `<WidgetSlot>` provides per-widget visibility toggling via dashboard config
- Server Components fetch data via server actions; `revalidateTag("zeta")` invalidates all
- `next/dynamic` with `ssr: false` is the standard lazy-load pattern in Next.js

### Integration Points
- `webapp/src/app/(dashboard)/dashboard/page.tsx` — Break up Promise.all into tier 1/tier 2
- `webapp/src/components/mobile/mobile-dashboard.tsx` — Refactor from prop-passing to Suspense
- All 17 chart files — Wrap in `next/dynamic`, upgrade recharts API
- `webapp/src/app/onboarding/page.tsx` — Remove framer-motion, add CSS transitions
- `webapp/package.json` — Remove framer-motion, upgrade recharts

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward performance optimization with clear before/after states.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-dashboard-performance*
*Context gathered: 2026-03-26*
