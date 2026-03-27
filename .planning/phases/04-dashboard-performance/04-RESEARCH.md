# Phase 4: Dashboard Performance - Research

**Researched:** 2026-03-26
**Domain:** Next.js streaming, bundle splitting, recharts v3 migration, CSS animation
**Confidence:** HIGH

## Summary

Phase 4 is a well-scoped performance refactor with four independent work streams: (1) Suspense streaming tier split, (2) lazy-loading all chart components via `next/dynamic`, (3) removing framer-motion and replacing it with CSS transitions, and (4) upgrading recharts from v2.15.4 to v3.8.1. No new features, no DB changes.

The current dashboard fires a `Promise.all` of 8 server actions at the page level — all 8 are awaited before the first byte of content renders. The fix is straightforward: promote only tier 1 fetches (`getDashboardHeroData` + `getHealthMeters`) to the page-level await, and move tier 2 fetches into async Server Components wrapped in `<Suspense>`. This pattern is already used in the codebase for `FlujoWaterfall`, `PresupuestoSection`, `PatrimonioSection`, and `ActividadHeatmap` — those sections are already streaming. The gap is that tier 1 data (`heroData`, `healthMetersData`) is still bundled with tier 2 data (`burnRateData`, `accountsData`, `cashflowData`, `mobileAllocationData`, `mobileDebtCountdownData`) in one `Promise.all`.

For recharts, the current codebase uses `var(--chart-1)` through `var(--chart-5)` CSS variables (defined in `globals.css` as aliases for `var(--z-income)`, `var(--z-expense)`, etc.). The color format does NOT need changing — it already uses `var(--chart-N)` format, not `hsl(var(--chart-N))`. The CONTEXT.md decision D-10 states this correctly. `accessibilityLayer` is already applied explicitly on 9 of 17 chart files; in recharts v3 it defaults to `true` so the explicit props become redundant but harmless.

**Primary recommendation:** Execute the four streams independently (they do not conflict). Tier split first, then `next/dynamic` wrapping, then framer-motion removal, then recharts upgrade. This order minimizes the blast radius of the recharts upgrade by ensuring all chart files are already touched for the `next/dynamic` wrap.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Tier 1 (renders before anything else): `getDashboardHeroData` + `getHealthMeters`. These are the "Am I on track?" signals — available to spend, balance, health levels.

**D-02:** Tier 2 (streams in with skeletons): Everything else — burn rate, accounts, cashflow, allocation, debt countdown, snapshots. Grouped per dashboard section (not per widget) to reduce visual churn.

**D-03:** Mobile dashboard (`MobileDashboard`) gets the same tier 1/tier 2 split. Refactor from current prop-passing approach to Suspense sub-components so mobile doesn't block on all fetches.

**D-04:** The current `Promise.all` of 8 fetches must be broken up. Tier 1 fetches are awaited at page level; tier 2 fetches happen inside async Server Components wrapped in `<Suspense>`.

**D-05:** All recharts-importing components (17 files) must be wrapped in `next/dynamic` with `ssr: false` so chart JS is never in the initial bundle.

**D-06:** Each chart component gets a content-shaped skeleton as its `loading` prop in the dynamic import.

**D-07:** Remove `framer-motion` from `package.json` entirely. Only 1 file actually imports it: `webapp/src/app/onboarding/page.tsx` (uses `motion` + `AnimatePresence` for step transitions).

**D-08:** Replace onboarding step transitions with CSS transitions using Tailwind classes + `tw-animate-css` (already installed). Simple fade+slide. Zero JS bundle cost.

**D-09:** Upgrade recharts from v2.15.4 to v3 in the same pass as lazy-loading. Since all 17 chart files are being touched anyway, doing both avoids double migration.

**D-10:** Update chart color tokens from `hsl(var(--chart-1))` to `var(--chart-1)` CSS variable format — aligns with shadcn/ui's `chart.tsx` component.

**D-11:** Review v3 API changes (accessibilityLayer, prop renames) and update all chart files accordingly.

**D-12:** Content-shaped skeletons that mirror real layout: card headers, chart-height boxes, list rows with circle+line shapes. Each section gets a unique skeleton matching its content structure.

**D-13:** Skeletons prevent layout shift — same height and grid structure as the real content they replace.

**D-14:** Use Tailwind `animate-pulse` on skeleton shapes. No extra animation libraries.

### Claude's Discretion
- Exact skeleton layout per section (Claude designs each to match the real component's structure)
- Whether to create a shared `<Skeleton>` component or keep inline per section
- recharts v3 migration specifics — Claude evaluates changelog for breaking changes
- How to restructure the mobile dashboard's data flow for Suspense compatibility

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | Dashboard Suspense streaming — tier 1 (hero/health) renders immediately, tier 2 (charts/sections) streams with skeletons | Section: Architecture Patterns (Suspense tier split) + Code Context analysis |
| PERF-02 | Lazy-load recharts via `next/dynamic` — chart components not in initial bundle | Section: Standard Stack (`next/dynamic` pattern), Architecture Patterns (dynamic import wrapper) |
| PERF-03 | Remove framer-motion dependency (replace single real import with CSS animation) | Section: Architecture Patterns (CSS transition replacement), Don't Hand-Roll |
| PERF-04 | Upgrade recharts v2 → v3 (CSS variable syntax alignment with shadcn/ui) | Section: State of the Art (recharts v3 migration), Common Pitfalls |
| PERF-05 | Meaningful skeleton components for each dashboard section (not generic spinners) | Section: Architecture Patterns (skeleton shapes), Code Examples |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

All directives that affect this phase:

- **Build gate:** `pnpm build` must pass before work is done — TypeScript errors from recharts v3 type changes will surface here
- **Package manager:** pnpm only — use `pnpm install` after recharts version bump and framer-motion removal
- **Performance:** Speed over animations. No heavy client-side libraries without lazy loading — this entire phase enforces that constraint
- **Tech stack:** Next.js 15, Tailwind v4, shadcn/ui — no new dependencies allowed
- **Spanish-first UI:** Any new skeleton placeholder text (if any) must be in Spanish
- **`pnpm build` Turbopack note:** If dev server panics after recharts upgrade, `rm -rf .next` + restart

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| recharts | **3.8.1** (upgrade from 2.15.4) | Chart rendering | Latest stable as of 2026-03-26 |
| next/dynamic | built-in (Next.js 16.1.6) | Lazy-loading client components | SSR bypass with `ssr: false` |
| tw-animate-css | 1.4.0 (already installed) | CSS-based enter/exit animations | Replaces framer-motion for onboarding |
| Tailwind `animate-pulse` | built-in v4 | Skeleton shimmer effect | No additional dep needed |

### Removing

| Library | Current Version | Why Removed | Replacement |
|---------|-----------------|-------------|-------------|
| framer-motion | 12.34.3 | Only 1 real import; ~100 KB bundle cost | tw-animate-css + Tailwind CSS transitions |

**Installation commands:**
```bash
cd webapp
pnpm remove framer-motion
pnpm add recharts@3.8.1
pnpm install
```

**Version verification:** `npm view recharts version` → 3.8.1 (verified 2026-03-26)

---

## Architecture Patterns

### Pattern 1: Suspense Tier Split

**What:** Break the single `Promise.all([8 fetches])` into tier 1 (awaited at page level) and tier 2 (inside async Server Components with `<Suspense>`).

**Current state (lines 211-221 of `dashboard/page.tsx`):**
```typescript
// BAD — all 8 fetches block first paint
const [heroData, latestSnapshotDates, burnRateData, accountsData, cashflowData, healthMetersData, mobileAllocationData, mobileDebtCountdownData] =
  await Promise.all([
    getDashboardHeroData(month, currency),
    getLatestSnapshotDates(),
    getBurnRate(currency),
    getAccountsWithSparklineData(),
    getMonthlyCashflow(month, currency),
    getHealthMeters(currency, month),
    get503020Allocation(month, currency),
    getDebtFreeCountdown(currency),
  ]);
```

**Target state:**
```typescript
// GOOD — tier 1 awaited, everything else deferred
const [heroData, healthMetersData] = await Promise.all([
  getDashboardHeroData(month, currency),
  getHealthMeters(currency, month),
]);

// Tier 2 data moved into async sub-components below
```

**Tier 2 sub-component pattern:**
```typescript
// New async sub-component (Server Component)
async function BurnRateSection({ currency }: { currency: CurrencyCode }) {
  const burnRateData = await getBurnRate(currency);
  return burnRateData ? <BurnRateCard data={burnRateData} /> : <BurnRateCardEmpty />;
}

// In page render — Suspense wraps the async component
<Suspense fallback={<BurnRateSkeleton />}>
  <BurnRateSection currency={currency} />
</Suspense>
```

**Note on existing partial streaming:** `FlujoWaterfall`, `FlujoCharts`, `PresupuestoSection`, `PatrimonioSection`, and `ActividadHeatmap` are ALREADY async Server Components wrapped in `<Suspense>` in the page. The gap is only: `burnRateData`, `accountsData`, `cashflowData`, `latestSnapshotDates`, `mobileAllocationData`, `mobileDebtCountdownData` — these 6 fetches must be extracted from the page-level `Promise.all`.

### Pattern 2: next/dynamic Chart Wrapper

**What:** Wrap all 17 recharts-importing components at the point where they're imported in parent components.

**Established codebase pattern** (from `scenario-planner.tsx`):
```typescript
import dynamic from "next/dynamic";

const CompareStep = dynamic(
  () => import("./planner/compare-step").then((m) => ({ default: m.CompareStep })),
  { loading: () => <div className="h-64 rounded-xl bg-muted animate-pulse" />, ssr: false }
);
```

**For named exports** (most chart components export named functions):
```typescript
const CategoryDonut = dynamic(
  () => import("@/components/charts/category-donut").then((m) => ({ default: m.CategoryDonut })),
  {
    loading: () => <div className="h-[280px] rounded-xl bg-muted animate-pulse" />,
    ssr: false
  }
);
```

**Key rules:**
- `ssr: false` is mandatory — recharts uses DOM APIs that fail during SSR
- The `loading` prop must match the rendered height of the chart to prevent layout shift
- Dynamic imports are created at module scope, NOT inside component render functions
- When the parent is itself a `"use client"` component, `next/dynamic` still creates a separate chunk

**Where to create dynamic wrappers:** Create them in the parent component that renders the chart, NOT inside the chart file itself. This means:
- `PresupuestoSection` imports `CategoryDonut`, `BudgetPaceChart` → add dynamic imports at top of that file
- `flujo-charts.tsx` / `FlujoCharts` imports `CashFlowViewToggle` → wrap there
- `accounts-overview.tsx` imports `Sparkline` → wrap there
- Dashboard page itself imports `BurnRateCard` → wrap there

### Pattern 3: CSS Transition Replacement for framer-motion

**What the onboarding page currently does** (`page.tsx` lines ~240+):
```typescript
<AnimatePresence mode="wait">
  {step === 1 && (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
```

**Replacement pattern using tw-animate-css + React state:**
```typescript
// No AnimatePresence needed — use CSS transitions with key-driven remount
// tw-animate-css provides: animate-in fade-in slide-in-from-right-4
// and: animate-out fade-out slide-out-to-left-4

{step === 1 && (
  <div
    key="step1"
    className="animate-in fade-in slide-in-from-right-4 duration-200"
  >
    {/* step content */}
  </div>
)}
```

**Limitations of CSS-only approach:** The `exit` animation (`opacity 0, x -20`) from framer-motion cannot be replicated with pure CSS on element unmount — the DOM node is removed before the exit animation completes. For a "wait" mode (wait for exit before enter), framer-motion is the right tool. However, D-08 specifies "simple fade+slide" — the simplified approach is acceptable:

- Enter animation: `animate-in fade-in slide-in-from-right-4 duration-150` — triggered on mount
- Exit animation: DROPPED — steps simply unmount immediately when `step` changes, new step fades in
- This is a deliberate UX simplification (D-08: "Simple fade+slide. Zero JS bundle cost.")

**tw-animate-css classes confirmed available:**
- `animate-in` — base enter class (required)
- `fade-in` — opacity 0 → 1
- `slide-in-from-right-4` — translate-x from right by 1rem
- `slide-in-from-left-4` — translate-x from left
- `duration-150` / `duration-200` / `duration-300` — animation speed

### Pattern 4: Recharts v3 Migration

**Version upgrade:** `recharts@2.15.4` → `recharts@3.8.1`

**Breaking changes relevant to the codebase** (verified from official migration guide):

| Change | Affects Zeta? | Action Required |
|--------|--------------|-----------------|
| `accessibilityLayer` now defaults to `true` | YES — 9 files already have it explicit | Explicit `accessibilityLayer` props become redundant but harmless. No breakage. |
| `CategoricalChartState` removed | NO — no file uses it | None |
| `activeIndex` prop removed from Area | NO — no file uses it | None |
| `blendStroke` removed from Pie | NO — not used | None |
| `ref.current.current` removed from ResponsiveContainer | Check — `sparkline.tsx` uses `ResponsiveContainer` | Audit each `ResponsiveContainer` usage |
| `alwaysShow` on reference lines removed | NO — not used | None |
| `isFront` removed | NO — not used | None |
| Tooltip label: `undefined \| string \| number` | Potential TypeScript errors | Fix types if `pnpm build` fails |
| Area `connectNulls`: nulls treated as 0 | LOW risk — no charts explicitly use `connectNulls` | Verify visually |
| Y-axis renders alphabetically by `yAxisId` | LOW risk — most charts have single Y-axis | None expected |

**Color format — CONFIRMED NO CHANGE NEEDED:**
The codebase already uses `var(--chart-1)` through `var(--chart-5)` format (not `hsl(var(--chart-1))`). Verified in:
- `daily-spending-chart.tsx:27` — `"var(--chart-5)"`
- `burn-rate-card.tsx:27` — `"var(--chart-1)"`
- `debt-simulator.tsx:175` — `"var(--chart-1)"`, `"var(--chart-2)"`
- `detail-step.tsx` — `var(--chart-${(i % 5) + 1})`

D-10 ("update from `hsl(var(--chart-1))` to `var(--chart-1)`") has zero files to fix — the format is already correct. The decision is still valid as a gate/audit step, but no rewrites needed.

### Pattern 5: Content-Shaped Skeletons

**What:** Replace generic `<div className="h-64 rounded-xl bg-muted animate-pulse" />` with skeletons that mirror the real component structure.

**Core primitive** (already exists in shadcn/ui at `webapp/src/components/ui/skeleton.tsx`):
```typescript
// Use the existing Skeleton component from shadcn
import { Skeleton } from "@/components/ui/skeleton"
// or inline: <div className="rounded-md bg-muted animate-pulse" />
```

**Skeleton design principles:**
- Same height as real content (prevents layout shift per D-13)
- Match the structural layout (card header + chart area + legend row)
- Use `animate-pulse` (D-14)
- Named exports from a `*-skeleton.tsx` file or inline in the `fallback` prop

**Height references** (derived from actual components):
- `CategoryDonut`: renders inside a Card with `h-[280px]` container → skeleton: `h-[280px]`
- `BurnRateCard`: full Card with AreaChart at ~200px → skeleton: header bar + `h-[200px]` chart area
- `AccountsOverview`: list of account rows → skeleton: header + N × (circle + 2 lines) rows
- `BudgetPaceChart`: Card with BarChart → skeleton: header + `h-[240px]` bar area
- `Sparkline`: small `height={32}` inline → skeleton: `h-8 w-24 rounded`
- Heatmap (`ActividadHeatmap`): grid of day cells → skeleton: `h-40 rounded-xl` (grid pattern)

### Anti-Patterns to Avoid

- **Dynamic import inside render:** `const X = dynamic(...)` must be at module top level, not inside the component function body — creates a new dynamic import on every render
- **Missing `ssr: false` on recharts:** Recharts uses `window`/DOM APIs — SSR will throw "window is not defined"
- **Skeleton height mismatch:** A skeleton shorter than the real content causes layout shift when content loads — always measure real height and match it
- **Tier 2 data passed as props to mobile:** `MobileDashboard` currently receives all data as props from the page. After the tier split, tier 1 data (heroData, healthMetersData) stays as props; tier 2 data must move into async sub-components inside `MobileDashboard` or new sibling components
- **`Promise.all` inside `<Suspense>` boundary:** If multiple tier 2 sub-components each await their own data inside one `<Suspense>` boundary, they stream together. If separate boundaries, they each stream independently. Use per-section boundaries (D-02: "grouped per dashboard section")

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart lazy-loading | Custom `IntersectionObserver` or manual import() | `next/dynamic({ ssr: false })` | Next.js handles chunking, loading state, hydration edge cases |
| Skeleton component | Custom animation | shadcn `<Skeleton>` or `animate-pulse` div | Already in project, consistent with design system |
| Step transition animation | Custom `useEffect` + `requestAnimationFrame` | tw-animate-css classes | Zero JS cost, same visual result |
| TypeScript fix for recharts v3 types | `as any` casts | Fix the actual prop type (usually trivial) | Build gate enforces no `any`; `pnpm build` will catch it |

**Key insight:** Every problem in this phase has an existing solution in the stack. This is removal and configuration work, not feature development.

---

## Common Pitfalls

### Pitfall 1: Dynamic Import Without `ssr: false` on Recharts

**What goes wrong:** Next.js attempts to render the chart during SSR → `ReferenceError: window is not defined` or `Error: ResizeObserver is not defined`.

**Why it happens:** Recharts uses browser-only APIs (`ResizeObserver`, `window.addEventListener`) at module initialization.

**How to avoid:** Always include `ssr: false` in the dynamic options object.

**Warning signs:** Build passes but runtime throws hydration errors in development; `pnpm build` may pass but the page crashes on first load.

### Pitfall 2: Recharts v3 TypeScript Type Errors

**What goes wrong:** `pnpm build` fails after recharts upgrade with type errors on `Tooltip`, `Legend`, or event handler props.

**Why it happens:** Recharts v3 tightened types, especially for `Tooltip` content components (use `TooltipContentProps` not `TooltipProps`) and event handlers (keyboard events no longer passed to `onMouseMove`).

**How to avoid:** After `pnpm add recharts@3.8.1`, run `pnpm build` immediately before editing any chart files — this gives a clean baseline of type errors to fix. The `chart.tsx` component uses `RechartsPrimitive.Tooltip` which may surface type changes.

**Warning signs:** Type errors on `TooltipProps`, `onMouseMove`, `CategoricalChartState`.

### Pitfall 3: `accessibilityLayer` Duplicate Behavior

**What goes wrong:** 9 chart files already have `accessibilityLayer` as an explicit boolean prop. After upgrading to v3 where it defaults to `true`, the behavior is unchanged but the explicit prop is redundant.

**Why it happens:** shadcn's recommended pattern was to add `accessibilityLayer` explicitly, which was correct for v2. v3 makes it the default.

**How to avoid:** No action required — harmless redundancy. If cleaning up, remove the explicit `accessibilityLayer` props from the 9 files. Not required for correctness.

### Pitfall 4: Mobile Dashboard Prop-Thread Breaking

**What goes wrong:** After removing `mobileAllocationData` and `mobileDebtCountdownData` from the page `Promise.all`, any code that still passes them as props to `MobileDashboard` will pass `undefined`.

**Why it happens:** D-03 says to refactor `MobileDashboard` to use Suspense sub-components, but if the refactor is incomplete, props that the component still reads will be undefined.

**How to avoid:** The refactor of `MobileDashboard` must be atomic — remove the tier 2 props from the interface AND the page call-site at the same time as introducing the async sub-components.

### Pitfall 5: framer-motion Removal Leaves Dead Imports

**What goes wrong:** After removing `framer-motion` from `package.json`, `pnpm build` fails if any file still imports from it.

**Why it happens:** The CONCERNS.md falsely claimed "62 import sites" — confirmed by actual grep: **only 1 file** imports framer-motion (`webapp/src/app/onboarding/page.tsx`, line 5). This is the only file that needs editing.

**How to avoid:** After removing `framer-motion` from `package.json` and updating the onboarding page, run `pnpm build` to confirm no other imports remain.

### Pitfall 6: Skeleton Height Mismatch Causes Layout Shift (CLS)

**What goes wrong:** Charts load in and the page jumps because the skeleton was shorter/taller than the actual content.

**Why it happens:** Skeleton heights are guessed rather than measured.

**How to avoid:** For each chart component's skeleton, measure the actual rendered height. Charts wrapped in `ChartContainer` use `aspect-video` (16:9) by default — for a 600px container, height ≈ 338px. Sparkline is 32px. Per-section heights are documented in the Architecture Patterns section above.

---

## Code Examples

### Dynamic Import with Content-Shaped Loading

```typescript
// Source: Established codebase pattern (scenario-planner.tsx)
const CategoryDonut = dynamic(
  () => import("@/components/charts/category-donut").then((m) => ({ default: m.CategoryDonut })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-2">
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        <div className="h-[280px] w-full rounded-xl bg-muted animate-pulse" />
        <div className="flex gap-2 justify-center">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-3 w-16 rounded bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    ),
  }
);
```

### Tier 2 Async Sub-Component

```typescript
// New file: webapp/src/components/dashboard/accounts-overview-section.tsx
// (Or inline async function in dashboard/page.tsx)
async function AccountsSection() {
  const accountsData = await getAccountsWithSparklineData();
  return <AccountsOverview data={accountsData} picker={<DashboardAccountPicker ... />} />;
}

// In page:
<Suspense fallback={<AccountsSectionSkeleton />}>
  <AccountsSection />
</Suspense>
```

### CSS Step Transition (replaces framer-motion)

```typescript
// Replace:
// <motion.div key="step1" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>

// With:
{step === 1 && (
  <div key="step1" className="animate-in fade-in slide-in-from-right-4 duration-200">
    <Card>...</Card>
  </div>
)}
```

### Recharts v3 Tooltip Type Fix (if needed)

```typescript
// v2: CustomTooltip: React.FC<TooltipProps<...>>
// v3: CustomTooltip: React.FC<TooltipContentProps<...>>
import type { TooltipContentProps } from "recharts";

function CustomTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  // ...
}
```

### Content-Shaped Burn Rate Skeleton

```typescript
function BurnRateSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="h-5 w-28 rounded bg-muted animate-pulse" />
        <div className="h-4 w-16 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full rounded-lg bg-muted animate-pulse" />
        <div className="mt-3 flex gap-4">
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts v2: `accessibilityLayer` optional prop | Recharts v3: `accessibilityLayer` defaults to `true` | v3.0.0 | Explicit props become redundant; no behavior change |
| Recharts v2: `TooltipProps` for custom content | Recharts v3: `TooltipContentProps` | v3.0.0 | TypeScript type error if using old import name |
| Recharts v2: `react-smooth` dependency | Recharts v3: animations self-contained | v3.0.0 | Slightly smaller dependency tree |
| framer-motion: full animation framework | tw-animate-css: CSS-only primitives | N/A | Removes ~100 KB from bundle |

**Deprecated/outdated:**
- `framer-motion` import in `onboarding/page.tsx`: remove entirely; replaced with Tailwind classes
- `recharts@2.15.4`: upgrade to `recharts@3.8.1`

---

## Open Questions

1. **`MobileDashboard` tier 2 refactor scope**
   - What we know: `MobileDashboard` currently receives `burnRateData`, `healthMetersData`, `allocationData`, `debtCountdownData`, `cashFlowStrip` all as props. Tier 1 keeps `heroData` and `healthMetersData`. Tier 2 (`burnRateData`, `allocationData`, `debtCountdownData`) must move.
   - What's unclear: Whether to create new async sub-components inside `MobileDashboard` (making it a mix of sync+Suspense), or split mobile into a thin wrapper that delegates to async sub-components.
   - Recommendation: The simplest approach — keep `MobileDashboard` as a "use client" shell for layout, and introduce async Server Component siblings `<MobileBurnRateSection>`, `<MobileAllocationSection>`, `<MobileDebtSection>` that are rendered by the page inside `<Suspense>`. The mobile layout div in `page.tsx` becomes a Suspense-orchestrated layout rather than a single monolithic component.

2. **`cashflowData` is used for both CashFlowHeroStrip (tier 1 data) and FlujoCharts (tier 2)**
   - What we know: `cashflowData` is fetched in the current `Promise.all` and used to derive `cfIncome`, `cfExpenses`, `cfFixed`, `cfVariable`, `cfRemaining` for the `CashFlowHeroStrip` component — which is in the tier 1 "above the fold" section. It's also passed to `FlujoCharts`.
   - What's unclear: Is `CashFlowHeroStrip` truly tier 1 (should it render immediately with hero data), or can it be tier 2?
   - Recommendation: D-01 says tier 1 is `getDashboardHeroData` + `getHealthMeters`. `CashFlowHeroStrip` is positioned between the hero and the niveles section — if it's above the fold, it should stay tier 1 or its own lightweight fetch. Given `getMonthlyCashflow` is already called in `getDashboardHeroData` or close to it, the planner should decide: either accept one extra tier 1 fetch or defer `CashFlowHeroStrip` to tier 2 with a skeleton.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config changes (package version bump, component refactors). No external services, databases, or CLI tools beyond pnpm are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | None detected (v2 TEST requirement — not yet configured) |
| Quick run command | `cd webapp && pnpm vitest run` (once config exists) |
| Full suite command | `cd webapp && pnpm vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | Tier 1 data only awaited at page level (no tier 2 in Promise.all) | manual-only | Code inspection — `Promise.all` in page.tsx contains exactly 2 items | N/A |
| PERF-02 | No recharts import in initial bundle | manual-only | `pnpm build` then inspect `.next/static/chunks/` — no recharts in page chunk | N/A |
| PERF-03 | framer-motion absent from package.json | automated | `grep -r "framer-motion" webapp/package.json` returns nothing | N/A |
| PERF-04 | recharts version = 3.x and `pnpm build` passes | automated | `pnpm build` clean pass | N/A |
| PERF-05 | Each Suspense fallback has structured skeleton (not single div) | manual-only | Visual inspection — fallbacks have card+content structure | N/A |

**Note:** These are structural/architectural changes — they do not have unit-testable behaviors in the traditional sense. The primary verification gates are:
1. `pnpm build` — catches TypeScript errors from recharts v3 type changes
2. Visual inspection in dev — confirms skeletons render before data loads
3. Bundle analysis (optional) — confirms recharts is not in initial chunk

### Sampling Rate

- **Per task commit:** `cd webapp && pnpm build` (must be clean)
- **Per wave merge:** `cd webapp && pnpm build` (same)
- **Phase gate:** Full build green + visual check of dashboard loading sequence

### Wave 0 Gaps

None — existing build infrastructure covers all phase verification. No new test files needed. The phase-level gate is `pnpm build` passing after each of the four work streams.

---

## Sources

### Primary (HIGH confidence)

- Official recharts v3 migration guide: https://github.com/recharts/recharts/wiki/3.0-migration-guide
- recharts v3.0.0 release notes: https://github.com/recharts/recharts/releases/tag/v3.0.0
- `npm view recharts version` → 3.8.1 (registry, 2026-03-26)
- tw-animate-css docs: https://github.com/Wombosvideo/tw-animate-css/blob/main/docs/animations/in-out.md
- Direct codebase audit: all 17 recharts files, `dashboard/page.tsx`, `onboarding/page.tsx`, `mobile-dashboard.tsx`

### Secondary (MEDIUM confidence)

- recharts v3 discussion thread: https://github.com/recharts/recharts/discussions/5984 — confirms `accessibilityLayer` default-true behavior
- tw-animate-css GitHub README — confirms `animate-in fade-in slide-in-from-right-N duration-N` class naming

### Tertiary (LOW confidence)

- CONCERNS.md claimed "62 framer-motion import sites" — disproven by actual grep (1 file). The CONCERNS.md was written before the framer-motion audit was done; it was likely counting something else. **Verified:** only 1 file imports framer-motion.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via npm registry and direct codebase inspection
- Architecture (Suspense tier split): HIGH — existing pattern already in place for 4 sections
- Architecture (next/dynamic): HIGH — 5 existing usages in codebase, established pattern
- Architecture (framer-motion removal): HIGH — 1 file confirmed by grep, straightforward substitution
- Recharts v3 migration: HIGH — official migration guide consulted, breaking changes audited against actual file content
- Skeletons: HIGH — shadcn Skeleton component already exists, animate-pulse pattern confirmed
- Open question on cashflowData / CashFlowHeroStrip tier: MEDIUM — planner must decide

**Research date:** 2026-03-26
**Valid until:** 2026-06-26 (recharts v3 is stable; Next.js dynamic import API is stable)
