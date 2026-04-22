# Mobile ↔ Webapp Mobile-Viewport Parity Pass — Design

**Date:** 2026-04-23
**Owner:** Cristian
**Status:** Draft · pending user review before plan-writing

## Goal

Bring the Expo mobile app to visual + interaction parity with the webapp's mobile viewport. The webapp is the design source of truth per `feedback_webapp_source_of_truth.md`. Any screen the user opens on both surfaces should feel like the same app.

This is a **pure UI pass** — no new Supabase migrations, no new server actions, no sync-layer changes. Data is plumbed through existing repositories + AppDataProvider hooks that already back both surfaces.

## Scope

Six slices, each its own PR. Each slice passes build + design gates before the next slice starts.

| # | Slice | Target | One-line scope |
|---|---|---|---|
| 1 | Inicio | `mobile/components/inicio/InicioRoot.tsx` | Pulse hero, Herramientas row, Widgets grid, Organizar pill |
| 2 | Movimientos | `mobile/app/(tabs)/transactions.tsx` | Resumen del mes card with day-chart expand, Herramientas row, day-grouped rich rows |
| 3 | Plan | `mobile/components/plan/PlanRoot.tsx` + `PlanNetHero.tsx` | NETO hero with expandable FLUJO DEL MES chart, Próximo pair cards, IR A icon grid |
| 4 | Deudas — webapp polish | `webapp/src/components/mobile/v2/deudas/*` | Action bar re-anchoring, chunked accounts accordion |
| 5 | Deudas — mobile port | `mobile/components/deudas/*` | Mirror polished webapp state from slice 4 |
| 6 | Recurrentes + Plan tx + Settings | `mobile/app/recurrentes.tsx` + `PlanRoot.tsx` + `(tabs)/settings.tsx` | Expanded action rows + Settings middle-ground polish |

**Out of scope (deferred):**
- True drag-to-reorder + S/M/L resize for widget zone.
- Mobile Arrange mode gesture work.
- Widget catalog stubs (`spending_by_category`, `cashflow_calendar`, `debt_progress`, `merchants_this_month`, `shared_with_partner`, `goal`).
- Webapp dashboard/movimientos/plan/settings polish — only webapp Deudas is in scope (slice 4).

## Slice 1 — Inicio

**Target state:** matches webapp mobile-viewport screenshot: `ESTE MES · PULSO` hero (COP/día rate + sparkline + status chip), `HERRAMIENTAS` divider + 3-tile row (Ritmo ring / Gasto hoy / Por resolver), `WIDGETS` divider + 2-up grid (Reciente, ¿Comprarlo?), centered `ORGANIZAR` pill below.

**Components to create:**
- `mobile/components/inicio/PulseHero.tsx` — port of `webapp/src/components/mobile/v2/inicio/pulse-widget.tsx` (318 L). Skia sparkline (already installed).
- `mobile/components/ui/Sparkline.tsx` — shared Skia sparkline primitive. Capped at 7 data points, memoized path, static stroke.
- `mobile/components/ui/RingStat.tsx` — shared Skia donut. Center numeric + subtitle.
- `mobile/components/ui/ToolChip.tsx` — compact stat tile used in 3-up Herramientas row.
- `mobile/components/ui/SectionEyebrow.tsx` — hairline divider + uppercase eyebrow. Verify not already present; if so, reuse.

**Components to modify:**
- `mobile/components/inicio/InicioRoot.tsx` — replace current `WIDGET Próximamente` placeholders with the new layout. Organizar pill uses `GHOST_BUTTON_CLASS` + `Settings2` icon, opens existing `AddWidgetSheet`.

**Data:** `useMonthlyCashflow`, `useDailySpending`, `useBurnRate`, `useTransactions` (for Reciente tail), `usePendingTransactions` (Por resolver count). All already in AppDataProvider.

## Slice 2 — Movimientos

**Target state:** month chip + Resumen del mes card (movimientos counter, green `+$` ingresos, red `-$` gastos, expandable "Ver flujo por día ↓" day-chart), `HERRAMIENTAS` 2-card grid (Categorizar + Importar with pending-count badges), search + Filtrar chip row, day-grouped transaction rows with account pill + category pill.

**Components to create:**
- `mobile/components/movimientos/MovimientosLectura.tsx` — port of `webapp/src/components/mobile/v2/movimientos/movimientos-lectura.tsx` (309 L).
- `mobile/components/movimientos/MovimientosHerramientas.tsx` — Categorizar + Importar grid.
- `mobile/components/movimientos/TransactionRow.tsx` — mirror of `movimientos-transaction-row.tsx`.
- `mobile/components/movimientos/DayFlowChart.tsx` — Skia line chart; shares axis/grid patterns with slice-3's FLUJO DEL MES.

**Components to modify:**
- `mobile/app/(tabs)/transactions.tsx` — compose Lectura + Herramientas + Rows. Keep existing search/filter state wiring.

**Data:** `useTransactions`, `useMonthSummary`, `useDailySpending` (already returns the needed shape). Pending-count badges from existing selectors.

## Slice 3 — Plan (expandable hero is P0)

**Target state:** `PLAN DEL MES` hero with NETO headline (green `+$` positive / red `-$` negative) + ingreso/gasto/neto legend progress bar + `Toca para ver flujo ↓` chevron row. Tap expands `PlanFlowChart` inline; chevron flips to `Ocultar flujo ↑`. Below: Próximo pago / Próximo ingreso pair cards. Below that: `IR A` 2x2 big-icon grid (Presupuesto, Periodo, Recurrentes, Deseos).

**Components to create:**
- `mobile/components/plan/NextMovementChip.tsx` — amount + label + date, pair-card form.
- `mobile/components/ui/IconTile.tsx` — large icon + label tile for IR A grid.

**Components to modify:**
- `mobile/components/plan/PlanNetHero.tsx` — rewrite to match webapp. Controlled expand prop.
- `mobile/components/plan/PlanRoot.tsx` — on hero tap, reveal `PlanFlowChart` inline. Replace existing Drill/Expandable chips with pair cards + IR A grid.
- `mobile/components/plan/PlanFlowChart.tsx` — verify parity with webapp's 434-L chart. Port any missing visual details (dashed future line, today marker).

**Data:** `useMonthlyCashflow`, `useRecurringOccurrences` (next-occurrence lookup), `useBudgetSummary`, `useWishlistCount`. All existing hooks.

**Animation:** expand/collapse uses `react-native-reanimated` `useAnimatedStyle` with measured height (pattern already used in `AnimatedAccordion`).

## Slice 4 — Deudas webapp polish

**Target state:** Hero + 3-tile grid stay untouched (user: "hero and quick metrics are ok"). Below the grid: actions re-anchored as a proper action bar, and accounts list chunked by type and collapsed by default.

**Files to modify:**
- `webapp/src/components/mobile/v2/deudas/deudas-root.tsx` — replace loose Plata extra + Simular pagos chip row with a `DeudasActionBar` block anchored under the grid with `SectionEyebrow` `ACCIONES`. Labeled buttons (not chips), full-width on mobile viewport.
- `webapp/src/components/mobile/v2/deudas/deudas-accounts-accordion.tsx` — collapsed default shows one summary strip `Tarjetas · N · $X total  ·  Préstamos · N · $Y total`. Tap expands a two-level accordion: Tarjetas group + Préstamos group, each expands independently into the account rows. Each row drops the redundant account-type subtitle (the group header already conveys it). Status chip (VER / LIBRE / AL DÍA) stays.

**Files to create:**
- `webapp/src/components/mobile/v2/deudas/deudas-action-bar.tsx` — lifted from inline chip row for reuse + testability.

**No data-source changes.** All from `useDebtOverview` + `useDebtAccounts` already.

## Slice 5 — Deudas mobile port

**Target state:** mobile mirrors the polished webapp state from slice 4. Cuota mensual hero + capital/costo progress bar + ATENCIÓN chip + 3-tile grid + DeudasActionBar + Salary bar + chunked accounts accordion.

**Files to modify:**
- `mobile/components/deudas/DeudasHero.tsx` — extend to match webapp hero (intereses line, capital/costo progress, ATENCIÓN state chip).
- `mobile/components/deudas/DeudasGrid.tsx` — 3-tile row (uso cupo ring, próxima salida ring, préstamos/mes numeric). Reuses `RingStat` from slice 1.
- `mobile/components/deudas/DeudasAccountsAccordion.tsx` — mirror slice-4 accordion shape using RN `Pressable` + `AnimatedAccordion`.

**Files to create:**
- `mobile/components/deudas/DeudasActionBar.tsx` — RN version of slice-4 webapp bar.
- `mobile/components/deudas/DeudasSalaryBar.tsx` — port of webapp `deudas-salary-bar.tsx` (89 L).

**Blocks on slice 4 merge** so the visual target is stable.

## Slice 6 — Recurrentes expanded + Plan tx expanded + Settings middle-ground

**Recurrentes expanded item** (`mobile/app/recurrentes.tsx`):
- On row tap, expand inline with: Pagar/Administrar tab switcher at top, Pagar panel shows brass `Confirmar pago` full-width + Omitir / Vincular secondary row, Administrar panel shows edit/pause/delete actions. Mirror `mobile-recurrentes-view.tsx` (561 L) interaction.
- New component: `mobile/components/recurrentes/RecurringItemExpanded.tsx`.

**Plan pending-tx expanded** (`mobile/components/plan/PlanRoot.tsx`):
- Pending list rows → on tap reveal an action row: Pagar · Asignar · Editar · Eliminar. Reuses existing handlers from `(tabs)/plan.tsx` drill-down sheets.
- Shared row component: `mobile/components/plan/PendingTxExpanded.tsx`.

**Settings middle-ground** (`mobile/app/(tabs)/settings.tsx`):
- Adopt webapp `mobile-settings.tsx` identity hero (avatar + name + email in a surface card).
- Adopt webapp section headers (`SectionEyebrow`) + row style (left icon + label + right chevron/value).
- Keep mobile-only sections: Legal, Bug report, Sync status, App version. These don't exist on webapp and shouldn't be forced out.
- No change to sign-out surface.

## Shared primitives introduced this pass

Once, reused across slices:
- `mobile/components/ui/SectionEyebrow.tsx` (verify not already present)
- `mobile/components/ui/Sparkline.tsx` (Skia, capped 7 points)
- `mobile/components/ui/RingStat.tsx` (Skia donut)
- `mobile/components/ui/ToolChip.tsx` (3-up compact stat tile)
- `mobile/components/ui/IconTile.tsx` (big-icon grid cell)

## Data sources

All hooks already exist in AppDataProvider or mobile repositories. No new server actions, no new Supabase queries, no schema changes.

| Slice | Hooks/repositories used |
|---|---|
| 1 Inicio | `useMonthlyCashflow`, `useDailySpending`, `useBurnRate`, `useTransactions`, `usePendingTransactions` |
| 2 Movimientos | `useTransactions`, `useMonthSummary`, `useDailySpending` |
| 3 Plan | `useMonthlyCashflow`, `useRecurringOccurrences`, `useBudgetSummary`, `useWishlistCount` |
| 4 Deudas webapp | `useDebtOverview`, `useDebtAccounts`, `useSalaryBreakdown` |
| 5 Deudas mobile | same as 4 (mobile-side hooks) |
| 6 Recurrentes/Plan/Settings | existing `confirmOccurrence`, `skipOccurrence`, `linkOccurrence`, profile read |

## Gates

**Build gates per slice:**
1. `pnpm install` (repo root) if deps changed. No new deps expected.
2. `pnpm build` — webapp must stay green for mobile-only slices (shared types).
3. `pnpm --filter @zeta/shared test` if shared touched.
4. Mobile typecheck: `cd mobile && pnpm typecheck` (or `npx tsc --noEmit` if no script exists).

**Review gates per slice:**
- `zetas-front-guy` — after every TSX/CSS change. Token compliance, `MOBILE_TAB_BAR_CLEARANCE_CLASS` on sheets, `useSafeAreaInsets()` on root screens, button variants limited to `BRASS_BUTTON_CLASS` / `GHOST_BUTTON_CLASS` / `BRASS_GHOST_BUTTON_CLASS`.
- `frontend-auditor` — end of each slice. Accessibility, responsive, localization.
- `mobile-sync-doctor` — only if repositories touched. Not expected in this pass.
- `mobile-webapp-parity` — spot-check before opening PR. Confirms no data-shape drift.
- `ux-analyst` — after slices 1, 3, 6 (biggest interaction surfaces).

## Rollout risks

- **Skia perf on low-end Android** — sparkline/ring render per frame could stutter. Mitigation: memoize path, cap data points, static stroke.
- **Expandable-hero height thrash (slice 3)** — animated height + scroll can feel janky. Mitigation: `react-native-reanimated` `useAnimatedStyle` with measured height (pattern already used in `AnimatedAccordion`).
- **Safe-area regression** — every redesigned top-level screen must keep `useSafeAreaInsets()` or mount `MobileHeader`. `zetas-front-guy` flags automatically.
- **Deudas order dependency** — slice 5 intentionally blocks on slice 4 merge so the mobile port targets a stable webapp state.

## Success criteria

- Visual: webapp mobile viewport and native mobile app render visually equivalent layouts for Inicio / Movimientos / Plan / Deudas / Recurrentes / Settings.
- Interaction: Plan hero expand, Recurrentes expanded item, Plan pending-tx expanded all work on native as documented.
- Gates: every slice passes build + `zetas-front-guy` + `frontend-auditor`. Slices 1/3/6 pass `ux-analyst`.
- No regressions in existing user flows (auth, sync, transaction creation, import).

## Open questions

None at this stage. Anything surfaced during plan-writing or implementation goes to the BACKLOG.md follow-ups section.
