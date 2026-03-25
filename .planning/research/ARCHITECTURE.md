# Architecture Patterns — Polish & Refinement Milestone

**Project:** Zeta — Personal Finance App
**Researched:** 2026-03-25
**Overall confidence:** HIGH (based on direct codebase analysis + official Next.js docs)

---

## Recommended Architecture

The existing architecture is fundamentally sound. The polish milestone does not require structural changes — it requires plugging three specific gaps: (1) Suspense placement is inconsistent across the dashboard page, (2) onboarding captured income but does not persist it in a way that health meters can reliably consume it, and (3) the categorization engine has no normalization layer before matching.

---

## Component Boundaries

### Layer Map (current + proposed changes)

```
Browser
  └── DashboardLayout (Server Component — auth + profile + nav shell)
        ├── Sidebar / Topbar / BottomTabBar  ← layout shell, renders immediately
        └── DashboardPage (Server Component)
              ├── [TIER 1 — INSTANT] Rendered before any awaits
              │     Header (static text)
              │     MonthSelector (no data dependency)
              │
              ├── [TIER 2 — FAST, ~50ms] await Promise.all([hero, accounts, config])
              │     DashboardHero          ← availableToSpend, liquid balance, obligations
              │     CashFlowHeroStrip      ← income/fixed/variable/remaining breakdown
              │     HealthMetersCard       ← 4 health meters (gasto/deuda/ahorro/colchon)
              │
              ├── [TIER 3 — STREAMED] async Server Component sections, each in own Suspense
              │     <Suspense fallback={<FlujoSkeleton />}>
              │       FlujoSection         ← FlujoWaterfall + FlujoCharts
              │     </Suspense>
              │
              │     <Suspense fallback={<PresupuestoSkeleton />}>
              │       PresupuestoSection   ← BudgetPace + Allocation + CategoryDonut
              │     </Suspense>
              │
              │     <Suspense fallback={<PatrimonioSkeleton />}>
              │       PatrimonioSection    ← DebtCountdown + DebtProgress + NetWorth
              │     </Suspense>
              │
              └── [TIER 4 — DEFERRED] remaining activity widgets
                    UpcomingPayments       ← already synchronous, low cost
                    AccountsOverview       ← sparkline data, medium cost
                    ActividadHeatmap       ← already Suspense-wrapped
```

### Key Component Boundaries

| Component | Responsibility | Data Reads From | Communicates With |
|-----------|---------------|-----------------|-------------------|
| `DashboardLayout` | Auth gate, nav shell, tab config | `profiles`, `accounts`, `categories` | All child pages |
| `DashboardPage` | Orchestrates tier 2 fetches, passes props down | `getHealthMeters`, `getDashboardHeroData`, `getAccounts`, `getMonthlyCashflow` | All dashboard sections |
| `DashboardHero` | Primary financial signal — "can I spend?" | Props only (no direct fetch) | None |
| `HealthMetersCard` | Four-axis health score display | Props only | `HealthMeterExpanded` (client modal) |
| `PresupuestoSection` | Budget analysis — async Server Component | `getDailyBudgetPace`, `getCategorySpending`, `get503020Allocation` | None |
| `PatrimonioSection` | Debt + net worth — async Server Component | `getDebtFreeCountdown`, `getInterestPaid`, `getDebtProgress`, `getNetWorthHistory` | None |
| `DashboardConfigProvider` | Widget visibility context | Props from page (profile.dashboard_config) | `WidgetSlot`, `DashboardSection` |
| `WidgetSlot` | Conditional rendering by widget config | Context only | None |
| Onboarding page | 6-step wizard, captures goal+income | State only (client), writes via `finishOnboarding` | `profiles` table |
| `getEstimatedIncome` action | Income source of truth for health meters | `profiles.monthly_salary` (profile path) OR INFLOW transactions (transaction path) | `getHealthMeters` |
| `autoCategorize` | Keyword-based category assignment | `@zeta/shared` KEYWORD_RULES + user rules from DB | Import wizard confirm step, `categorize` action |

---

## Data Flow

### Dashboard Loading (current vs recommended)

**Current state — problem:**
The dashboard page `await`s all 8 data sources simultaneously in one `Promise.all` before rendering anything. This means the user sees nothing until the slowest query (often `getHealthMeters` which itself fires 5 parallel sub-queries) completes. Total blocking time is dominated by the worst outlier.

**Recommended state — tiered rendering:**

```
Request arrives
  │
  ├── ~0ms: Layout shell painted (Sidebar, Topbar, BottomTabBar)
  │         loading.tsx skeleton already visible
  │
  ├── ~50-100ms: Tier 2 resolves (hero + config — React cache deduplication applies)
  │              DashboardHero, CashFlowHeroStrip, HealthMetersCard visible
  │              User can already answer "Am I on track?"
  │
  ├── ~150-300ms: Tier 3 streams in (Flujo, Presupuesto, Patrimonio)
  │               Each section has its own Suspense skeleton
  │               Sections appear independently as their data resolves
  │
  └── ~200-400ms: Tier 4 completes (heatmap, sparklines)
                  Activity section fills in last
```

**Implementation approach:**
- Move `getHealthMeters` and `getDashboardHeroData` into Tier 2 (awaited directly in page, no Suspense wrapper needed — these are fast because they use `React.cache()` and `"use cache"`)
- Extract `FlujoSection` as an async Server Component (mirroring the existing `PresupuestoSection` pattern)
- Keep `PresupuestoSection` and `PatrimonioSection` as existing async Server Components wrapped in `Suspense`
- The `FlujoWaterfall` and `FlujoCharts` are already individually Suspense-wrapped — consolidate them into a `FlujoSection` async Server Component to remove redundant per-widget Suspense boundaries

### Onboarding → Downstream Features Data Flow

**Current state — problem:**
`finishOnboarding` stores `estimated_monthly_income` on the `profiles` row. `getEstimatedIncome` checks `profiles.monthly_salary` (a different column). These are separate fields — income captured during onboarding does NOT feed health meters.

**Correct field mapping:**

```
Onboarding Step 3 captures:
  income (string input) → profileData.estimated_monthly_income → profiles.estimated_monthly_income

getEstimatedIncome reads:
  profiles.monthly_salary  ← WRONG FIELD
  fallback: INFLOW transactions (last 12 months average)

Health meter "deuda" uses:
  effectiveIncome = monthlyIncome ?? income (from cashflow)
  monthlyIncome comes from incomeEstimate.monthlyAverage
```

**Fix:** Add `profiles.estimated_monthly_income` as the third fallback in `getEstimatedIncome`:
```
Priority 1: profiles.monthly_salary (user-set precise salary)
Priority 2: profiles.estimated_monthly_income (onboarding estimate)
Priority 3: 12-month INFLOW transaction average
```

This is a single-line addition in `getEstimatedIncomeCached` and makes onboarding income immediately useful from day 1, before any transactions exist.

### Auto-Categorization Rules Engine Data Flow

**Current state:**

```
Transaction description (raw)
  └── autoCategorize(description, userRules)
        ├── lower = description.toLowerCase()
        ├── Check user rules (pattern.includes) — confidence 0.9
        └── Check KEYWORD_RULES (keyword.includes) — confidence 0.7
```

**Problem:** `description.toLowerCase().includes(keyword)` has high false-positive risk (e.g., "ARA" in "CLARA", "BAR" in "BARBERIA", "gas" in "BOGÁS"). No normalization or word boundary matching.

**Recommended improvement — normalization layer:**

```
Transaction description (raw)
  └── normalizeDescription(description)
        ├── toLowerCase()
        ├── Remove accents (NFD + replace /[\u0300-\u036f]/g, "")
        ├── Collapse whitespace
        └── Remove common bank noise tokens ("*", "REF:", "CTAS", "CTA", "NO.", digits-only tokens)
  └── autoCategorize(normalized, userRules)
        ├── Check user rules (same as now)
        └── Check KEYWORD_RULES with word-boundary aware matching:
              ' ' + keyword + ' ' OR keyword at start/end of string
              (avoids "ara" matching "compra" or "bar" matching "barberia")
```

Add `normalizeDescription` to `@zeta/shared/utils/auto-categorize.ts`. Export it so the import wizard confirm step can show normalized descriptions in the UI.

### Component Patterns Data Flow

**Consistent pattern across all feature screens:**

```
Screen (Server Component page)
  │
  ├── await parallel data fetches
  │     All independent queries in Promise.all
  │     Dependent queries sequential (unavoidable)
  │
  ├── Pass data as typed props to display components
  │     No data fetching in display components
  │     Display components are Server Components (no "use client") unless they need interaction
  │
  └── Interactive sub-components ("use client")
        Receive initial data as props
        Mutations via useActionState(action, initialState)
        Never call fetch() or supabase directly
```

---

## Patterns to Follow

### Pattern 1: Async Section Components (already used, needs expansion)

**What:** An async Server Component that fetches its own data and renders within a `Suspense` boundary in the parent page. Parallel queries use `Promise.all` internally.

**When:** Any dashboard section with 2+ widgets sharing related data that can stream independently of the hero section.

**Example (existing — PresupuestoSection):**
```typescript
// Correct: async Server Component, fetches its own data
export async function PresupuestoSection({ month, currency, ... }) {
  const [budgetPaceData, categoryData, allocationData] = await Promise.all([
    getDailyBudgetPace(month, currency),
    getCategorySpending(month, currency),
    get503020Allocation(month, currency),
  ]);
  return <DashboardSection ...>...</DashboardSection>;
}

// In page.tsx:
<Suspense fallback={<PresupuestoSkeleton />}>
  <PresupuestoSection month={month} currency={currency} ... />
</Suspense>
```

**Extend to:** `FlujoSection` (consolidating `FlujoWaterfall` + `FlujoCharts` + `BurnRateCard`)

### Pattern 2: Skeleton Fallbacks (meaningful, not generic)

**What:** Suspense fallbacks shaped like the content they replace — preserving visual layout, section header, and approximate widget heights.

**When:** Every `Suspense` boundary wrapping a dashboard section.

**Rule:** Fallback must render the `DashboardSection` title and skeleton cards that match the real widget grid, so there's no layout shift when content streams in.

```typescript
<Suspense
  fallback={
    <DashboardSection title="Flujo de caja" section="flujo">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    </DashboardSection>
  }
>
  <FlujoSection ... />
</Suspense>
```

### Pattern 3: React.cache for Shared Data (already used, extend to onboarding data)

**What:** Wrap actions in `React.cache()` so they deduplicate across the render tree when called multiple times with the same arguments.

**When:** Any action called from both a layout and a page, or from multiple sibling sections.

**Currently used:** `getHealthMeters` (uses `React.cache`)

**Should also apply to:** `getEstimatedIncome` (called from `getHealthMeters` indirectly, but also needed directly in dashboard for income display)

### Pattern 4: use cache + cacheTag for Slow Queries

**What:** The `"use cache"` directive in Next.js 15 caches the function output by input arguments. `cacheTag` tags it for on-demand invalidation.

**When:** Any expensive query that doesn't need real-time accuracy (charts, historical data, budgets).

**Currently used:** `getCategorySpendingCached`, `getMonthlyCashflowCached`, all chart actions.

**Pattern already established — apply consistently:**
```typescript
async function expensiveQueryCached(userId: string, month: string) {
  "use cache";
  cacheTag("dashboard:charts");
  cacheLife("zeta"); // 300s stale, 300s revalidate, 3600s expire
  // ... query
}
```

### Pattern 5: Onboarding as Config Capture (not just profile fill)

**What:** Each onboarding step captures data that directly powers a downstream feature. The connection must be explicit and tested.

**Feature dependency map:**
```
Step 1: app_purpose → DashboardConfig widget visibility (getDefaultConfig)
Step 2: preferred_currency → all formatCurrency calls, exchange rate base
Step 3: estimated_monthly_income → health meter "deuda" DTI denominator (AFTER fix)
Step 3: estimated_monthly_expenses → budget suggestions (currently unused — opportunity)
Step 4: dashboardConfig → profiles.dashboard_config → DashboardConfigProvider
Step 5: first account → enables hasAccounts = true → unlocks full dashboard (not starterMode)
```

**Build order implication:** The income fix (step 3 → health meters) must be done before onboarding redesign work, so the redesign can validate that health meters actually show data for new users.

### Pattern 6: Error Boundaries at Segment Level

**What:** `error.tsx` files at the route segment level that catch uncaught errors and render a recovery UI without destroying the shell layout.

**When:** Every route in `(dashboard)/` should have an `error.tsx`. Currently zero exist.

**Standard pattern:**
```typescript
// (dashboard)/dashboard/error.tsx
"use client";
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <p className="text-sm text-muted-foreground">Algo salió mal al cargar el dashboard.</p>
      <button onClick={reset}>Intentar de nuevo</button>
    </div>
  );
}
```

**Placement:** One `error.tsx` at `(dashboard)/error.tsx` (shared for all dashboard routes) plus specific ones for `/transactions` and `/import` where data errors are most likely.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic await in Dashboard Page

**What:** All 8+ queries in a single `Promise.all` at the top of `page.tsx`, blocking all rendering until the slowest resolves.

**Why bad:** The slowest query (e.g., `getHealthMeters` which calls 5 sub-queries) blocks the entire page. User sees nothing — not even the hero — until all sections are ready.

**Instead:** Tier the fetches. Tier 2 (hero + health) awaited directly. Tier 3+ extracted to async section components wrapped in `Suspense`.

### Anti-Pattern 2: Per-Widget Suspense Boundaries

**What:** Wrapping each individual widget in its own `Suspense` boundary (as currently done for `FlujoWaterfall` and `FlujoCharts`).

**Why bad:** Creates fragmented loading experience — widgets pop in one by one in different positions, causing cumulative layout shift. Section skeleton doesn't match the staggered reveal.

**Instead:** One `Suspense` per section. The section's async Server Component fetches all its widgets' data in parallel internally. The entire section streams in together.

### Anti-Pattern 3: Incomplete Income Source Chain

**What:** The `getEstimatedIncome` action only checks `profiles.monthly_salary`, skipping `profiles.estimated_monthly_income` that onboarding sets. New users who haven't manually set a salary AND have no transactions yet get `null` income, which makes health meter DTI show 0% (misleading — not "excellent", just "no data").

**Instead:** Three-tier fallback: `monthly_salary` → `estimated_monthly_income` → transaction average → null.

### Anti-Pattern 4: Simple substring matching in autoCategorize

**What:** `lower.includes("gas")` will match "gas natural" but also "bogás", "pagas", "gas station". Single-character-context matching creates false positives at scale.

**Instead:** Word boundary matching using `' ' + keyword + ' '` OR anchoring to start/end, combined with a normalization pass that strips bank noise tokens before matching.

### Anti-Pattern 5: Onboarding as a monolithic client component

**What:** The entire 6-step onboarding flow is a single `"use client"` component with all step state in `useState`. This means: Framer Motion animations (`~150KB`), all step JSX, and all validation logic loaded upfront.

**Why bad:** Performance on first visit (onboarding is a cold-start scenario). Also makes it hard to add URL-based step routing later.

**Instead (future, not required for this milestone):** URL-based steps using `(onboarding)/step-1/page.tsx`, `step-2/page.tsx` etc., with Server Components for each step's static content and thin Client Components only for interactive inputs. For this milestone, at minimum: lazy-load Framer Motion with `dynamic(() => import('framer-motion'), { ssr: false })`.

---

## Scalability Considerations

| Concern | Current State | Recommended Approach |
|---------|--------------|---------------------|
| Dashboard query count | 8 parallel queries, all blocking | Tiered: 3 blocking (hero), 3+ streamed (sections) |
| Chart library loading | recharts loaded eagerly (~450KB) | `next/dynamic` with `ssr: false` for all chart components |
| Animation library | framer-motion 62 imports (~150KB) | Lazy-load onboarding specifically; consider replacing page transitions with CSS |
| Health meter accuracy | Falls back to 0% when income is unknown | Three-tier income fallback; show "Datos insuficientes" vs wrong 0% |
| Category rule coverage | 21 categories, ~100 keywords, no normalization | Add normalization + ~50 more keywords per Colombian market; word-boundary matching |
| Error resilience | Zero error boundaries in (dashboard) routes | Segment-level error.tsx files with retry |

---

## Suggested Build Order

The build order matters because components have data dependencies:

**Phase 1 — Income fix (unblocks all downstream health work)**
1. Fix `getEstimatedIncome` to read `estimated_monthly_income` as priority 2 fallback
2. Verify health meters show correct DTI for new users with only onboarding income

**Phase 2 — Categorization normalization (unblocks import improvements)**
1. Add `normalizeDescription` to `@zeta/shared`
2. Update `autoCategorize` to use normalized descriptions + word-boundary matching
3. Expand KEYWORD_RULES with more Colombian merchant coverage

**Phase 3 — Dashboard Suspense restructuring (unblocks information hierarchy work)**
1. Extract `FlujoSection` async Server Component (mirrors existing PresupuestoSection pattern)
2. Move `FlujoWaterfall` + `FlujoCharts` + `BurnRateCard` into `FlujoSection`
3. Update dashboard page to Tier 2 pattern (await hero + health directly, Suspense for sections)
4. Add meaningful skeleton fallbacks for each section
5. Add `error.tsx` at `(dashboard)/error.tsx` level

**Phase 4 — Onboarding audit + redesign (requires Phase 1 to be in place)**
1. Audit current flow (HTML walkthrough)
2. Validate income field is now correctly wired (Phase 1)
3. Redesign based on findings — goal is to clearly show which features each step unlocks
4. Add `goals` field (savings target, debt payoff target) to complete the 50/30/20 → budget connection

**Phase 5 — Component consistency pass**
1. After Phases 1-4, audit all screens for spacing/typography inconsistencies
2. Extract repeated card patterns into shared components

---

## Dependency Graph for Components

```
profiles.estimated_monthly_income
  └── getEstimatedIncome (fix needed)
        └── getHealthMeters
              └── HealthMetersCard
              └── PresupuestoSection (SavingsRateWidget)
              └── PatrimonioSection (EmergencyFundWidget)

autoCategorize (@zeta/shared)
  └── Import wizard confirm step
  └── categorize bulk action

DashboardConfigProvider (context)
  └── DashboardSection (collapse/expand)
  └── WidgetSlot (visibility toggle)
  └── populated from: profiles.dashboard_config (set in onboarding Step 4)

FlujoSection (new, to be extracted)
  └── getMonthlyCashflow
  └── getDashboardHeroData (already fetched in Tier 2 — React.cache deduplication)
  └── getBurnRate
```

---

## Sources

- Next.js 15 official docs on data fetching patterns and streaming: https://nextjs.org/docs/app/getting-started/fetching-data (fetched 2026-03-25, version 16.2.1)
- Next.js `use cache` directive: https://nextjs.org/docs/app/api-reference/directives/use-cache
- Next.js `cacheTag` / `revalidateTag`: https://nextjs.org/docs/app/api-reference/functions/cacheTag
- Existing codebase analysis: `webapp/src/app/(dashboard)/dashboard/page.tsx`, `actions/health-meters.ts`, `actions/income.ts`, `actions/onboarding.ts`, `packages/shared/src/utils/auto-categorize.ts`
- Existing architecture: `.planning/codebase/ARCHITECTURE.md`
