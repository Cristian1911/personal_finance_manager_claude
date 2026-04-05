# HANDOVER — Mobile v2 Full Redesign (2026-04-04/05)

## 1. Session Summary

Complete mobile redesign for all 4 root tabs (Inicio, Movimientos, Plan, Deudas) on branch `feat/mobile-v2-redesign`. Built ~30 new React components with zone-based layouts, custom heroes per root, expandable chip patterns, and Zeta-branded data visualizations (brass dotted expected lines, sage solid actual lines). Design was iterated through HTML mockup previews → component catalog review → user approval → React implementation → Playwright visual testing. Core UX pattern: "expand inline, never navigate directly" — everything shows a preview first, navigation is secondary.

## 2. Changes Made

### Shared primitives (`webapp/src/components/mobile/v2/`)
- `mobile-zone.tsx` — Zone layout (eyebrow + heading + children)
- `state-chip.tsx` — Colored state pill (sage/brass/warn/danger)
- `use-expandable-zone.ts` — Accordion hook (one zone expanded at a time)
- `linked-metric-detail-panel.tsx` — Chip row + full-width expandable detail panel
- `mobile-header.tsx` — Added `chip?: string` prop to page variant

### Inicio (`webapp/src/components/mobile/v2/inicio/`) — 7 files
- `inicio-hero.tsx` — Daily amount ($X/día), expandable math breakdown, controlled from parent accordion
- `inicio-metrics-grid.tsx` — SVG arc ring (% inside) + próximo ingreso
- `inicio-focus.tsx` — Single attention signal row
- `inicio-burndown.tsx` — Copilot-style: "$X restante" centered, brass/sage chart, badge on point
- `inicio-discovery.tsx` — Two cards, expand FULL WIDTH panel below both (not per-column)
- `inicio-activity.tsx` — Transaction rows expand inline with quick view (not navigate)
- `inicio-root.tsx` — Orchestrator with page-level `useExpandableZone`

### Movimientos (`webapp/src/components/mobile/v2/movimientos/`) — 5 files
- `movimientos-lectura.tsx` — 3-col stats, expandable dual-line chart (REAL data aggregated by week)
- `movimientos-herramientas.tsx` — 3-col tools (Categorizar/Destinatarios/Importar), expand inline
- `movimientos-transaction-row.tsx` — Expandable rows with action pills
- `movimientos-utilidades.tsx` — Pill buttons opening drawers
- `movimientos-root.tsx` — Orchestrator with page-level accordion

### Plan (`webapp/src/components/mobile/v2/plan/`) — 5 files
- `plan-budget-hero.tsx` — % hero with progress bar + pace marker, expandable per-category breakdown
- `plan-action-cta.tsx` — "Planificar" multi-option CTA
- `plan-flow-chart.tsx` — Bar chart: income up / expense down by day (real recurring data)
- `plan-distribution.tsx` — 50/30/20 bars, budget-type aware
- `plan-root.tsx` — Orchestrator with page-level accordion

### Deudas (`webapp/src/components/mobile/v2/deudas/`) — 7 files
- `deudas-hero.tsx` — Split bar (capital vs interest), pressure chip
- `deudas-grid.tsx` — Two matching SVG rings (uso del cupo + próxima salida)
- `deudas-focus.tsx` — Dominant debt card
- `deudas-loans-chips.tsx` — Expandable chips with ALL credits' progress bars
- `deudas-accounts-accordion.tsx` — One account open at a time, tighter spacing
- `deudas-salary-bar.tsx` — Collapsed bar only, expandable legend
- `deudas-root.tsx` — Orchestrator with page-level accordion

### Page wiring (modified)
- `dashboard/page.tsx` — `MobileDashboardV2` → `InicioRoot`
- `transactions/page.tsx` — Inline mobile section → `MovimientosRoot`
- `plan/page.tsx` — Desktop reuse → `PlanRoot`, added `get503020Allocation` + `getCategoriesWithBudgetData`
- `deudas/page.tsx` — `MobileDebtSection` → `DeudasRoot`

### HTML previews (`ui-showcases/`)
- `mobile-zeta-v2-components.html` — Approved component catalog (visual reference)
- 4 per-root previews + 1 overview

### Tests
- `webapp/e2e/mobile-v2-visual.spec.ts` — Visual layout tests

## 3. Key Decisions

- **Expand inline, never navigate** — All interactive elements expand a preview first. Navigation is secondary inside the panel. Saved as memory: `feedback_expand_not_navigate.md`
- **Page-level accordion** — Each root owns ONE `useExpandableZone`. Expanding hero collapses burndown, etc. Saved as memory: `feedback_one_expand_per_page.md`
- **Burndown/salary bar = hover, NOT expand** — Chart point interactions, not click-to-expand sections
- **Hero = big daily number** ($X/día), not total available
- **Ritmo = arc ring with % inside** (not text state like "Bajo control")
- **Plan flow = bar chart** (day-by-day, forward-looking), **Movimientos flow = line chart** (dancing lines, backward-looking)
- **Tools grid 3rd card = "Importar"** (email pending) replaces "Detecciones"
- **Zeta palette for charts**: brass dotted expected, sage solid actual
- **Distribution adapts to budget type** (50/30/20, YNAB, custom)
- **Custom SVG icons** for discovery (not emoji)
- **Deudas loan chips show ALL credits' progress bars** when expanded

## 4. Current State

- **Build**: Passes clean (`pnpm build` in webapp/)
- **Branch**: `feat/mobile-v2-redesign`
- **Git**: ~30 new files, ~10 modified, all uncommitted
- **Playwright**: Auth works (`TEST_PASSWORD` in `.env.local`). Plan + Deudas visual tests pass. Inicio passes. Movimientos has selector issues (sidebar text match).
- **Screenshots**: `webapp/test-results/mobile-v2-*.png` — actual rendered layouts

## 5. Open Issues & Gotchas

1. **Deudas grid rings should be expandable chips** — User's latest request. Currently static rings, should behave like loan chips with expand panel.
2. **Movimientos Playwright selectors** — `getByText('HERRAMIENTAS')` matches sidebar link. Need `.lg\\:hidden` scoping.
3. **Next income data is null** — `inicio-metrics-grid` shows "Sin datos" because no action fetches upcoming INFLOW recurring templates. Need to derive from `planData.recurring.upcoming`.
4. **Burndown chart not interactive** — Should show tooltip on day tap. Currently static SVG.
5. **Salary bar not hoverable** — User wants segment-tap tooltips, not expand toggle.
6. **Legacy components to delete** — `mobile-dashboard-v2.tsx`, `burndown-expandable.tsx`, `inicio-discovery-rail.tsx`, `movimientos-tools-rail.tsx`, `movimientos-utility-sheet.tsx`, `loan-metric-linked-detail.tsx`
7. **`plan-root.tsx` is `"use client"`** — Added by agent for accordion hook. May cause unnecessary client-side rendering of server-safe children.

## 6. Suggested Next Steps

1. **Make deudas grid rings expandable** — Convert to `LinkedMetricDetailPanel` chip pattern
2. **Wire next income data** — Query upcoming INFLOW templates for Inicio metrics
3. **Add burndown chart interactivity** — SVG touch targets with day-level tooltips
4. **Delete unused legacy components** — 6 files no longer imported
5. **Commit** — Large changeset, clear commit message
6. **Fix Movimientos test selectors** — Scope to mobile container

## 7. Context for Claude

- **Component catalog**: `ui-showcases/mobile-zeta-v2-components.html` — open in browser for visual reference
- **Memory files**: `project_mobile_v2_redesign.md`, `feedback_expand_not_navigate.md`, `feedback_one_expand_per_page.md`
- **`DebtAccount`** from `@zeta/shared` has `monthlyPayment` (not `minPayment`), nullable `creditLimit`/`interestRate`
- **`AllocationData`** exported from `@/actions/allocation`, not `@/types/domain`
- **`getAllTags()`** returns `Tag[]`, not `TagWithGroup[]`
- **Playwright auth**: `TEST_PASSWORD` in `webapp/.env.local`, email hardcoded as `giraldo.0302@gmail.com`
- **Page-level accordion pattern**: Root owns `useExpandableZone<string>`, passes `expanded: boolean` + `onToggle` to children. Components with internal sub-state (loan chips) accept `sectionActive: boolean` + `onActivate` from root.
- **Plan page** now fetches `get503020Allocation` and `getCategoriesWithBudgetData` (added this session)
