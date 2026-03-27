# Roadmap: Zeta — Polish & Refinement Milestone

## Overview

Zeta's features are complete but the experience doesn't tell a clear story. This milestone is a
structured polish pass — starting with invisible-but-critical fixes (security gaps, broken income
wiring) before touching any visible surface. Each phase delivers a coherent, verifiable improvement.
The dependency chain is strict: income fix unlocks the health score; categorization normalization
unlocks import trust; Suspense restructuring unlocks information hierarchy; onboarding audit precedes
redesign. Visual polish comes last, once structure is stable.

## Phases

**Phase Numbering:**
- Integer phases (1–10): Planned milestone work
- Decimal phases (e.g. 2.1): Urgent insertions via `/gsd:insert-phase`

- [x] **Phase 1: Security Foundation** - Harden middleware and add error recovery pages (completed 2026-03-25)
- [x] **Phase 2: Income & Data Foundation** - Fix income wiring and consolidate shared constants (completed 2026-03-25)
- [x] **Phase 3: Categorization Engine** - Normalize descriptions, add regex rules, protect manual intent (completed 2026-03-25)
- [x] **Phase 4: Dashboard Performance** - Suspense streaming, lazy charts, remove framer-motion (completed 2026-03-26)
- [ ] **Phase 5: Onboarding Audit** - Generate HTML walkthrough of current onboarding for review
- [ ] **Phase 6: Dashboard Redesign** - "Am I on track?" narrative, health grade, debt-free hero
- [ ] **Phase 7: Categorization UX** - Inline quick-edit, unreviewed queue, rule feedback loop
- [ ] **Phase 8: Onboarding Redesign** - Streamline flow, income capture, completion gates
- [ ] **Phase 9: Visual Polish** - Consistent spacing, empty states, friendly copy, color system
- [ ] **Phase 10: Tech Debt Cleanup** - Remove dead code, eliminate `any` types, standardize env vars

## Phase Details

### Phase 1: Security Foundation
**Goal**: All dashboard routes are protected and failures surface with recovery UI instead of crashes
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. Navigating to any `/(dashboard)/` route while logged out redirects to the login page
  2. A runtime error inside a dashboard route shows a friendly error page with a "Back to dashboard" link, not a crash screen
  3. Navigating to a non-existent URL shows a custom 404 page with navigation options
  4. `createAdminClient()` throws a descriptive error message instead of silently returning a broken client
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Middleware blacklist rewrite + error/404 pages (SEC-01, SEC-02, SEC-03)
- [x] 01-02-PLAN.md — Admin client hardening + remove 36 non-null assertions (SEC-04)

### Phase 2: Income & Data Foundation
**Goal**: Health meters and budget calculations receive real income data and shared constants are unified
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. A user who completed onboarding sees real health meter percentages on the dashboard (not 0% or "excelente" from a zero-income fallback)
  2. Health meters display "Sin datos de ingresos" instead of a misleading 0% when income is genuinely absent
  3. Seed category UUIDs are imported from `@zeta/shared/constants/categories.ts` in all three packages — no hardcoded UUID strings elsewhere
  4. Server actions for recurring templates and purchase decisions accept seed UUIDs without validation errors
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Fix income column mismatch + null-income health meter UX (DATA-01, DATA-02)
- [x] 02-02-PLAN.md — Consolidate category UUID constants + fix z.string().uuid() validators (DATA-03, DATA-04)

### Phase 3: Categorization Engine
**Goal**: Auto-categorization is accurate, resistant to false positives, and respects manual user corrections
**Depends on**: Phase 2
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06
**Success Criteria** (what must be TRUE):
  1. Importing a Bancolombia or Nequi PDF results in visibly more transactions correctly categorized compared to before (fewer "Sin categoría" rows)
  2. A short keyword like "ara" does not match transaction descriptions that merely contain it as a substring (e.g., "compra" is not miscategorized)
  3. A transaction that the user manually categorized retains that category after re-running auto-categorization
  4. The database schema records which transactions were manually categorized vs. auto-categorized
  5. Regex patterns can be added to the auto-categorization rule set without code changes to the engine interface
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — TDD: normalization, word boundary, regex rules, keyword expansion (CAT-01, CAT-02, CAT-03, CAT-04)
- [x] 03-02-PLAN.md — Manual categorization guard clause + schema verification (CAT-05, CAT-06)

### Phase 4: Dashboard Performance
**Goal**: The dashboard hero loads near-instantly and heavy chart libraries do not block first paint
**Depends on**: Phase 3
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04, PERF-05
**Success Criteria** (what must be TRUE):
  1. The dashboard health/hero section is visible within ~50ms of navigation; charts and lower sections stream in afterward with skeleton placeholders
  2. No chart component is in the initial JavaScript bundle — all load via `next/dynamic` on demand
  3. The `framer-motion` package is absent from `package.json`; onboarding transitions still animate using CSS classes
  4. Recharts is upgraded to v3 and chart color tokens use the CSS variable format expected by shadcn/ui (`var(--chart-1)` not `hsl(var(--chart-1))`)
  5. Each dashboard section has a meaningful skeleton (not a generic spinner) that matches the eventual content layout
**Plans**: 5 plans

Plans:
- [x] 04-01-PLAN.md — Suspense tier split + content-shaped skeletons + mobile refactor (PERF-01, PERF-05)
- [x] 04-02-PLAN.md — Remove framer-motion, replace with CSS transitions (PERF-03)
- [x] 04-03-PLAN.md — Recharts v3 upgrade and type fixes (PERF-04)
- [x] 04-04-PLAN.md — next/dynamic lazy-loading for all chart components (PERF-02)
- [x] 04-05-PLAN.md — Gap closure: move dynamic() into section files, remove dead code (PERF-02)

### Phase 5: Onboarding Audit
**Goal**: A static HTML walkthrough of the current onboarding flow exists for human review before any redesign begins
**Depends on**: Phase 4
**Requirements**: ONB-01
**Success Criteria** (what must be TRUE):
  1. An HTML file (or set of files) exists that renders each onboarding step as a clickable mockup
  2. The walkthrough accurately represents the current flow — no steps are missing, no invented steps are shown
  3. The document is self-contained and can be opened in a browser without a running server
**Plans**: 1 plan
**UI hint**: yes

Plans:
- [ ] 05-01-PLAN.md — Interactive HTML walkthrough of 6-step onboarding wizard with UX annotations (ONB-01)

### Phase 6: Dashboard Redesign
**Goal**: A user can answer "Am I on track this month?" by reading the dashboard top-to-bottom without explanation
**Depends on**: Phase 5
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. The dashboard opens with a single-sentence status headline (e.g., "Vas bien este mes — gastos dentro del presupuesto")
  2. A single composite health grade (A / B / C / D or 0–100) is visible in the hero section, synthesizing savings, debt, spending pace, and emergency fund dimensions
  3. When the user has active debts, the projected debt-free date is displayed prominently in the hero area
  4. Each dashboard section has a visible "so what?" label or summary — no widget presents raw numbers without context
  5. Primary, secondary, and tertiary data have clear visual weight differences across all dashboard sections
**Plans**: TBD
**UI hint**: yes

### Phase 7: Categorization UX
**Goal**: Users can correct categories inline without leaving the transaction list, and auto-categorized exceptions are surfaced for review
**Depends on**: Phase 6
**Requirements**: CATUX-01, CATUX-02, CATUX-03
**Success Criteria** (what must be TRUE):
  1. Tapping a category chip on any transaction row opens an inline popover for category selection — no navigation to a detail page required
  2. After importing a PDF, a badge or counter shows how many transactions were auto-categorized and await human review
  3. A dedicated review queue lists all unreviewed auto-categorized transactions from the latest import
  4. Correcting a category in the review queue surfaces a prompt to save the correction as a rule suggestion
**Plans**: TBD
**UI hint**: yes

### Phase 8: Onboarding Redesign
**Goal**: New users are onboarded in the minimum steps needed for the dashboard to render meaningfully, with income correctly wired
**Depends on**: Phase 7
**Requirements**: ONB-02, ONB-03, ONB-04, ONB-05
**Success Criteria** (what must be TRUE):
  1. Onboarding captures only income, currency, and one account as required fields — all other data is deferred to contextual prompts
  2. A user who completes onboarding immediately sees a health score based on their entered income (not a blank or 0% state)
  3. Navigating to the dashboard before completing onboarding shows a completion prompt, not a grey placeholder box
  4. The onboarding UI matches the visual quality of the rest of the app — consistent typography, spacing, and professional feel
**Plans**: TBD
**UI hint**: yes

### Phase 9: Visual Polish
**Goal**: Every screen presents data with consistent visual hierarchy; no screen is blank or uses guilt-inducing copy
**Depends on**: Phase 8
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05
**Success Criteria** (what must be TRUE):
  1. Spacing, font sizes, and color tokens are consistent across all major screens — no one-off inline style values for status colors
  2. Every major view (transactions, budget, debts, categories, import) has an empty state with a CTA when no data exists
  3. All health labels, score descriptions, and status messages use encouraging framing — no financially judgmental language
  4. Status colors (healthy, warning, danger) are applied via `cva` variants consistently across all components
  5. The layout reads correctly on a 375px viewport — no elements overflow or collapse unintentionally
**Plans**: TBD
**UI hint**: yes

### Phase 10: Tech Debt Cleanup
**Goal**: Dead code is removed, `any` types are eliminated, and environment variable handling is standardized
**Depends on**: Phase 9
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05, DEBT-06, DEBT-07
**Success Criteria** (what must be TRUE):
  1. The reconciliation column fallback functions (`isMissingReconciliationColumnError`, `executeVisibleTransactionQuery`, and their fallback paths) no longer exist in the codebase
  2. `transactions.ts` utility functions have explicit TypeScript types — zero `any` usages
  3. `TabViewRouter` passes data via a typed discriminated union — no `as any` spread
  4. Exchange rate and analytics actions use proper typed DB row types — no `any` in those files
  5. `PARSER_API_KEY` fallback alias is removed; only the canonical env var name is used
  6. All `catch {}` blocks in server actions log to `console.error` before swallowing the error
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Foundation | 2/2 | Complete   | 2026-03-25 |
| 2. Income & Data Foundation | 2/2 | Complete   | 2026-03-25 |
| 3. Categorization Engine | 2/2 | Complete   | 2026-03-25 |
| 4. Dashboard Performance | 5/5 | Complete   | 2026-03-26 |
| 5. Onboarding Audit | 0/1 | Not started | - |
| 6. Dashboard Redesign | 0/TBD | Not started | - |
| 7. Categorization UX | 0/TBD | Not started | - |
| 8. Onboarding Redesign | 0/TBD | Not started | - |
| 9. Visual Polish | 0/TBD | Not started | - |
| 10. Tech Debt Cleanup | 0/TBD | Not started | - |
