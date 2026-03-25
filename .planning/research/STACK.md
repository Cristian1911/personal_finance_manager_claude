# Technology Stack

**Project:** Zeta — Polish & Refinement Milestone
**Researched:** 2026-03-25
**Research mode:** Ecosystem

---

## Context: What the Codebase Actually Has

Before recommending changes, findings from reading the actual source (not just the PROJECT.md description):

| Item | PROJECT.md Claim | Actual State |
|------|-----------------|--------------|
| framer-motion usage | "62 imports, ~150KB" | **1 real import** (`onboarding/page.tsx`). Mobile components import from a local `motion.tsx` shim that is already a no-op (pure div wrappers). |
| recharts version | implied current | **v2.15.4** — still on v2, not v3. shadcn/ui chart component was updated to use Recharts v3. |
| framer-motion package | listed as `framer-motion` | `framer-motion: ^12.34.3` in package.json — this IS the renamed `motion` package (Framer renamed it in 2024). Import path `"framer-motion"` still works as a compat alias. |
| tw-animate-css | not mentioned | Already installed as dev dependency (`^1.4.0`). |

**This significantly changes recommendations.** The animation problem is nearly solved already. The chart problem is confined to the recharts v2 → v3 migration.

---

## Recommended Additions for This Milestone

### 1. Chart Library — Stay on Recharts, Migrate to v3

**Recommendation:** Upgrade `recharts` from 2.15.4 → 3.x. Do NOT replace it.

**Rationale:**

- shadcn/ui `chart.tsx` component is a thin Recharts wrapper (no abstraction lock-in — you own the copied component). shadcn officially moved to Recharts v3. The `chart.tsx` in this codebase uses `recharts@2.x` APIs; upgrading aligns it with upstream shadcn.
- Recharts v3 changed how CSS variables are referenced: use `var(--chart-1)` instead of `hsl(var(--chart-1))`. This is the only breaking change for Tailwind CSS custom properties.
- Recharts v3 gzipped: ~47 KB (v2 was ~47 KB; no major size regression). Already the heaviest chart dependency — but it IS the shadcn-integrated option, so there is no simpler path.
- The 17 files importing recharts are chart components. A library swap would require rewriting all 17. A v2→v3 migration is mostly a CSS variable string find-and-replace.
- Lazy-loading recharts is the performance fix (see Performance section below), not a library swap.

**Why NOT switch to Apache ECharts:** Would require rewriting 17 chart files. ECharts has a larger full bundle (100–350 KB) and requires explicit tree-shaking discipline. No existing integration path with shadcn/ui.

**Why NOT Chart.js / react-chartjs-2:** Requires a different component model (imperative canvas API). No synergy with shadcn's `ChartTooltip` / `ChartLegend` system.

**Confidence:** HIGH — based on reading the actual codebase + shadcn/ui official migration docs (confirmed Recharts v3 support via shadcn issue #7669).

| Technology | Current | Recommended | Purpose |
|------------|---------|-------------|---------|
| recharts | 2.15.4 | ^3.x | All chart components (17 files) |

---

### 2. Animation — Keep framer-motion, Fix the Single Import

**Recommendation:** Replace the one `framer-motion` import in `onboarding/page.tsx` with CSS transitions + Tailwind animate classes. Do NOT add another library.

**Rationale:**

- `framer-motion` is currently used in exactly **one file**. The mobile `motion.tsx` shim is already a no-op with no framer-motion dependency. The PROJECT.md's "62 imports" referred to an older state.
- The onboarding page uses `<motion.div>` for step transitions (slide/fade) — this is trivially replaceable with `tw-animate-css` classes (`animate-in fade-in slide-in-from-right-4`) which is **already installed** in the project.
- The `framer-motion` package is 34–47 KB minified for the base `motion` component. Removing it from the one usage site and relying on `tw-animate-css` (pure CSS, ~3 KB) is a clear win.
- If JavaScript-driven animation is ever needed in the future (e.g., gesture-based drag, spring physics), `motion/react` (the new import path for framer-motion v12+) supports `LazyMotion` + `domAnimation` to reduce footprint to ~19 KB. But this is not needed for the current use case.

**What NOT to use:**

- `@formkit/auto-animate` (v0.9.0, 3.28 KB gzipped): useful for list add/remove transitions but overkill if tw-animate-css already handles the onboarding transitions. Evaluate per-feature rather than as a project-wide add.
- GSAP: 69 KB minified, professional-grade, but entirely unnecessary for slide transitions in a single page.
- React Spring: physics-based, heavier than needed, and there is no existing physics animation need in this app.

**Concrete action:** Remove `framer-motion` from `package.json` after migrating `onboarding/page.tsx` to Tailwind animate classes.

**Confidence:** HIGH — verified by reading the source. The fix is surgical, not a library swap.

| Technology | Action | Replacement |
|------------|--------|-------------|
| framer-motion | Remove after migrating onboarding | `tw-animate-css` classes (already installed) |

---

### 3. Auto-Categorization — Extend the Existing Engine

**Recommendation:** Do NOT add a library. Extend `@zeta/shared/utils/auto-categorize.ts` with three improvements.

**Rationale:**

The existing engine (`auto-categorize.ts`) is already sound:
- Priority stack: USER_LEARNED (0.9) > SYSTEM_DEFAULT (0.7)
- Returns `null` on no match (explicit unmatched state, not silent misclassification)
- Pure TypeScript, no runtime dependencies, shared between webapp and mobile

The problems are data quality and matching robustness, not architecture:

1. **Keyword coverage is thin for Colombian bank PDF descriptions.** Bank transaction descriptions are often truncated, ALL_CAPS, or contain code prefixes (`*7890 PAGO PSE CODENSA`). The current `includes()` matching handles this correctly, but the keyword list is missing coverage for common Colombian merchants.

2. **No normalization before matching.** Accented characters (`é`, `á`), asterisks, trailing numbers, and bank-specific prefixes are not stripped before matching. Example: `"*7890 RESTAURANTE EL CORRAL"` won't match `"corral"` because no normalization exists.

3. **No regex rules.** Some transactions follow predictable patterns (e.g., `"PAGO TC BANCOLOMBIA 12345"` = debt payment) that a single keyword can't cleanly capture.

**Recommended extensions (no new packages):**

```typescript
// 1. Normalize before matching
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // strip accents
    .replace(/[*_\-\/\\]/g, " ")                         // replace separators
    .replace(/\b\d{4,}\b/g, "")                          // strip long numbers
    .replace(/\s+/g, " ")
    .trim();
}

// 2. Add regex rule support alongside keyword rules
interface RegexRule {
  pattern: RegExp;
  categoryId: string;
}

const REGEX_RULES: RegexRule[] = [
  { pattern: /pago\s+(tc|tarjeta|cred)/i, categoryId: CAT.PAGOS_DEUDA },
  { pattern: /\bnomina\b|\bsalario\b/i,   categoryId: CAT.SALARIO },
];

// 3. Add normalization-aware keyword matching
// (existing KEYWORD_RULES run on normalized string)
```

**If fuzzy matching is ever needed:** `fuse.js` (v7.x, ~7 KB gzipped) supports weighted multi-field search with configurable threshold. Apply to user-facing transaction search UI, NOT to the categorization engine — fuzzy matches in categorization create false positives. The engine should stay exact/regex only.

**Confidence:** HIGH — based on reading the existing engine source.

| Change | Type | File |
|--------|------|------|
| Add `normalize()` pre-processing | Code change | `packages/shared/src/utils/auto-categorize.ts` |
| Add `REGEX_RULES` array | Code change | same |
| Expand `KEYWORD_RULES` coverage | Data change | same |
| Consolidate `CAT` constants into exported object | Refactor | same, also eliminate duplicate definitions in other packages |

---

### 4. Dashboard UX Patterns — shadcn/ui Component Strategy

**Recommendation:** Use shadcn/ui's composition model with a strict three-layer architecture. No new UI libraries needed.

**Layer architecture:**

```
ui/           → raw shadcn primitives (Card, Badge, Progress, etc.)
blocks/       → domain compositions (HealthMeter, SpendingDonut, etc.)
dashboard/    → screen-level layout (DashboardHero, WidgetSlot, etc.)
```

The project already has this structure partially. The gaps are at the `blocks/` level — components like `health-meters-card.tsx` do both data formatting and layout, violating single responsibility.

**Patterns to adopt for the "Am I on track?" narrative:**

**Primary signal card:** A single-number hero widget showing the financial health score (0–100) with a color gradient (red → amber → green) and a one-line verdict string ("Estás en buen camino" / "Ojo con los gastos"). Built with `Card` + `Badge` + a `Progress` bar. No chart needed.

**Progressive disclosure:** Summary metric (always visible) → tappable card → detail drawer (Sheet). Never show full breakdowns on the dashboard surface. This is standard Radix/shadcn pattern: outer `Card` with `onClick` opens a `Sheet` with drill-down content.

**Budget pace bar:** A custom `Progress` subvariant showing budget pace (current spend vs. expected spend at this point in the month). A single CSS-variable-colored bar with a threshold marker. Recharts is overkill for this — use a native `div` with Tailwind width utilities.

**Status color system:** Use Tailwind CSS custom properties (already in the theme) for semantic status colors. Do NOT use `tailwind-merge` conditions inline — define `cva` variants:
```typescript
const healthVariants = cva("rounded-full px-2 py-0.5 text-xs font-medium", {
  variants: {
    status: {
      good:    "bg-emerald-100 text-emerald-800",
      warning: "bg-amber-100  text-amber-800",
      danger:  "bg-red-100    text-red-800",
    },
  },
});
```

**Suspense streaming for dashboard:** The dashboard fires 10+ parallel Supabase queries on cache miss. The fix is RSC Suspense boundaries per section, not a UI library. Each `<DashboardSection>` becomes an independent `async` RSC wrapped in `<Suspense fallback={<SkeletonCard />}>`.

**Confidence:** MEDIUM — shadcn/ui patterns from official docs + community examples verified. Suspense streaming from Next.js 15 App Router docs.

---

## Alternatives Considered and Rejected

| Category | Recommended | Alternative | Why Rejected |
|----------|-------------|-------------|--------------|
| Charts | recharts v3 upgrade | Apache ECharts | Requires rewriting 17 files; larger full bundle; no shadcn integration |
| Charts | recharts v3 upgrade | Chart.js / react-chartjs-2 | Imperative canvas API; breaks shadcn ChartTooltip pattern |
| Charts | recharts v3 upgrade | Visx | D3 primitives; too low-level; no benefit for existing chart types |
| Animation | Remove framer-motion | motion/react LazyMotion | Only one usage; CSS is sufficient; no need for a JS animation runtime |
| Animation | tw-animate-css (existing) | @formkit/auto-animate | Not needed for current transitions; evaluate if list animations become a need |
| Categorization | Extend existing engine | ts-pattern (5.9.0) | Adds a dependency to replace an `if/for` loop. Native TypeScript achieves the same result for this use case. |
| Categorization | Extend existing engine | fuse.js | Fuzzy matching creates false positives in categorization; keep exact/regex matching |

---

## No-New-Dependency Approach for Performance

The two performance problems (eager recharts load, dashboard query waterfall) are solvable without new packages:

**Problem 1: Chart library eager loading**
```typescript
// Replace: import { AreaChart, ... } from "recharts"
// With: dynamic import at component level
const AreaChart = dynamic(() => import("recharts").then(m => m.AreaChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px]" />,
});
```
`next/dynamic` is already available. No new library.

**Problem 2: Dashboard query waterfall**
```typescript
// Each section becomes an independent RSC:
<Suspense fallback={<HealthMeterSkeleton />}>
  <HealthMetersSection />     // fetches its own data
</Suspense>
<Suspense fallback={<FlujoDeSkeleton />}>
  <FlujoDeCajaSection />       // fetches its own data, doesn't block above
</Suspense>
```
`React.Suspense` + async RSC is Next.js 15 native. No new library.

---

## Installation Summary

```bash
# Upgrade recharts to v3
pnpm add recharts@^3

# No new packages — everything else is:
# - Code changes to auto-categorize.ts
# - Removing framer-motion after migrating onboarding/page.tsx
# - next/dynamic for lazy chart loading (already available)
# - React.Suspense for dashboard streaming (already available)
```

After removing the one framer-motion import and running `pnpm remove framer-motion`, the dependency tree loses one package entirely (~35 KB from client bundle).

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Recharts v3 upgrade path | HIGH | Read source (17 files), shadcn issue #7669 confirmed v3 support, official shadcn migration docs |
| framer-motion removal | HIGH | Read source (only 1 real import), `motion.tsx` shim is already no-op |
| Auto-categorize improvements | HIGH | Read full engine source, identified specific gaps |
| Dashboard UX patterns | MEDIUM | shadcn/ui official docs + community examples; specific health score layout is design work, not library work |
| Next.js Suspense streaming | MEDIUM | Next.js 15 App Router docs confirmed; specific query grouping TBD during implementation |

---

## Sources

- shadcn/ui chart migration (Recharts v3): https://github.com/shadcn-ui/ui/issues/7669
- motion.dev LazyMotion docs: https://motion.dev/docs/react-lazy-motion
- motion.dev bundle size: https://motion.dev/docs/react-reduce-bundle-size
- recharts npm (current v2.15.4 in lockfile): https://www.npmjs.com/package/recharts
- ts-pattern v5.9.0: https://github.com/gvergnaud/ts-pattern/releases/tag/v5.8.0
- fuse.js: https://www.fusejs.io/
- @formkit/auto-animate v0.9.0: https://bundlephobia.com/package/@formkit/auto-animate
- LogRocket React chart libraries 2025: https://blog.logrocket.com/best-react-chart-libraries-2025/
- LogRocket React animation libraries 2026: https://blog.logrocket.com/best-react-animation-libraries/
