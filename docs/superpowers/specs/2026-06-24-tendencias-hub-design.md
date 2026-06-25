# Tendencias (Análisis) Hub — Design Spec

**Date:** 2026-06-24
**Status:** Draft for review
**Surface:** New `/tendencias` route (webapp). Mobile-first, Spanish, dark.
**Design source:** Claude Design project "Tendencias Hub Design" (`claude-ai-design/tendencias-design/Tendencias.dc.html`) + engineer exploration (`claude-ai-design/tendencias-hub-mockup.html`). No prior wireframe existed — IA was decided in brainstorming.

---

## 1. Why this exists

The Dashboard answers *"¿voy bien **ahora**?"* (today's runway, health score, this-month budget, current balances). It does **not** answer the retrospective / comparative question: *"¿a dónde fue mi dinero y cómo está cambiando con el tiempo?"*

Tendencias is that lens. It serves **three co-equal jobs**:

1. **¿A dónde va el dinero?** — expense breakdown (category trends, top recipients, fixed vs variable)
2. **¿Voy bien?** — savings-rate trend, income-vs-expense over time, budget adherence
3. **¿Está cambiando mi gasto?** — MoM movers, anomalies, balance forecast

All driven by a **period control** (3M · 6M · 12M · Año · personalizado) and a **currency** selector.

**Decided in brainstorming:**
- **IA: Direction B — Lentes segmentados.** A segmented control with three lenses (one per job), with the verdict + summary tiles pinned above it. Mirrors the existing Deudas page pattern. Only the active lens mounts its charts → best first-paint performance (speed is the #1 product rule).
- **Category chart: variant 1c — ranking + sparkline** (each category is a row with a mini sparkline + MoM delta chip, sorted by spend).
- **Opening: variant 2b — verdict line + 3 summary tiles** (gasto prom/mes, tasa de ahorro, ingreso prom, each with a delta).

---

## 2. Architecture

Three layers, cleanly separated. The IA choice (B) lives entirely in Layer 3; Layers 1–2 are IA-agnostic and portable.

```
packages/shared/src/analytics/        ← Layer 1: pure engine (mobile reuses later)
webapp/src/actions/analytics.ts       ← Layer 2: one cached dataset fetch
webapp/src/app/(dashboard)/tendencias ← Layer 3: route + segmented-lens UI
```

### Layer 1 — Portable engine (`@zeta/shared/analytics`)

Pure functions, zero IO. Input = pre-filtered rows + config maps. Output = chart-ready series. Sits beside `computeMonthlyAggregates` (which it reuses for the per-month income/expense base). This is the deliverable that makes mobile parity cheap later — mobile calls the same functions on local SQLite rows.

**Input row shape** (normalized, already filtered by Layer 2):
```ts
interface AnalyticsTx {
  amount: number;            // always positive
  direction: "INFLOW" | "OUTFLOW";
  date: string;              // transaction_date, YYYY-MM-DD
  categoryId: string | null;
  destinatarioId: string | null;
  accountId: string;
  expenseType: "fixed" | "variable" | null;  // joined from categories
}
```

**Config maps** (passed in, built by Layer 2 from existing cached reads):
```ts
interface AnalyticsConfig {
  months: string[];                       // ordered "YYYY-MM" window
  debtAccountIds: ReadonlySet<string>;    // accounts where type ∈ {CREDIT_CARD,LOAN}
  categoryMeta: Map<string, { nameEs: string; color: string; expenseType: "fixed"|"variable"|null; budgetTarget: number|null }>;
  destinatarioMeta: Map<string, { name: string; color: string }>;
}
```

**Exported functions** (each pure, each unit-tested):
| Function | Returns | Job | Notes |
|---|---|---|---|
| `categorySeries(rows, cfg)` | `CategoryTrend[]` | 1 | per category: monthly amounts, total, MoM %, sparkline points. Sorted by total desc. |
| `topRecipients(rows, cfg, limit=5)` | `RecipientRank[]` | 1 | group by `destinatarioId`; sum, count, MoM delta, share-of-spend. Null destinatario bucketed as "Sin asignar". |
| `fixedVsVariable(rows, cfg)` | `{ fixed, variable, variableMoM, variableSeries }` | 1 | uses `expenseType`; null → counted as variable. |
| `savingsRateSeries(rows, cfg)` | `SavingsPoint[]` | 2 | per month: income, expense, rate = (income−expense)/income. Income excludes debt-account INFLOW. |
| `incomeVsExpenseSeries(rows, cfg)` | `CashflowPoint[]` | 2 | thin wrapper over `computeMonthlyAggregates` per month → {month, income, expense, net}. |
| `budgetAdherenceSeries(rows, cfg)` | `AdherencePoint[]` | 2 | per category: months-within / months-exceeded vs `budgetTarget`. See §5 caveat. |
| `movers(categorySeries)` | `Mover[]` | 3 | derived (no new data): top ± MoM category deltas, before→after. |
| `anomalies(rows, cfg)` | `Anomaly[]` | 3 | deterministic: a category-month total ≥ `max(2.5× trailing-3mo mean, mean + 2σ)`. No ML. |
| `forecast(rows, recurring, cfg)` | `ForecastPoint[]` | 3 | historical balance → projected next 3 months = avg discretionary spend + recurring obligations. Excludes unconfirmed income. |
| `buildVerdict(series)` | `{ headline, sub, tiles }` | top | plain-language read for 2b (e.g. "Tu ahorro subió a 24% — el mejor en 6 meses."). Deterministic rules over the series. |

### Layer 2 — Cached dataset action (`webapp/src/actions/analytics.ts`)

**One** cached fetch feeds every section — no N-queries. Mirrors `charts.ts` exactly.

```ts
export async function getTendenciasDataset(range: AnalyticsRange, currency?: CurrencyCode) {
  const { user, accessToken } = await getAuthenticatedClient();
  const isDemo = /* existing demo check */;
  return getTendenciasDatasetCached(accessToken, user.id, range, currency, isDemo);
}

async function getTendenciasDatasetCached(accessToken, userId, range, currency, isDemo) {
  "use cache";
  cacheTag("analytics");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);

  const { from, to, months } = rangeToWindow(range);   // e.g. "6M" → last 6 month bounds
  const { data } = await supabase
    .from("transactions")
    .select("transaction_date, amount, direction, category_id, destinatario_id, account_id, " +
            "accounts!account_id(account_type), categories!category_id(name_es,color,expense_type)")
    .eq("user_id", userId)                       // defense-in-depth
    .gte("transaction_date", from)
    .lte("transaction_date", to)
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null)
    .is("transfer_group_id", null)
    .or("personal_debt_id.is.null,pd_role.neq.origin")
    .eq("currency_code", currency ?? primaryCurrency);

  // normalize rows + build config maps (debtAccountIds, categoryMeta, destinatarioMeta, budgets)
  // return { rows, config, recurring }  — recurring obligations via getPendingOccurrences()
}
```

- **Range type:** `type AnalyticsRange = "3M" | "6M" | "12M" | "YTD" | { from: string; to: string }`.
- **Cache tag:** new `"analytics"` tag. Add `updateTag("analytics")` to `revalidateFinancialViews()` so transaction mutations refresh it (per the `updateTag` not `revalidateTag` rule).
- **Currency:** single-currency per fetch (matches existing charts.ts behavior). Cross-currency aggregation is out of scope.
- **Recurring (for forecast):** reuse `getPendingOccurrences()` after `ensureCurrentOccurrences()` — the recurring source-of-truth, not `statement_snapshots`.
- `categoryMeta`/`destinatarioMeta` budget targets: reuse the existing cached budget + destinatario reads (already in AppDataProvider/cached actions) rather than re-querying.

### Layer 3 — Route + UI (`(dashboard)/tendencias/`)

- `page.tsx` (server component): reads `searchParams` (`range`, `currency`), calls `getTendenciasDataset` + existing cached accounts/categories/destinatarios, runs the engine to build all section view-models, passes them to the client shell.
- `TendenciasShell` (client): renders the **2b header** (verdict + 3 tiles) pinned, the **period control** (writes `range` to searchParams → server re-render from Route Cache; cheap because dataset is cached), currency selector, **segmented control** (3 lenses), and the export button.
- **Lens components** — only the active lens is rendered (B's perf win):
  - `LensGastos` → `CategoryTrendList` (1c ranking+sparkline), `TopRecipientsCard`, `FixedVsVariableCard`
  - `LensAhorro` → `SavingsRateCard`, `IncomeVsExpenseCard`, `BudgetAdherenceCard`
  - `LensCambios` → `MoversCard`, `AnomaliesCard`, `ForecastCard`
- **Reuse before building:** `MonthlyCashflowChart` for income-vs-expense; existing sparkline/delta-chip primitives; card tiers + tokens from the design system. New components only where nothing fits (ranking+sparkline row, savings-rate area, forecast line, anomaly alert rows).
- **Export:** client-side CSV of the active dataset (already in memory) — no library, no new dep.
- **Not focus-mode:** Tendencias is a destination/index page; per the UI rules, index pages are NOT added to `FOCUS_MODE_PATHS`.

---

## 3. Navigation entry point  ⚠️ one open decision

The mobile tab bar (Home · Movimientos · + · Plan · Me) is full; a 6th tab is not viable. Proposed default (lazy, reversible):
- **Desktop:** add "Tendencias" to the sidebar nav.
- **Mobile:** a first-class entry from the Dashboard (a "Ver tendencias →" action in the relevant section header / hero), plus an item in the "Me"/more menu.

This is the only UX decision not yet locked — see open question at end.

---

## 4. Data → engine mapping (reality check)

Every section maps to data we can compute today; nothing requires a schema change.

| Section | Source | New? |
|---|---|---|
| Income vs expense, savings rate | `computeMonthlyAggregates` + per-month split (existing logic) | derive |
| Category trend (multi-month) | rows grouped by `category_id` × month | **new fn** |
| Top recipients | rows grouped by `destinatario_id` | **new fn** |
| Fixed vs variable | `categories.expense_type` join | **new fn** |
| Budget adherence | rows vs `budgetTarget` per month | **new fn**, see caveat |
| Movers | derived from category trend | derive |
| Anomalies | category-month vs trailing-3mo stats | **new fn** |
| Forecast | balance + avg spend + `getPendingOccurrences()` | **new fn** |

**Zeta rules honored (non-negotiable, enforced in Layer 1/2):**
- Income **excludes** INFLOW to `CREDIT_CARD`/`LOAN` (`isDebtAccountType`).
- Excludes `is_excluded`, reconciled (`reconciled_into_transaction_id`), transfers (`transfer_group_id`), and personal-debt origin rows.
- Top recipients group by **`destinatario_id`**, never raw merchant strings.
- `"use cache"` + `cacheTag("analytics")` + `cacheLife("zeta")`; mutations → `updateTag("analytics")`.
- No `new Date("YYYY-MM-DD")`; dates via `parseISO`/`formatDate`.

---

## 5. Known caveats / explicit decisions

- **Budget adherence history:** the budgets table holds *current* targets, not a per-month history. Decision: apply the current target across the window as an approximation, and label it as "meta actual". A true historical-budget table is out of scope (flag for BACKLOG if the approximation proves misleading).
- **Anomaly method is deterministic** (threshold over trailing stats), per the "No AI" constraint. Tunable constant (`2.5×` / `2σ`) lives in the engine with a `ponytail:` comment naming it as the heuristic ceiling.
- **Forecast is a simple projection** (avg discretionary + known recurring), not seasonal decomposition. Assumption surfaced in UI copy ("no incluye ingresos no confirmados").
- **Multi-currency:** per-currency views only; no FX-normalized totals.
- **Mobile app:** out of scope for this build. The Layer-1 engine is built portable so a later mobile Lectura/Tendencias screen reuses it (parity gate applies then).

---

## 6. Testing

- **Layer 1 (engine):** Vitest unit tests per function with fixture rows — the money paths (income exclusion, destinatario grouping, savings-rate math, anomaly threshold, forecast) each get a test asserting exact numbers. This is where correctness lives; it's pure and fully testable without Supabase.
- **Layer 2:** one test that the query builder applies all canonical filters for a given range (filter-set assertion).
- **Layer 3:** smoke — page renders each lens with fixture view-models; verdict copy renders.

---

## 7. Build sequence (for the implementation plan)

Phased so each step ships green (`pnpm build` gate between phases):
1. **Engine + dataset** — Layer 1 pure functions + tests, Layer 2 cached fetch, `revalidateFinancialViews()` wiring. No UI.
2. **Shell + Lens 1 (Gastos)** — route, 2b header, period control, segmented control, category trend (1c) + top recipients + fixed/variable.
3. **Lens 2 (Ahorro)** — savings rate, income-vs-expense (reuse chart), budget adherence.
4. **Lens 3 (Cambios)** — movers, anomalies, forecast.
5. **Nav + export + polish** — entry points, CSV export, `zetas-front-guy` + `perf-auditor` gates.

---

## Open question (blocking nav, not the engine)

**Nav placement for mobile** — go with the proposed default (Dashboard entry point + "Me"/more menu + desktop sidebar), or do you want Tendencias surfaced differently (e.g. promoted onto the Plan page, or replacing a current tab)? The engine and lenses don't depend on this, so Phase 1 can start regardless.
