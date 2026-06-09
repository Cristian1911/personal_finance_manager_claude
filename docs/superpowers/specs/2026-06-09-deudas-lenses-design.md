# Deudas Lenses — `/deudas` Mobile Redesign

**Date:** 2026-06-09
**Status:** Approved (brainstorming session with Cristian)
**Scope:** Mobile webapp `/deudas` only

## Problem

The debt module has the data but doesn't tell a coherent story:

1. **"Manejable" badge lies.** The cuota-mensual hero shows a static affordability badge that ignored a month where the user overspent and had to react with extra payments.
2. **Quick-stats row is incoherent.** "Próxima salida" (ring with months remaining) is confusing without context; "Préstamos / mes" is a lonely plain number next to two rings.
3. **Embedded experiences feel homeless.** "Plata extra", "Simular pagos" and "Tu salario" are complete experiences dropped between stat tiles.
4. **Duplicated account cards.** `/deudas` "Cuentas de deuda" and Mis cuentas "Deuda" section render the same accounts with different, disconnected card designs.

## Decision Summary

| Decision | Outcome |
|---|---|
| Story architecture | **Option C — segmented lenses**: one page, 3 lenses, each reorganizes the full page story |
| Lenses | **Carga / Plan / Cuentas** |
| Lens persistence | `localStorage` (`zeta:deudas-lens`), default **Carga** |
| Personas (`/deudas-personales`) | Stays separate; summary chip in Cuentas lens links to it |
| Planificador (`/deudas/planificador`) | Stays its own focus-mode page; entry point is the Plan lens |
| `/plan` page | **Untouched** (explicitly descoped) |
| Desktop `/deudas`, RN app | Untouched this pass |
| Implementation approach | **C — Hybrid**: new lens shell + targeted rebuilds, reuse working pieces |

## Architecture

### Lens shell

- `DebtLensShell` (client component): segmented control **Carga / Plan / Cuentas** rendered under `MobileHeader`.
- Active lens persisted to `localStorage` key `zeta:deudas-lens`; first visit defaults to Carga.
- All three lenses' data loads server-side in the page's existing `Promise.all` pattern; lens switching is a pure client-side swap — no navigation, no URL change, instant.
- Mobile-only: lives in the existing mobile branch of `/deudas` (`webapp/src/components/mobile/v2/deudas/`). Desktop keeps its current layout and components.

### Lens 1 — Carga (default)

Answers: *"¿Cuánto de mi dinero se quema en deudas, y voy peor o mejor que el mes pasado?"*

Top-to-bottom:

1. **Cuota hero** (evolved from current `deudas-hero`): cuota mensual + intereses + capital/costo-financiero split bar. Existing visuals kept.
2. **Honest trend card** (new — replaces the "Manejable" badge):
   - **Data:** sum of `total_payment_due` from the latest statement period vs the previous period (`statement_snapshots`), per debt account; fallback to `accounts` fields when an account has no snapshots.
   - **Chip logic:** Δ ≤ −5% → `Mejorando` · −5% < Δ ≤ +10% → `Estable` · Δ > +10% → `Mes pesado`. The label states the **trend**, never judges affordability.
   - **Context line:** extra-payment detection — INFLOW transactions to debt accounts beyond the expected cuota this month → "hiciste N pagos extra".
   - **Sparkline:** last 6 statement periods' total cuota.
3. **Tu salario** (existing `SalaryBar`, relocated here — it is the share-of-income story).

### Lens 2 — Plan

Answers: *"¿Cuándo quedo libre y qué puedo hacer al respecto?"*

1. **Horizon hero:** "Libre de deudas: \<fecha\>" + progress bar (% of path) + delta vs plan ("2 meses antes por tus pagos extra"). Data: existing `getDebtFreeCountdown()` / `getDebtProgress()`.
2. **Próximo hito** (replaces confusing "Próxima salida"): next account to be fully paid — ring with months remaining + "82% pagado · $707.332/mes". Same data, framed as a milestone with context.
3. **Action row:** **Plata extra** (existing `ExtraPaymentTrigger` sheet) + **Simular** (link to `/deudas/planificador`).
4. **Insights feed:** existing `generateInsights()` output as a card list.

### Lens 3 — Cuentas

Answers: *"¿Cuánto debo y dónde?"*

1. **Header stats:** cupo ring (utilization, moved from quick-stats) + deuda total — two compact tiles.
2. **Canonical account card** — new shared component `DebtAccountRow` (`webapp/src/components/debt/`):
   - Name + saldo, cupo bar (credit cards), one meta line: "cuota · corte · tasa" (loans: "cuota/mes · faltan N meses").
   - **Consumed by both** the Cuentas lens and Mis cuentas' debt section — one source of truth; the duplicated divergent cards die.
   - Tap → existing account detail.
3. **Personas chip:** one-line summary ("2 personas · $X neto") linking to `/deudas-personales`.
4. **ExchangeRateNudge** stays here (multi-currency context).

### Retired (mobile only)

- `DebtQuickStats` row. Content redistributes: cupo ring → Cuentas header; "Próxima salida" → Plan "Próximo hito"; "Préstamos / mes" → folds into each loan's `DebtAccountRow`.

## Data Layer

- **New shared logic** in `@zeta/shared` (pure, unit-tested):
  - `computeDebtTrend(currentPeriod, previousPeriod)` → `{ deltaPct, status: "mejorando" | "estable" | "mes_pesado" }`
  - Extra-payment detector: given month's INFLOW transactions to debt accounts and expected cuotas → count/sum of extra payments.
- **New server action** `getDebtTrend()` in `webapp/src/actions/debt.ts`:
  - Pulls last ~6 statement periods per debt account from `statement_snapshots` + current-month payments from `transactions`.
  - Returns trend (chip + delta), extra-payment context, sparkline series.
  - `"use cache"` + `cacheTag("debt")` + `cacheLife("zeta")`, `createCachedClient(accessToken)` pattern, defense-in-depth `user_id` filter.
  - Verify transaction mutations' `revalidateFinancialViews()` covers the `debt` tag.
- **No schema changes.** Everything computes from existing tables.

## Edge Cases

- No snapshots at all → trend card renders "Sin historial suficiente", **no chip** (never guess).
- Only one statement period → no Δ, sparkline with available points only.
- No debt accounts → existing empty state kept.
- Multi-currency → trend computed in preferred currency only (same as hero today).

## Testing & Gates

- Unit tests for `computeDebtTrend` + extra-payment detector in `packages/shared`.
- Build gates: `pnpm install` (root) + `pnpm build`.
- Review agents: `zetas-front-guy` (TSX/CSS), `perf-auditor` (feature gate), `server-action-reviewer` (`getDebtTrend`).

## Out of Scope

- Desktop `/deudas` (keeps `DebtQuickStats` for now)
- `/plan` page (explicitly descoped after review)
- `/deudas-personales` internals
- RN mobile app
- Planificador wizard internals

## Design References

- Approved mockup: `claude-ai-design/deudas-lenses-mockup.html` (3-lens structure, content fragment — open via brainstorm server or read raw)
- Tokens: `docs/design-system/TOKENS.md`
