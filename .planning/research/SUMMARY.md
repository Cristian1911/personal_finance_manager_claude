# Project Research Summary

**Project:** Zeta — Polish & Refinement Milestone
**Domain:** Personal finance app UX polish / incremental redesign
**Researched:** 2026-03-25
**Confidence:** HIGH

## Executive Summary

Zeta is a production personal finance app (Next.js 15 / App Router, Supabase, Tailwind v4, shadcn/ui) that already ships a dashboard with health widgets, 50/30/20 budgets, a debt payoff planner, rule-based auto-categorization, a PDF import wizard, and multi-step onboarding. The polish milestone is not a rewrite — it is a targeted pass that closes three structural gaps (broken income data flow, inconsistent Suspense placement, and weak categorization normalization) while elevating the UX from "data displayed" to "story told." The recommended approach follows the app's existing architecture without introducing new libraries: upgrade recharts from v2 to v3, remove the single framer-motion import, add a normalization layer to the categorization engine, and restructure dashboard loading into tiered Suspense sections.

The central product problem is narrative clarity, not feature completeness. Zeta's users already have the data they need; they cannot easily extract the answer to "Am I on track this month?" from the current layout. The research is clear that premium personal finance apps (Monarch, Copilot, YNAB) earn user trust through a single synthesized status signal at the top of the dashboard, color-coded categories used consistently across every view, and friendly framing that avoids financial guilt. Every high-leverage UX improvement in this milestone flows from one dependency: capturing income during onboarding and wiring it correctly to the health meters. That single bug fix unlocks the meaningful health score, the 50/30/20 targets, and the dashboard narrative widget.

Key risks are behavioral, not technical. The biggest danger in a polish pass is refactoring component structure and silently breaking server action wiring — there is zero automated test coverage to catch this. The second risk is onboarding redesign that adds fields rather than removing them, producing worse income data quality than the current flow. Both risks are manageable with explicit pre-refactor checklists and the rule that onboarding should ask only the minimum needed for the dashboard to render meaningfully on day one.

## Key Findings

### Recommended Stack

The existing stack is correct and stable. No architectural replacement is warranted. The only dependency change is upgrading recharts from 2.15.4 to ^3.x (required to align with shadcn/ui's official chart component, which moved to Recharts v3 in 2024 — the breaking change is confined to CSS variable string format: `var(--chart-1)` instead of `hsl(var(--chart-1))`). The framer-motion package appears to have 62 imports per project notes, but codebase inspection reveals only **one real import** in `onboarding/page.tsx`; the mobile `motion.tsx` shim is already a no-op. Replacing that single import with `tw-animate-css` classes (already installed as a dev dependency) and removing the package eliminates ~35KB from the client bundle.

**Core technologies:**
- `recharts ^3.x`: All 17 chart components — upgrade from v2; CSS variable rename is the only breaking change
- `tw-animate-css` (existing, ~3KB): Replaces framer-motion for onboarding step transitions
- `next/dynamic` (existing): Lazy-load all chart components — prevents recharts from blocking first paint
- `React.Suspense` + async RSC (existing): Tiered dashboard rendering — hero loads at ~50ms, charts stream after
- `@zeta/shared/utils/auto-categorize.ts` (extend, no new deps): Add normalization + word-boundary matching + regex rules

**No new libraries needed.** Every performance and UX improvement is achievable with what is already installed.

### Expected Features

The features research distinguishes between what is broken/missing vs. what would add value. The income wiring bug is the highest-leverage fix; it is a prerequisite for most dashboard improvements.

**Must have (table stakes):**
- **Income captured and wired during onboarding** — `finishOnboarding` writes to `estimated_monthly_income` but `getEstimatedIncome` reads `monthly_salary` (different column). New users see a broken health score. Fix is a one-line addition in `getEstimatedIncomeCached`.
- **Single-sentence dashboard status** — the "Am I on track?" headline. Requires income fix first. Pure information hierarchy + copy work.
- **Inline category quick-edit on transaction rows** — category popover on tap; removes 3 navigation steps per correction. Expected by anyone who has used Copilot or Lunch Money.
- **Unreviewed transactions badge + review queue** — auto-categorize ran, human must confirm exceptions. Badge count on dashboard, dedicated queue view. Copilot's defining UX pattern.
- **Debt-free countdown date as headline** — the payoff simulation already runs; promote the projected date to above-the-fold on the debt screen.
- **Empty states with CTAs** — one per major screen (transactions, budget, debts, categories). Currently blank = no guidance.
- **Consistent error handling** — `error.tsx` and `not-found.tsx` files are confirmed missing. Broken routes show crashes, not recovery UI.
- **Friendly UX copy pass** — audit all status labels and health score descriptions; reframe from guilt to encouragement (YNAB model).

**Should have (competitive differentiators):**
- **Financial health single score (0–100 or A–D grade)** — synthesizes existing 4-axis meters into one number with a one-line verdict. Requires income fix first.
- **Dashboard narrative widget (rule-based "insight of the day")** — deterministic comparison: current month vs. previous month per category, flag deviations >20%. No AI needed.
- **Monthly spending comparison bar** — this month vs. last month per category. Recharts bar chart with existing data.
- **Debt payoff strategy comparison side-by-side** — avalanche vs. snowball on one screen; turns a setting into an insight.
- **Rule management screen** — view, edit, delete categorization rules. Copilot's biggest UX complaint is inability to manage rules; Zeta's engine already supports this.
- **Import session summary** — "47 transacciones importadas, 12 sin categoría, 3 duplicados ignorados." Enhancement to existing Results step.

**Defer to later milestones:**
- Category spending heatmap (high complexity, medium value)
- Health score trend line (requires score snapshot schema change)
- Dark mode (doubles every color decision; separate milestone)
- Real-time bank feeds (no open banking API in Colombia)
- Fully customizable dashboard (anti-feature for a single-user app)

### Architecture Approach

The architecture is fundamentally sound. The milestone addresses three specific structural gaps without changing the overall pattern. Dashboard loading should be restructured into four tiers: (1) instant shell/nav, (2) awaited hero + health meters at ~50ms using `React.cache`, (3) streamed section components (Flujo, Presupuesto, Patrimonio) each wrapped in their own `Suspense` boundary, and (4) deferred activity widgets. The `FlujoSection` async Server Component needs to be extracted to mirror the existing `PresupuestoSection` pattern. Error boundaries (`error.tsx`) must be added at the `(dashboard)/` segment level — zero currently exist.

**Major components:**
1. `DashboardPage` (Server Component) — orchestrates Tier 2 fetches; passes props to hero + health; wraps Tier 3+ sections in Suspense
2. `FlujoSection` / `PresupuestoSection` / `PatrimonioSection` — async Server Components that fetch their own data in parallel; stream independently
3. `getEstimatedIncomeCached` — income source of truth; needs three-tier fallback: `monthly_salary` → `estimated_monthly_income` → transaction 12-month average
4. `autoCategorize` in `@zeta/shared` — categorization engine; needs `normalizeDescription()` pre-processing + word-boundary matching + regex rules
5. `DashboardConfigProvider` — widget visibility context populated from `profiles.dashboard_config`

### Critical Pitfalls

1. **Server action wiring broken silently during visual refactors** — with 29 server actions and no test coverage, restructuring a component can quietly drop a `useActionState` binding or `revalidatePath` call. Prevention: enumerate which server actions every component-under-refactor touches; manually smoke-test the most-used flows (import wizard, transaction form, categorize inbox) after any change to those screens.

2. **Auto-categorize overwrites manual user intent** — when the rules engine is improved with better patterns, it can overwrite a category the user manually set. Prevention: add a `manually_categorized` flag (or `categorized_by` enum) to transactions; never run auto-categorize over rows where this is true. Import pipeline should only categorize uncategorized transactions.

3. **Middleware security gaps widened by new routes** — several existing routes (`/import`, `/categorizar`, `/deudas`, `/recurrentes`, `/gestionar`) are already missing from the `protectedPaths` allow-list. Any new route added during the milestone inherits this gap. Prevention: fix existing gaps first by switching to a deny-by-default pattern protecting all `/(dashboard)/` paths by prefix.

4. **Onboarding redesign that adds fields instead of removing them** — each additional onboarding step compounds drop-off and produces worse estimate quality. Prevention: capture only income, currency, and one account during onboarding; defer debt count, tab preference, and expenses estimate to post-onboarding contextual prompts.

5. **Performance regression from eager chart/animation imports** — recharts (~450KB) loaded eagerly blocks first paint. Prevention: establish a hard rule that no chart component is ever statically imported at the page level; all must use `next/dynamic({ ssr: false, loading: () => <Skeleton /> })`.

## Implications for Roadmap

Based on combined research, the build order is determined by data dependencies, not feature preference. Income fix unlocks everything else. Categorization normalization unblocks import quality. Suspense restructuring unblocks information hierarchy. Onboarding can only be meaningfully redesigned after income is correctly wired. Visual polish should come last, after structure is stable.

### Phase 1: Income Fix + Security Foundation

**Rationale:** Income wiring is the single highest-leverage change in the codebase. It is a prerequisite for the health score, 50/30/20 targets, budget pace calculations, and the dashboard narrative. It is also trivial (one line in `getEstimatedIncomeCached`). Security hardening (middleware gaps) should be resolved first as a hygiene baseline before any new routes are added.
**Delivers:** Working health meters for new users; protected routes; stable foundation for all downstream work.
**Addresses:** Income capture wiring bug (ARCHITECTURE.md §Onboarding data flow); middleware gap (PITFALLS.md §Pitfall 2).
**Avoids:** Silent health score "0%" for users who completed onboarding; unauthenticated access to new routes.

### Phase 2: Categorization Engine Improvements

**Rationale:** The normalization layer is a self-contained change in `@zeta/shared` with no UI dependencies. It should be done before the import UX improvements so the UI polish layer builds on a reliable engine. Preventing auto-categorize from overwriting manual intent (the `manually_categorized` flag) must be done before the categorize inbox UX is built on top of it.
**Delivers:** More accurate auto-categorization for Colombian bank PDF descriptions; protection of manual user intent; expanded keyword coverage.
**Addresses:** Normalization gap (STACK.md §Auto-Categorization); false-positive substring matching (ARCHITECTURE.md §Anti-Pattern 4); manual override destruction (PITFALLS.md §Pitfall 5).
**Avoids:** Trust collapse in the categorization system after rule engine improvements.

### Phase 3: Dashboard Suspense Restructuring + Performance

**Rationale:** The dashboard query waterfall and eager chart loading are the two largest performance problems. Restructuring Suspense boundaries is also a prerequisite for the information hierarchy redesign — you cannot rearrange widgets for narrative clarity until the loading behavior is predictable. This phase also adds the missing `error.tsx` boundaries.
**Delivers:** Tiered dashboard loading (hero visible at ~50ms, charts streamed); lazy chart loading via `next/dynamic`; error recovery UI; recharts v3 upgrade.
**Addresses:** Monolithic `Promise.all` anti-pattern (ARCHITECTURE.md §Dashboard Loading); eager library loading (STACK.md §Performance); missing error boundaries (PITFALLS.md §Phase mapping).
**Avoids:** Hydration mismatches (relative date calculations must stay client-side inside Suspense boundaries — PITFALLS.md §Pitfall 8); performance regression from new chart widgets.

### Phase 4: Onboarding Audit + Redesign

**Rationale:** Phase 1 must be complete before this phase so that the redesigned flow can be validated end-to-end (income captured → health meters show real data). The redesign should reduce fields, not add them — contextually defer anything that is not needed for the dashboard to render meaningfully on day one.
**Delivers:** Streamlined onboarding (minimum viable setup); income/currency/first-account as the only required captures; post-onboarding contextual prompts for everything else; framer-motion removed (replaced with tw-animate-css).
**Addresses:** Onboarding complexity pitfall (PITFALLS.md §Pitfall 4); framer-motion removal (STACK.md §Animation).
**Avoids:** Hasty income estimates from a bloated flow producing misleading health scores from day one.

### Phase 5: Dashboard Information Hierarchy + Narrative UX

**Rationale:** Phases 1–4 ensure the data is correct and the loading is fast. This phase answers the product question: can a user read "Am I on track?" from the dashboard without explanation? The health score single grade, the dashboard headline, and the debt-free countdown date are the primary deliverables.
**Delivers:** Single health score grade with one-line verdict; dashboard headline narrative widget (rule-based, deterministic); debt-free date promoted to hero position on debt screen; budget pace bars with remaining amounts.
**Addresses:** "Am I on track?" narrative clarity (FEATURES.md §Table Stakes); health score false precision risk (PITFALLS.md §Pitfall 7); dashboard hierarchy anti-pattern (PITFALLS.md §Pitfall 6).
**Avoids:** Widget rearrangement mistaken for hierarchy work — must define the one-sentence dashboard communication goal before touching layout.

### Phase 6: UX Polish + Consistency Pass

**Rationale:** After architecture and data are stable, surface-level polish has the lowest risk of introducing regressions. This phase is where inline category editing, unreviewed transaction badges, empty states, friendly copy, and category color consistency land.
**Delivers:** Inline category quick-edit popover; unreviewed transactions badge + review queue; empty states with CTAs; UX copy audit (guilt → encouragement framing); category color consistency across transaction list, charts, and budget bars.
**Addresses:** Full table stakes list from FEATURES.md; mobile layout validation (PITFALLS.md §Pitfall 10); Tailwind v4 CSS layer specificity (PITFALLS.md §Pitfall 11).
**Avoids:** Desktop-only polish that breaks mobile layout (test at 375px after every change); server action wiring broken during visual refactors.

### Phase 7: Type Safety + Dead Code Cleanup

**Rationale:** Cleanup after the functional work is done, in a dedicated phase with small, isolated commits. Replacing `any` types after the architecture is stable means the actual runtime shapes are known and the risk of introducing runtime crashes is minimized.
**Delivers:** Eliminated `any` types in transactions, exchange rate, and chart actions; dead code removed with confirmed zero callers; reconciliation column fallback cleaned up.
**Addresses:** TypeScript `any` cleanup risks (PITFALLS.md §Pitfall 9); dead code deletion risks (PITFALLS.md §Pitfall 12).
**Avoids:** Asserting types that don't match runtime shapes; deleting live code through grep-and-delete.

### Phase Ordering Rationale

- **Dependency chain is strict:** Income fix (P1) → Health score (P5). Categorization normalization (P2) → Import UX (P6). Suspense restructuring (P3) → Dashboard hierarchy (P5). Onboarding redesign (P4) requires income fix (P1) to validate end-to-end.
- **Isolation principle:** Each phase touches a distinct part of the codebase. Phases 1–3 are backend/data-layer changes; phases 4–6 are UX changes. This minimizes the blast radius of any single phase's server action regressions.
- **Performance before polish:** The Suspense restructuring (P3) must precede information hierarchy work (P5) so that loading behavior is predictable before layout is redesigned.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Health Score):** The weighting algorithm for combining 4 health dimensions into one grade (0–100 or A–D) is not specified. Needs definition: what inputs, what weights, what bands map to what labels. Design work, not library work.
- **Phase 6 (Unreviewed Transactions queue):** The data model for distinguishing `auto` vs. `manual` categorization (`manually_categorized` flag or `categorized_by` enum) needs schema design before the UI is built.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Income Fix):** Single-line change in a known location. No research needed.
- **Phase 2 (Categorization Normalization):** Implementation is fully specified in STACK.md and ARCHITECTURE.md with code samples.
- **Phase 3 (Suspense Restructuring):** Next.js 15 async RSC + Suspense is well-documented. Pattern already exists in `PresupuestoSection` — just extend it.
- **Phase 7 (Type Safety):** Standard TypeScript cleanup; use `trace_call_path` from codebase-memory-mcp before any deletion.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Grounded in direct codebase inspection (actual imports counted, not assumed); shadcn/ui recharts v3 migration confirmed via issue #7669; tw-animate-css presence verified in package.json |
| Features | HIGH | Competitor analysis from official Monarch, Copilot, YNAB, Lunch Money documentation; feature gap analysis from reading actual Zeta source |
| Architecture | HIGH | Based on direct codebase analysis of `page.tsx`, `actions/income.ts`, `actions/health-meters.ts`, `auto-categorize.ts`; Next.js 15 official docs confirmed; specific bug (income field mismatch) located and verified |
| Pitfalls | HIGH | Grounded in actual codebase state (middleware.ts read directly, zero error.tsx files confirmed); pitfalls sourced from multiple independent articles cross-checked against Zeta's actual implementation |

**Overall confidence:** HIGH

### Gaps to Address

- **Health score weighting algorithm:** Research confirms a single synthesized grade is the right UX pattern but does not prescribe exact dimension weights. The product decision (what weight for savings rate vs. debt ratio vs. emergency fund coverage vs. spending pace) must be made during Phase 5 planning. Recommendation: start with equal weights, adjust based on user feedback.
- **`manually_categorized` data model:** The flag/enum approach is clear, but the migration strategy (how to handle existing transactions that were "manually" categorized before the flag existed) needs schema design in Phase 6 planning. Recommendation: backfill as `auto` for all existing rows; the user's next manual edit will set the flag.
- **Keyword coverage for Colombian merchants:** ARCHITECTURE.md identifies ~50 additional keywords needed for common Colombian bank descriptions. The actual list requires Colombian-market-specific research (Rappi, Nequi, PSE, Codensa, Claro, etc.). Should be done as part of Phase 2 implementation, not pre-research.

## Sources

### Primary (HIGH confidence)
- Zeta codebase — direct file inspection (2026-03-25): `onboarding/page.tsx`, `dashboard/page.tsx`, `actions/income.ts`, `actions/health-meters.ts`, `packages/shared/src/utils/auto-categorize.ts`, `middleware.ts`, `package.json`
- Next.js 15 official docs — streaming, use cache, cacheTag: https://nextjs.org/docs/app/getting-started/fetching-data
- shadcn/ui recharts v3 migration confirmation: https://github.com/shadcn-ui/ui/issues/7669
- Monarch Money dashboard customization: https://help.monarch.com/hc/en-us/articles/360058127551
- Copilot quick-edit and unreviewed transaction indicator: https://help.copilot.money/en/articles/9554412-transactions-tab-overview
- YNAB Age of Money and onboarding philosophy: https://support.ynab.com/en_us/age-of-money-H1ZS84W1s

### Secondary (MEDIUM confidence)
- YNAB friendly UX copywriting philosophy: https://goodux.appcues.com/blog/you-need-a-budget-ynab-s-friendly-ux-copywriting
- Lunch Money transaction review workflow: https://lunchmoney.app/features
- Debt Payoff Planner "debt-free countdown" UX: https://www.debtpayoffplanner.com/overview/
- Progressive disclosure in fintech onboarding: https://www.eleken.co/blog-posts/fintech-ux-best-practices
- React Server Components performance pitfalls: https://blog.logrocket.com/react-server-components-performance-mistakes
- Next.js hydration errors: https://sentry.io/answers/hydration-error-nextjs/
- Tailwind v4 migration breaking changes: https://designrevision.com/blog/tailwind-4-migration

### Tertiary (LOW confidence)
- Why transaction categorization is hard — Triqai: https://www.triqai.com/article/why-transaction-categorization-is-hard (general domain, not Zeta-specific)
- UX strategies for real-time dashboards — Smashing Magazine: https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
