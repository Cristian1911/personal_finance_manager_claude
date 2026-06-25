# Tendencias Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/tendencias` analytics hub that answers "¿a dónde fue mi dinero y cómo está cambiando?" across three co-equal jobs (expense breakdown, savings/on-track, spending velocity).

**Architecture:** Three layers. (1) A pure, portable engine in `@zeta/shared/analytics` derives every chart series from filtered rows + config maps. (2) One cached `getTendenciasDataset` server action fetches N months of transactions once and builds the config maps (mirrors `charts.ts`). (3) A segmented-lens UI (IA Direction B) renders one job-lens at a time, with a pinned verdict+tiles header.

**Tech Stack:** TypeScript, Next.js 15 App Router, React 19, Supabase (`@supabase/ssr`), recharts, Tailwind v4 + shadcn/ui, Vitest. Pure engine depends only on `date-fns`-free string ops.

## Global Constraints

- **Spanish-first UI** — every user-facing string in Spanish.
- **Package manager pnpm.** After any dep change: `pnpm install` from repo root, then `pnpm build` (both gates must pass before "done").
- **No new dependencies** — reuse recharts, existing chart components, design tokens.
- **No hardcoded colors** — tokens only (`text-z-brass`, `bg-z-surface-2`, `border-white/6`, etc. from `docs/design-system/TOKENS.md`).
- **Button variants** — only `BRASS_BUTTON_CLASS`, `GHOST_BUTTON_CLASS`, `BRASS_GHOST_BUTTON_CLASS` from `@/lib/constants/styles.ts`.
- **Caching** — data reads use `"use cache"` + `cacheTag("analytics")` + `cacheLife("zeta")` + `createCachedClient(accessToken)`. Mutations invalidate via `updateTag("analytics")` (from `next/cache`), NEVER `revalidateTag`.
- **Auth + defense-in-depth** — server actions use `getAuthenticatedClient()`; every query adds `.eq("user_id", user.id)` even with RLS.
- **Income exclusion (non-negotiable)** — INFLOW to `CREDIT_CARD`/`LOAN` accounts is NOT income. Exclude `is_excluded=true`, `reconciled_into_transaction_id IS NOT NULL`, `transfer_group_id IS NOT NULL`, and personal-debt origin rows (`pd_role = 'origin'`).
- **Destinatario grouping** — group spend by `destinatario_id`, never raw merchant strings.
- **Dates** — never `new Date("YYYY-MM-DD")`. Month bucketing uses `date.slice(0,7)` (TZ-safe string op).
- **No AI** — anomaly detection is deterministic threshold math.
- **Not focus-mode** — `/tendencias` is an index/destination page; do NOT add it to `FOCUS_MODE_PATHS`.

---

# PHASE 1 — Engine + cached dataset (IA-agnostic, correctness-critical)

All Phase 1 work is in `packages/shared/src/analytics/` plus two webapp files. The engine is pure → fully unit-tested without Supabase. Test command form (from repo root):
`pnpm --filter @zeta/shared test src/analytics/<file>.test.ts`

## Task 1: Module scaffold + types

**Files:**
- Create: `packages/shared/src/analytics/types.ts`
- Create: `packages/shared/src/analytics/index.ts`
- Modify: `packages/shared/src/index.ts` (add `export * from "./analytics";`)

**Interfaces:**
- Produces: all shared types below (`AnalyticsTx`, `AnalyticsConfig`, `CategoryTrend`, `RecipientRank`, `FixedVariable`, `SavingsPoint`, `CashflowPoint`, `AdherencePoint`, `Mover`, `Anomaly`, `RecurringObligation`, `ForecastPoint`, `Verdict`).

- [ ] **Step 1: Create `types.ts`**

```ts
// packages/shared/src/analytics/types.ts
export type ExpenseType = "fixed" | "variable";

/** A transaction row already filtered + normalized by Layer 2. */
export interface AnalyticsTx {
  amount: number;                 // always positive; sign comes from direction
  direction: "INFLOW" | "OUTFLOW";
  date: string;                   // transaction_date, YYYY-MM-DD
  categoryId: string | null;
  destinatarioId: string | null;
  accountId: string;
  expenseType: ExpenseType | null; // joined from categories.expense_type
}

export interface CategoryMeta {
  nameEs: string;
  color: string;
  expenseType: ExpenseType | null;
  budgetTarget: number | null;
}
export interface DestinatarioMeta { name: string; color: string; }

export interface AnalyticsConfig {
  months: string[];                                  // ordered "YYYY-MM", oldest → newest
  debtAccountIds: ReadonlySet<string>;
  categoryMeta: ReadonlyMap<string, CategoryMeta>;
  destinatarioMeta: ReadonlyMap<string, DestinatarioMeta>;
}

export interface CategoryTrend {
  categoryId: string;
  nameEs: string;
  color: string;
  monthly: number[];          // aligned to config.months
  total: number;
  momPct: number | null;      // last vs prev month; null when prev is 0
}
export interface RecipientRank {
  destinatarioId: string | null;
  name: string;
  color: string;
  total: number;
  count: number;
  momPct: number | null;
  share: number;              // 0..1 of total spend in window
}
export interface FixedVariable {
  fixed: number;
  variable: number;
  variableMoM: number | null;
  variableSeries: number[];   // aligned to config.months
}
export interface CashflowPoint { month: string; income: number; expense: number; net: number; }
export interface SavingsPoint { month: string; income: number; expense: number; rate: number | null; }
export interface AdherencePoint {
  categoryId: string;
  nameEs: string;
  target: number;
  monthsWithin: number;
  monthsExceeded: number;
  momPct: number | null;
}
export interface Mover {
  categoryId: string;
  nameEs: string;
  color: string;
  from: number;
  to: number;
  deltaPct: number;
}
export interface Anomaly {
  categoryId: string;
  nameEs: string;
  month: string;
  amount: number;
  baseline: number;
  multiple: number;           // amount / baseline
}
export interface RecurringObligation { month: string; amount: number; }
export interface ForecastPoint { month: string; balance: number; projected: boolean; }
export interface VerdictTile {
  label: string;
  value: string;
  deltaLabel: string | null;
  tone: "pos" | "neg" | "neutral";
}
export interface Verdict { headline: string; sub: string | null; tiles: VerdictTile[]; }
```

- [ ] **Step 2: Create `index.ts` stub**

```ts
// packages/shared/src/analytics/index.ts
export * from "./types";
// engine function re-exports added in later tasks
```

- [ ] **Step 3: Wire into shared barrel**

In `packages/shared/src/index.ts`, add (alphabetical with siblings):
```ts
export * from "./analytics";
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @zeta/shared exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/analytics/types.ts packages/shared/src/analytics/index.ts packages/shared/src/index.ts
git commit -m "feat(analytics): engine module scaffold + types"
```

## Task 2: `categorySeries` + `movers`

**Files:**
- Create: `packages/shared/src/analytics/category-series.ts`
- Create: `packages/shared/src/analytics/category-series.test.ts`
- Modify: `packages/shared/src/analytics/index.ts`

**Interfaces:**
- Consumes: `AnalyticsTx`, `AnalyticsConfig`, `CategoryTrend`, `Mover`.
- Produces: `categorySeries(rows, cfg): CategoryTrend[]`, `movers(series, limit?): Mover[]`.

- [ ] **Step 1: Write failing tests**

```ts
// packages/shared/src/analytics/category-series.test.ts
import { describe, expect, test } from "vitest";
import { categorySeries, movers } from "./category-series";
import type { AnalyticsConfig, AnalyticsTx } from "./types";

const cfg: AnalyticsConfig = {
  months: ["2026-05", "2026-06"],
  debtAccountIds: new Set(),
  categoryMeta: new Map([
    ["c1", { nameEs: "Comida", color: "#E8875A", expenseType: "variable", budgetTarget: null }],
    ["c2", { nameEs: "Transporte", color: "#768053", expenseType: "variable", budgetTarget: null }],
  ]),
  destinatarioMeta: new Map(),
};
const tx = (o: Partial<AnalyticsTx>): AnalyticsTx => ({
  amount: 0, direction: "OUTFLOW", date: "2026-06-01", categoryId: "c1",
  destinatarioId: null, accountId: "a", expenseType: "variable", ...o,
});

describe("categorySeries", () => {
  test("buckets OUTFLOW by category and month, ignores INFLOW, sorts by total desc", () => {
    const rows = [
      tx({ amount: 100, date: "2026-05-10", categoryId: "c1" }),
      tx({ amount: 150, date: "2026-06-12", categoryId: "c1" }),
      tx({ amount: 999, date: "2026-06-12", categoryId: "c1", direction: "INFLOW" }),
      tx({ amount: 300, date: "2026-06-01", categoryId: "c2" }),
    ];
    const out = categorySeries(rows, cfg);
    expect(out.map((c) => c.categoryId)).toEqual(["c2", "c1"]); // 300 > 250
    const comida = out.find((c) => c.categoryId === "c1")!;
    expect(comida.monthly).toEqual([100, 150]);
    expect(comida.total).toBe(250);
    expect(comida.momPct).toBe(50);
  });

  test("momPct is null when previous month is zero", () => {
    const out = categorySeries([tx({ amount: 50, date: "2026-06-05", categoryId: "c1" })], cfg);
    expect(out[0].momPct).toBeNull();
  });
});

describe("movers", () => {
  test("returns largest absolute MoM deltas first", () => {
    const series = categorySeries([
      tx({ amount: 100, date: "2026-05-01", categoryId: "c1" }),
      tx({ amount: 120, date: "2026-06-01", categoryId: "c1" }),  // +20%
      tx({ amount: 100, date: "2026-05-01", categoryId: "c2" }),
      tx({ amount: 50, date: "2026-06-01", categoryId: "c2" }),   // -50%
    ], cfg);
    const m = movers(series);
    expect(m[0].categoryId).toBe("c2");
    expect(m[0].deltaPct).toBe(-50);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter @zeta/shared test src/analytics/category-series.test.ts`
Expected: FAIL ("Cannot find module './category-series'").

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/analytics/category-series.ts
import type { AnalyticsConfig, AnalyticsTx, CategoryTrend, Mover } from "./types";

export function categorySeries(rows: readonly AnalyticsTx[], cfg: AnalyticsConfig): CategoryTrend[] {
  const monthIndex = new Map(cfg.months.map((m, i) => [m, i]));
  const byCat = new Map<string, number[]>();
  for (const t of rows) {
    if (t.direction !== "OUTFLOW" || t.categoryId == null) continue;
    const mi = monthIndex.get(t.date.slice(0, 7));
    if (mi === undefined) continue;
    let arr = byCat.get(t.categoryId);
    if (!arr) { arr = new Array(cfg.months.length).fill(0); byCat.set(t.categoryId, arr); }
    arr[mi] += t.amount;
  }
  const out: CategoryTrend[] = [];
  for (const [categoryId, monthly] of byCat) {
    const meta = cfg.categoryMeta.get(categoryId);
    const total = monthly.reduce((a, b) => a + b, 0);
    const prev = monthly[monthly.length - 2] ?? 0;
    const last = monthly[monthly.length - 1] ?? 0;
    const momPct = prev === 0 ? null : ((last - prev) / prev) * 100;
    out.push({
      categoryId,
      nameEs: meta?.nameEs ?? "Sin categoría",
      color: meta?.color ?? "#768053",
      monthly, total, momPct,
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

export function movers(series: readonly CategoryTrend[], limit = 4): Mover[] {
  return series
    .filter((c) => c.momPct !== null && c.monthly.length >= 2)
    .map((c) => ({
      categoryId: c.categoryId,
      nameEs: c.nameEs,
      color: c.color,
      from: c.monthly[c.monthly.length - 2],
      to: c.monthly[c.monthly.length - 1],
      deltaPct: c.momPct as number,
    }))
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, limit);
}
```

Add to `index.ts`: `export * from "./category-series";`

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @zeta/shared test src/analytics/category-series.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/analytics/category-series.ts packages/shared/src/analytics/category-series.test.ts packages/shared/src/analytics/index.ts
git commit -m "feat(analytics): categorySeries + movers"
```

## Task 3: `incomeVsExpenseSeries` + `savingsRateSeries`

**Files:**
- Create: `packages/shared/src/analytics/cashflow.ts`
- Create: `packages/shared/src/analytics/cashflow.test.ts`
- Modify: `packages/shared/src/analytics/index.ts`

**Interfaces:**
- Consumes: `AnalyticsTx`, `AnalyticsConfig`, `CashflowPoint`, `SavingsPoint`.
- Produces: `incomeVsExpenseSeries(rows, cfg): CashflowPoint[]`, `savingsRateSeries(rows, cfg): SavingsPoint[]`.

- [ ] **Step 1: Write failing tests**

```ts
// packages/shared/src/analytics/cashflow.test.ts
import { describe, expect, test } from "vitest";
import { incomeVsExpenseSeries, savingsRateSeries } from "./cashflow";
import type { AnalyticsConfig, AnalyticsTx } from "./types";

const cfg: AnalyticsConfig = {
  months: ["2026-06"],
  debtAccountIds: new Set(["debtAcct"]),
  categoryMeta: new Map(),
  destinatarioMeta: new Map(),
};
const tx = (o: Partial<AnalyticsTx>): AnalyticsTx => ({
  amount: 0, direction: "OUTFLOW", date: "2026-06-01", categoryId: null,
  destinatarioId: null, accountId: "checking", expenseType: null, ...o,
});

test("income excludes INFLOW to debt accounts", () => {
  const rows = [
    tx({ amount: 1000, direction: "INFLOW", accountId: "checking" }), // income
    tx({ amount: 500, direction: "INFLOW", accountId: "debtAcct" }),  // debt payment — NOT income
    tx({ amount: 200, direction: "OUTFLOW", accountId: "checking" }), // expense
  ];
  const [p] = incomeVsExpenseSeries(rows, cfg);
  expect(p.income).toBe(1000);
  expect(p.expense).toBe(200);
  expect(p.net).toBe(800);
});

test("savings rate = (income - expense) / income, null when income is 0", () => {
  const withIncome = savingsRateSeries([
    tx({ amount: 1000, direction: "INFLOW", accountId: "checking" }),
    tx({ amount: 250, direction: "OUTFLOW", accountId: "checking" }),
  ], cfg);
  expect(withIncome[0].rate).toBeCloseTo(0.75);

  const noIncome = savingsRateSeries([tx({ amount: 100, direction: "OUTFLOW" })], cfg);
  expect(noIncome[0].rate).toBeNull();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter @zeta/shared test src/analytics/cashflow.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/analytics/cashflow.ts
import type { AnalyticsConfig, AnalyticsTx, CashflowPoint, SavingsPoint } from "./types";

export function incomeVsExpenseSeries(rows: readonly AnalyticsTx[], cfg: AnalyticsConfig): CashflowPoint[] {
  const idx = new Map(cfg.months.map((m, i) => [m, i]));
  const inc = new Array(cfg.months.length).fill(0);
  const exp = new Array(cfg.months.length).fill(0);
  for (const t of rows) {
    const mi = idx.get(t.date.slice(0, 7));
    if (mi === undefined) continue;
    if (t.direction === "INFLOW" && !cfg.debtAccountIds.has(t.accountId)) inc[mi] += t.amount;
    else if (t.direction === "OUTFLOW") exp[mi] += t.amount;
  }
  return cfg.months.map((month, i) => ({ month, income: inc[i], expense: exp[i], net: inc[i] - exp[i] }));
}

export function savingsRateSeries(rows: readonly AnalyticsTx[], cfg: AnalyticsConfig): SavingsPoint[] {
  return incomeVsExpenseSeries(rows, cfg).map((p) => ({
    month: p.month,
    income: p.income,
    expense: p.expense,
    rate: p.income === 0 ? null : (p.income - p.expense) / p.income,
  }));
}
```

Add to `index.ts`: `export * from "./cashflow";`

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @zeta/shared test src/analytics/cashflow.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/analytics/cashflow.ts packages/shared/src/analytics/cashflow.test.ts packages/shared/src/analytics/index.ts
git commit -m "feat(analytics): income-vs-expense + savings-rate series"
```

## Task 4: `topRecipients`

**Files:**
- Create: `packages/shared/src/analytics/recipients.ts`
- Create: `packages/shared/src/analytics/recipients.test.ts`
- Modify: `packages/shared/src/analytics/index.ts`

**Interfaces:**
- Consumes: `AnalyticsTx`, `AnalyticsConfig`, `RecipientRank`.
- Produces: `topRecipients(rows, cfg, limit?): RecipientRank[]`.

- [ ] **Step 1: Write failing test**

```ts
// packages/shared/src/analytics/recipients.test.ts
import { expect, test } from "vitest";
import { topRecipients } from "./recipients";
import type { AnalyticsConfig, AnalyticsTx } from "./types";

const cfg: AnalyticsConfig = {
  months: ["2026-05", "2026-06"],
  debtAccountIds: new Set(),
  categoryMeta: new Map(),
  destinatarioMeta: new Map([
    ["d1", { name: "Éxito", color: "#E8875A" }],
    ["d2", { name: "Rappi", color: "#937844" }],
  ]),
};
const tx = (o: Partial<AnalyticsTx>): AnalyticsTx => ({
  amount: 0, direction: "OUTFLOW", date: "2026-06-01", categoryId: null,
  destinatarioId: "d1", accountId: "a", expenseType: null, ...o,
});

test("ranks by total, computes count, share, MoM, buckets null as 'Sin asignar'", () => {
  const rows = [
    tx({ amount: 300, date: "2026-05-01", destinatarioId: "d1" }),
    tx({ amount: 100, date: "2026-06-01", destinatarioId: "d1" }),  // d1 total 400, last 100, prev 300
    tx({ amount: 50, date: "2026-06-01", destinatarioId: "d2" }),
    tx({ amount: 50, date: "2026-06-01", destinatarioId: null }),
  ];
  const out = topRecipients(rows, cfg, 5);
  expect(out[0].name).toBe("Éxito");
  expect(out[0].total).toBe(400);
  expect(out[0].count).toBe(2);
  expect(out[0].momPct).toBeCloseTo(-66.666, 1); // (100-300)/300
  expect(out[0].share).toBeCloseTo(400 / 500);
  expect(out.find((r) => r.destinatarioId === null)!.name).toBe("Sin asignar");
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter @zeta/shared test src/analytics/recipients.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/analytics/recipients.ts
import type { AnalyticsConfig, AnalyticsTx, RecipientRank } from "./types";

const NONE = "__none__";

export function topRecipients(rows: readonly AnalyticsTx[], cfg: AnalyticsConfig, limit = 5): RecipientRank[] {
  const monthSet = new Set(cfg.months);
  const lastMonth = cfg.months[cfg.months.length - 1];
  const prevMonth = cfg.months[cfg.months.length - 2];
  const agg = new Map<string, { total: number; count: number; last: number; prev: number }>();
  let grand = 0;
  for (const t of rows) {
    if (t.direction !== "OUTFLOW") continue;
    const m = t.date.slice(0, 7);
    if (!monthSet.has(m)) continue;
    const key = t.destinatarioId ?? NONE;
    let e = agg.get(key);
    if (!e) { e = { total: 0, count: 0, last: 0, prev: 0 }; agg.set(key, e); }
    e.total += t.amount; e.count += 1; grand += t.amount;
    if (m === lastMonth) e.last += t.amount;
    else if (m === prevMonth) e.prev += t.amount;
  }
  return [...agg.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([key, e]) => {
      const meta = key === NONE ? undefined : cfg.destinatarioMeta.get(key);
      return {
        destinatarioId: key === NONE ? null : key,
        name: meta?.name ?? "Sin asignar",
        color: meta?.color ?? "#938C7E",
        total: e.total,
        count: e.count,
        momPct: e.prev === 0 ? null : ((e.last - e.prev) / e.prev) * 100,
        share: grand === 0 ? 0 : e.total / grand,
      };
    });
}
```

Add to `index.ts`: `export * from "./recipients";`

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @zeta/shared test src/analytics/recipients.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/analytics/recipients.ts packages/shared/src/analytics/recipients.test.ts packages/shared/src/analytics/index.ts
git commit -m "feat(analytics): topRecipients"
```

## Task 5: `fixedVsVariable`

**Files:**
- Create: `packages/shared/src/analytics/fixed-variable.ts`
- Create: `packages/shared/src/analytics/fixed-variable.test.ts`
- Modify: `packages/shared/src/analytics/index.ts`

**Interfaces:**
- Consumes: `AnalyticsTx`, `AnalyticsConfig`, `FixedVariable`.
- Produces: `fixedVsVariable(rows, cfg): FixedVariable`.

- [ ] **Step 1: Write failing test**

```ts
// packages/shared/src/analytics/fixed-variable.test.ts
import { expect, test } from "vitest";
import { fixedVsVariable } from "./fixed-variable";
import type { AnalyticsConfig, AnalyticsTx } from "./types";

const cfg: AnalyticsConfig = {
  months: ["2026-05", "2026-06"],
  debtAccountIds: new Set(),
  categoryMeta: new Map(),
  destinatarioMeta: new Map(),
};
const tx = (o: Partial<AnalyticsTx>): AnalyticsTx => ({
  amount: 0, direction: "OUTFLOW", date: "2026-06-01", categoryId: null,
  destinatarioId: null, accountId: "a", expenseType: "variable", ...o,
});

test("splits fixed/variable, treats null expenseType as variable, trends variable", () => {
  const r = fixedVsVariable([
    tx({ amount: 1000, expenseType: "fixed" }),
    tx({ amount: 400, date: "2026-05-01", expenseType: "variable" }),
    tx({ amount: 600, date: "2026-06-01", expenseType: null }), // null → variable
  ], cfg);
  expect(r.fixed).toBe(1000);
  expect(r.variable).toBe(1000);
  expect(r.variableSeries).toEqual([400, 600]);
  expect(r.variableMoM).toBe(50);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter @zeta/shared test src/analytics/fixed-variable.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/analytics/fixed-variable.ts
import type { AnalyticsConfig, AnalyticsTx, FixedVariable } from "./types";

export function fixedVsVariable(rows: readonly AnalyticsTx[], cfg: AnalyticsConfig): FixedVariable {
  const idx = new Map(cfg.months.map((m, i) => [m, i]));
  let fixed = 0, variable = 0;
  const variableSeries = new Array(cfg.months.length).fill(0);
  for (const t of rows) {
    if (t.direction !== "OUTFLOW") continue;
    const mi = idx.get(t.date.slice(0, 7));
    if (mi === undefined) continue;
    if (t.expenseType === "fixed") { fixed += t.amount; }
    else { variable += t.amount; variableSeries[mi] += t.amount; }
  }
  const prev = variableSeries[variableSeries.length - 2] ?? 0;
  const last = variableSeries[variableSeries.length - 1] ?? 0;
  return { fixed, variable, variableMoM: prev === 0 ? null : ((last - prev) / prev) * 100, variableSeries };
}
```

Add to `index.ts`: `export * from "./fixed-variable";`

- [ ] **Step 4: Run, verify pass** — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/analytics/fixed-variable.ts packages/shared/src/analytics/fixed-variable.test.ts packages/shared/src/analytics/index.ts
git commit -m "feat(analytics): fixedVsVariable"
```

## Task 6: `budgetAdherenceSeries`

**Files:**
- Create: `packages/shared/src/analytics/budget-adherence.ts`
- Create: `packages/shared/src/analytics/budget-adherence.test.ts`
- Modify: `packages/shared/src/analytics/index.ts`

**Interfaces:**
- Consumes: `categorySeries` (Task 2), `AnalyticsConfig`, `AdherencePoint`.
- Produces: `budgetAdherenceSeries(rows, cfg): AdherencePoint[]`.

- [ ] **Step 1: Write failing test**

```ts
// packages/shared/src/analytics/budget-adherence.test.ts
import { expect, test } from "vitest";
import { budgetAdherenceSeries } from "./budget-adherence";
import type { AnalyticsConfig, AnalyticsTx } from "./types";

const cfg: AnalyticsConfig = {
  months: ["2026-05", "2026-06"],
  debtAccountIds: new Set(),
  categoryMeta: new Map([
    ["c1", { nameEs: "Restaurantes", color: "#937844", expenseType: "variable", budgetTarget: 100 }],
    ["c2", { nameEs: "Sin meta", color: "#768053", expenseType: "variable", budgetTarget: null }],
  ]),
  destinatarioMeta: new Map(),
};
const tx = (o: Partial<AnalyticsTx>): AnalyticsTx => ({
  amount: 0, direction: "OUTFLOW", date: "2026-06-01", categoryId: "c1",
  destinatarioId: null, accountId: "a", expenseType: "variable", ...o,
});

test("counts months within/exceeded vs target; skips categories with no budget", () => {
  const out = budgetAdherenceSeries([
    tx({ amount: 80, date: "2026-05-01", categoryId: "c1" }),   // within (<=100)
    tx({ amount: 150, date: "2026-06-01", categoryId: "c1" }),  // exceeded
    tx({ amount: 500, date: "2026-06-01", categoryId: "c2" }),  // no budget → skipped
  ], cfg);
  expect(out).toHaveLength(1);
  expect(out[0].categoryId).toBe("c1");
  expect(out[0].monthsWithin).toBe(1);
  expect(out[0].monthsExceeded).toBe(1);
});
```

- [ ] **Step 2: Run, verify fail** — Expected: FAIL.
- [ ] **Step 3: Implement**

```ts
// packages/shared/src/analytics/budget-adherence.ts
import { categorySeries } from "./category-series";
import type { AdherencePoint, AnalyticsConfig, AnalyticsTx } from "./types";

export function budgetAdherenceSeries(rows: readonly AnalyticsTx[], cfg: AnalyticsConfig): AdherencePoint[] {
  const out: AdherencePoint[] = [];
  for (const c of categorySeries(rows, cfg)) {
    const target = cfg.categoryMeta.get(c.categoryId)?.budgetTarget ?? null;
    if (target === null || target <= 0) continue;
    let within = 0, exceeded = 0;
    for (const m of c.monthly) { if (m > target) exceeded++; else within++; }
    out.push({ categoryId: c.categoryId, nameEs: c.nameEs, target, monthsWithin: within, monthsExceeded: exceeded, momPct: c.momPct });
  }
  return out.sort((a, b) => b.monthsExceeded - a.monthsExceeded);
}
```

Add to `index.ts`: `export * from "./budget-adherence";`

- [ ] **Step 4: Run, verify pass** — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/analytics/budget-adherence.ts packages/shared/src/analytics/budget-adherence.test.ts packages/shared/src/analytics/index.ts
git commit -m "feat(analytics): budgetAdherenceSeries (current target approximation)"
```

## Task 7: `anomalies`

**Files:**
- Create: `packages/shared/src/analytics/anomalies.ts`
- Create: `packages/shared/src/analytics/anomalies.test.ts`
- Modify: `packages/shared/src/analytics/index.ts`

**Interfaces:**
- Consumes: `categorySeries` (Task 2), `AnalyticsConfig`, `Anomaly`.
- Produces: `anomalies(rows, cfg): Anomaly[]`.

- [ ] **Step 1: Write failing test**

```ts
// packages/shared/src/analytics/anomalies.test.ts
import { expect, test } from "vitest";
import { anomalies } from "./anomalies";
import type { AnalyticsConfig, AnalyticsTx } from "./types";

const cfg: AnalyticsConfig = {
  months: ["2026-03", "2026-04", "2026-05", "2026-06"],
  debtAccountIds: new Set(),
  categoryMeta: new Map([["c1", { nameEs: "Compras", color: "#E8875A", expenseType: "variable", budgetTarget: null }]]),
  destinatarioMeta: new Map(),
};
const tx = (amount: number, month: string): AnalyticsTx => ({
  amount, direction: "OUTFLOW", date: `${month}-15`, categoryId: "c1",
  destinatarioId: null, accountId: "a", expenseType: "variable",
});

test("flags a month >= max(2.5x trailing mean, mean+2sigma)", () => {
  // baseline ~100 for 3 months, then a 400 spike (4x)
  const out = anomalies([tx(100, "2026-03"), tx(100, "2026-04"), tx(100, "2026-05"), tx(400, "2026-06")], cfg);
  expect(out).toHaveLength(1);
  expect(out[0].month).toBe("2026-06");
  expect(out[0].multiple).toBeCloseTo(4);
});

test("does not flag steady spending", () => {
  const out = anomalies([tx(100, "2026-03"), tx(105, "2026-04"), tx(95, "2026-05"), tx(102, "2026-06")], cfg);
  expect(out).toHaveLength(0);
});
```

- [ ] **Step 2: Run, verify fail** — Expected: FAIL.
- [ ] **Step 3: Implement**

```ts
// packages/shared/src/analytics/anomalies.ts
import { categorySeries } from "./category-series";
import type { Anomaly, AnalyticsConfig, AnalyticsTx } from "./types";

// ponytail: threshold heuristic — max(2.5x trailing-3mo mean, mean+2sigma). Tune the
// constants here if false-positive rate is wrong; upgrade path is seasonal baselines.
export function anomalies(rows: readonly AnalyticsTx[], cfg: AnalyticsConfig): Anomaly[] {
  const out: Anomaly[] = [];
  for (const c of categorySeries(rows, cfg)) {
    for (let i = 0; i < c.monthly.length; i++) {
      const hist = c.monthly.slice(Math.max(0, i - 3), i);
      if (hist.length < 2) continue;
      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      if (mean <= 0) continue;
      const variance = hist.reduce((a, b) => a + (b - mean) ** 2, 0) / hist.length;
      const threshold = Math.max(mean * 2.5, mean + 2 * Math.sqrt(variance));
      const value = c.monthly[i];
      if (value > 0 && value >= threshold) {
        out.push({ categoryId: c.categoryId, nameEs: c.nameEs, month: cfg.months[i], amount: value, baseline: mean, multiple: value / mean });
      }
    }
  }
  return out.sort((a, b) => b.multiple - a.multiple);
}
```

Add to `index.ts`: `export * from "./anomalies";`

- [ ] **Step 4: Run, verify pass** — Expected: PASS (2 tests).
- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/analytics/anomalies.ts packages/shared/src/analytics/anomalies.test.ts packages/shared/src/analytics/index.ts
git commit -m "feat(analytics): deterministic anomaly detection"
```

## Task 8: `forecast`

**Files:**
- Create: `packages/shared/src/analytics/forecast.ts`
- Create: `packages/shared/src/analytics/forecast.test.ts`
- Modify: `packages/shared/src/analytics/index.ts`

**Interfaces:**
- Consumes: `CashflowPoint`, `RecurringObligation`, `ForecastPoint`.
- Produces: `forecast(history, currentBalance, recurring, horizonMonths): ForecastPoint[]`. `history` is the output of `incomeVsExpenseSeries`; `horizonMonths` is an ordered list of future "YYYY-MM" keys.

- [ ] **Step 1: Write failing test**

```ts
// packages/shared/src/analytics/forecast.test.ts
import { expect, test } from "vitest";
import { forecast } from "./forecast";
import type { CashflowPoint } from "./types";

const history: CashflowPoint[] = [
  { month: "2026-05", income: 4000, expense: 3000, net: 1000 },
  { month: "2026-06", income: 4000, expense: 3000, net: 1000 },
];

test("projects balance forward using avg net minus extra obligations", () => {
  const out = forecast(history, 5000, [{ month: "2026-08", amount: 500 }], ["2026-07", "2026-08"]);
  expect(out).toHaveLength(2);
  expect(out[0]).toEqual({ month: "2026-07", balance: 6000, projected: true }); // 5000 + 1000
  expect(out[1]).toEqual({ month: "2026-08", balance: 6500, projected: true }); // 6000 + 1000 - 500
});

test("empty history yields flat projection minus obligations", () => {
  const out = forecast([], 1000, [], ["2026-07"]);
  expect(out[0].balance).toBe(1000);
});
```

- [ ] **Step 2: Run, verify fail** — Expected: FAIL.
- [ ] **Step 3: Implement**

```ts
// packages/shared/src/analytics/forecast.ts
import type { CashflowPoint, ForecastPoint, RecurringObligation } from "./types";

// ponytail: linear projection — avg historical net per month, no seasonality.
// Upgrade path is seasonal decomposition if users find it too naive.
export function forecast(
  history: readonly CashflowPoint[],
  currentBalance: number,
  recurring: readonly RecurringObligation[],
  horizonMonths: readonly string[],
): ForecastPoint[] {
  const avgNet = history.length ? history.reduce((a, p) => a + p.net, 0) / history.length : 0;
  const recByMonth = new Map(recurring.map((r) => [r.month, r.amount]));
  let bal = currentBalance;
  return horizonMonths.map((month) => {
    bal = bal + avgNet - (recByMonth.get(month) ?? 0);
    return { month, balance: Math.round(bal), projected: true };
  });
}
```

Add to `index.ts`: `export * from "./forecast";`

- [ ] **Step 4: Run, verify pass** — Expected: PASS (2 tests).
- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/analytics/forecast.ts packages/shared/src/analytics/forecast.test.ts packages/shared/src/analytics/index.ts
git commit -m "feat(analytics): balance forecast (linear projection)"
```

## Task 9: `buildVerdict`

**Files:**
- Create: `packages/shared/src/analytics/verdict.ts`
- Create: `packages/shared/src/analytics/verdict.test.ts`
- Modify: `packages/shared/src/analytics/index.ts`

**Interfaces:**
- Consumes: `SavingsPoint`, `Mover`, `Verdict`, `VerdictTile`.
- Produces: `buildVerdict(input): Verdict` where `input = { savings: SavingsPoint[]; movers: Mover[]; avgExpense: number; avgIncome: number }`. Numbers are pre-formatted by the caller via `formatCurrency`; this fn builds copy + tones from raw values and accepts a `fmt(n:number)=>string` formatter.

- [ ] **Step 1: Write failing test**

```ts
// packages/shared/src/analytics/verdict.test.ts
import { expect, test } from "vitest";
import { buildVerdict } from "./verdict";
import type { Mover, SavingsPoint } from "./types";

const savings: SavingsPoint[] = [
  { month: "2026-05", income: 4000, expense: 3360, rate: 0.16 },
  { month: "2026-06", income: 4550, expense: 3458, rate: 0.24 },
];
const movers: Mover[] = [
  { categoryId: "c1", nameEs: "Restaurantes", color: "#937844", from: 348, to: 410, deltaPct: 18 },
];

test("headline reports latest savings rate; sub names the top accelerating category", () => {
  const v = buildVerdict({ savings, movers, avgExpense: 3409, avgIncome: 4275 }, (n) => `$${Math.round(n)}`);
  expect(v.headline).toContain("24%");
  expect(v.sub).toContain("Restaurantes");
  expect(v.tiles).toHaveLength(3);
  expect(v.tiles[1].value).toContain("24%"); // savings tile
});
```

- [ ] **Step 2: Run, verify fail** — Expected: FAIL.
- [ ] **Step 3: Implement**

```ts
// packages/shared/src/analytics/verdict.ts
import type { Mover, SavingsPoint, Verdict, VerdictTile } from "./types";

interface VerdictInput {
  savings: SavingsPoint[];
  movers: Mover[];
  avgExpense: number;
  avgIncome: number;
}

export function buildVerdict(input: VerdictInput, fmt: (n: number) => string): Verdict {
  const { savings, movers, avgExpense, avgIncome } = input;
  const last = savings[savings.length - 1];
  const prev = savings[savings.length - 2];
  const ratePct = last?.rate == null ? null : Math.round(last.rate * 100);
  const prevRatePct = prev?.rate == null ? null : Math.round(prev.rate * 100);

  let headline = "Aún no hay suficiente historial para un veredicto.";
  if (ratePct !== null) {
    const dir = prevRatePct === null ? "" : ratePct >= prevRatePct ? " — subió" : " — bajó";
    headline = `Tu tasa de ahorro es ${ratePct}%${dir}.`;
  }

  const topMover = movers.find((m) => m.deltaPct > 0);
  const sub = topMover ? `${topMover.nameEs} viene acelerando (${topMover.deltaPct > 0 ? "+" : ""}${Math.round(topMover.deltaPct)}%).` : null;

  const rateDelta = ratePct !== null && prevRatePct !== null ? ratePct - prevRatePct : null;
  const tiles: VerdictTile[] = [
    { label: "Gasto prom/mes", value: fmt(avgExpense), deltaLabel: null, tone: "neutral" },
    {
      label: "Tasa de ahorro",
      value: ratePct === null ? "—" : `${ratePct}%`,
      deltaLabel: rateDelta === null ? null : `${rateDelta >= 0 ? "+" : ""}${rateDelta} pts`,
      tone: rateDelta === null ? "neutral" : rateDelta >= 0 ? "pos" : "neg",
    },
    { label: "Ingreso prom", value: fmt(avgIncome), deltaLabel: null, tone: "neutral" },
  ];

  return { headline, sub, tiles };
}
```

Add to `index.ts`: `export * from "./verdict";`

- [ ] **Step 4: Run, verify pass** — Expected: PASS.
- [ ] **Step 5: Run the full engine suite + commit**

Run: `pnpm --filter @zeta/shared test src/analytics`
Expected: PASS (all analytics tests green).

```bash
git add packages/shared/src/analytics/verdict.ts packages/shared/src/analytics/verdict.test.ts packages/shared/src/analytics/index.ts
git commit -m "feat(analytics): buildVerdict copy generator"
```

## Task 10: Cached dataset action `getTendenciasDataset`

**Files:**
- Create: `webapp/src/actions/analytics.ts`
- Create: `webapp/src/lib/analytics/range.ts` (pure range→window helper, unit-tested)
- Create: `webapp/src/lib/analytics/range.test.ts`

**Interfaces:**
- Consumes: engine config types from `@zeta/shared`; `getAuthenticatedClient`, `createCachedClient`, `isDebtAccountType`.
- Produces: `getTendenciasDataset(range, currency?): Promise<TendenciasDataset>` where
  `TendenciasDataset = { rows: AnalyticsTx[]; config: AnalyticsConfig; currentBalance: number; recurring: RecurringObligation[]; horizonMonths: string[] }`.
  `rangeToWindow(range): { from: string; to: string; months: string[] }`.

- [ ] **Step 1: Write failing test for `rangeToWindow`**

```ts
// webapp/src/lib/analytics/range.test.ts
import { expect, test } from "vitest";
import { rangeToWindow } from "./range";

test("6M window from an anchor produces 6 ordered month keys and correct bounds", () => {
  const { from, to, months } = rangeToWindow("6M", "2026-06-15");
  expect(months).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
  expect(from).toBe("2026-01-01");
  expect(to).toBe("2026-06-30");
});

test("YTD window starts in January of the anchor year", () => {
  const { months } = rangeToWindow("YTD", "2026-04-10");
  expect(months).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
});

test("custom range respects explicit bounds", () => {
  const { months } = rangeToWindow({ from: "2026-03-01", to: "2026-05-31" }, "2026-06-15");
  expect(months).toEqual(["2026-03", "2026-04", "2026-05"]);
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter zeta-webapp test src/lib/analytics/range.test.ts` → FAIL. (Webapp test script: confirm it is `vitest run`; adjust filter name to the webapp package name in `webapp/package.json` if different.)

- [ ] **Step 3: Implement `range.ts`**

```ts
// webapp/src/lib/analytics/range.ts
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns";

export type AnalyticsRange = "3M" | "6M" | "12M" | "YTD" | { from: string; to: string };

function monthKeys(from: Date, to: Date): string[] {
  const out: string[] = [];
  let cur = startOfMonth(from);
  const end = startOfMonth(to);
  while (cur <= end) { out.push(format(cur, "yyyy-MM")); cur = addMonths(cur, 1); }
  return out;
}

/** anchorIso defaults to today; passed explicitly in tests for determinism. */
export function rangeToWindow(range: AnalyticsRange, anchorIso?: string): { from: string; to: string; months: string[] } {
  const anchor = anchorIso ? parseISO(anchorIso) : new Date();
  if (typeof range === "object") {
    const from = parseISO(range.from), to = parseISO(range.to);
    return { from: range.from, to: range.to, months: monthKeys(from, to) };
  }
  const toDate = endOfMonth(anchor);
  let fromDate: Date;
  if (range === "YTD") fromDate = startOfMonth(parseISO(`${format(anchor, "yyyy")}-01-01`));
  else { const n = range === "3M" ? 2 : range === "6M" ? 5 : 11; fromDate = startOfMonth(addMonths(anchor, -n)); }
  return {
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    months: monthKeys(fromDate, toDate),
  };
}
```

- [ ] **Step 4: Run, verify pass** — Expected: PASS (3 tests).

- [ ] **Step 5: Implement the cached action**

Mirror the auth+demo preamble from `webapp/src/actions/charts.ts` `getCategorySpending` (same `getAuthenticatedClient()` → `{ user, accessToken }`, same demo detection). Use the exact filter chain from `getMonthlyCashflowCached`.

```ts
// webapp/src/actions/analytics.ts
"use server";
import { cacheLife, cacheTag } from "next/cache";
import type { AnalyticsConfig, AnalyticsTx, RecurringObligation } from "@zeta/shared";
import { isDebtAccountType } from "@zeta/shared";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import type { CurrencyCode } from "@/types/domain";
import { type AnalyticsRange, rangeToWindow } from "@/lib/analytics/range";
import { getPendingOccurrences } from "@/actions/recurring"; // existing source-of-truth
import { getCategoriesCached, getDestinatariosCached } from "@/actions/...";  // existing cached reads — wire to real paths

export interface TendenciasDataset {
  rows: AnalyticsTx[];
  config: AnalyticsConfig;
  currentBalance: number;
  recurring: RecurringObligation[];
  horizonMonths: string[];
}

export async function getTendenciasDataset(range: AnalyticsRange, currency?: CurrencyCode): Promise<TendenciasDataset> {
  const { user, accessToken } = await getAuthenticatedClient();
  return getTendenciasDatasetCached(accessToken, user.id, range, currency);
}

async function getTendenciasDatasetCached(
  accessToken: string, userId: string, range: AnalyticsRange, currency: CurrencyCode | undefined,
): Promise<TendenciasDataset> {
  "use cache";
  cacheTag("analytics");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);

  const { from, to, months } = rangeToWindow(range);

  const { data: txRows } = await supabase
    .from("transactions")
    .select("transaction_date, amount, direction, category_id, destinatario_id, account_id, currency_code, accounts!account_id(account_type), categories!category_id(expense_type)")
    .eq("user_id", userId)
    .gte("transaction_date", from)
    .lte("transaction_date", to)
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null)
    .is("transfer_group_id", null)
    .or("personal_debt_id.is.null,pd_role.neq.origin");

  // Build debt-account set from the joined account_type.
  const debtAccountIds = new Set<string>();
  const rows: AnalyticsTx[] = (txRows ?? [])
    .filter((r) => !currency || r.currency_code === currency)
    .map((r) => {
      const acctType = (r.accounts as { account_type: string } | null)?.account_type;
      if (acctType && isDebtAccountType(acctType)) debtAccountIds.add(r.account_id);
      return {
        amount: r.amount,
        direction: r.direction as "INFLOW" | "OUTFLOW",
        date: r.transaction_date,
        categoryId: r.category_id,
        destinatarioId: r.destinatario_id,
        accountId: r.account_id,
        expenseType: ((r.categories as { expense_type: string } | null)?.expense_type ?? null) as AnalyticsTx["expenseType"],
      };
    });

  // categoryMeta / destinatarioMeta from existing cached reads (names, colors, budget targets).
  const [categories, destinatarios] = await Promise.all([getCategoriesCached(accessToken, userId), getDestinatariosCached(accessToken, userId)]);
  const categoryMeta = new Map(categories.map((c) => [c.id, { nameEs: c.name_es ?? c.name, color: c.color, expenseType: c.expense_type ?? null, budgetTarget: c.budget_target ?? null }]));
  const destinatarioMeta = new Map(destinatarios.map((d) => [d.id, { name: d.name, color: d.color ?? "#938C7E" }]));

  // currentBalance: sum of non-debt account balances (reuse existing accounts read).
  const currentBalance = 0; // TODO-IN-TASK: wire to existing getAccounts deposit-balance sum
  // recurring obligations for the next 3 months → forecast input.
  const occ = await getPendingOccurrences();
  const horizonMonths = nextMonthsAfter(months[months.length - 1], 3);
  const recurring: RecurringObligation[] = aggregateOccurrencesByMonth(occ, horizonMonths);

  const config: AnalyticsConfig = { months, debtAccountIds, categoryMeta, destinatarioMeta };
  return { rows, config, currentBalance, recurring, horizonMonths };
}
```

> Implementation note for the worker: `getCategoriesCached`/`getDestinatariosCached`, the deposit-balance sum, `nextMonthsAfter`, and `aggregateOccurrencesByMonth` are small helpers — wire `getCategoriesCached`/`getDestinatariosCached`/accounts to the **existing** cached actions (grep `actions/categories.ts`, `actions/destinatarios.ts`, `actions/accounts.ts`); implement `nextMonthsAfter(lastMonth, n)` and `aggregateOccurrencesByMonth` as 5-line pure helpers in `webapp/src/lib/analytics/range.ts` with one test each. Do not introduce new uncached DB reads — reuse cached actions only.

- [ ] **Step 6: Build gate**

Run: `pnpm --filter zeta-webapp build` (or root `cd webapp && pnpm build`)
Expected: compiles clean (types resolve, no missing imports).

- [ ] **Step 7: Commit**

```bash
git add webapp/src/actions/analytics.ts webapp/src/lib/analytics/range.ts webapp/src/lib/analytics/range.test.ts
git commit -m "feat(analytics): getTendenciasDataset cached action + range window"
```

## Task 11: Cache invalidation wiring

**Files:**
- Modify: `webapp/src/actions/<file containing revalidateFinancialViews>` (grep `revalidateFinancialViews`)

**Interfaces:**
- Consumes: `updateTag` from `next/cache`.
- Produces: transaction mutations now expire the `"analytics"` tag.

- [ ] **Step 1: Add the tag**

In `revalidateFinancialViews()`, add alongside the existing dashboard tags:
```ts
updateTag("analytics");
```
Verify it uses `updateTag` (from `next/cache`), not `revalidateTag`.

- [ ] **Step 2: Build gate**

Run: `cd webapp && pnpm build` → clean.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(analytics): expire analytics cache tag on transaction mutations"
```

**Phase 1 gate:** `pnpm --filter @zeta/shared test` (all green) + `cd webapp && pnpm build` (clean). The engine is now fully usable headlessly.

---

# PHASE 2 — Shell + Lens 1 (Gastos)

IA Direction B: a pinned verdict+tiles header, period control, segmented control (3 lenses), only the active lens mounts charts. Reuse design tokens and existing primitives. Components live in `webapp/src/components/tendencias/`.

## Task 12: Route + shell skeleton

**Files:**
- Create: `webapp/src/app/(dashboard)/tendencias/page.tsx`
- Create: `webapp/src/components/tendencias/tendencias-shell.tsx`
- Create: `webapp/src/components/tendencias/verdict-header.tsx`
- Create: `webapp/src/components/tendencias/period-control.tsx`

**Interfaces:**
- Consumes: `getTendenciasDataset`, all engine functions, `buildVerdict`, `formatCurrency`.
- Produces: a server page that builds view-models and renders `<TendenciasShell>`; `TendenciasShell` owns segmented-lens state.

- [ ] **Step 1: Server page builds view-models**

```tsx
// webapp/src/app/(dashboard)/tendencias/page.tsx
import { Suspense } from "react";
import {
  buildVerdict, categorySeries, topRecipients, fixedVsVariable, savingsRateSeries,
  incomeVsExpenseSeries, budgetAdherenceSeries, movers, anomalies, forecast,
} from "@zeta/shared";
import { getTendenciasDataset } from "@/actions/analytics";
import { formatCurrency } from "@/lib/utils/currency";
import type { AnalyticsRange } from "@/lib/analytics/range";
import { TendenciasShell } from "@/components/tendencias/tendencias-shell";

export default async function TendenciasPage({ searchParams }: { searchParams: Promise<{ range?: string; currency?: string }> }) {
  const sp = await searchParams;
  const range = (sp.range as AnalyticsRange) ?? "6M";
  const ds = await getTendenciasDataset(range, sp.currency as never);
  const { rows, config } = ds;

  const cats = categorySeries(rows, config);
  const cashflow = incomeVsExpenseSeries(rows, config);
  const savings = savingsRateSeries(rows, config);
  const avgIncome = cashflow.reduce((a, p) => a + p.income, 0) / Math.max(cashflow.length, 1);
  const avgExpense = cashflow.reduce((a, p) => a + p.expense, 0) / Math.max(cashflow.length, 1);
  const fmt = (n: number) => formatCurrency(n, sp.currency ?? "COP");

  const vm = {
    range,
    verdict: buildVerdict({ savings, movers: movers(cats), avgExpense, avgIncome }, fmt),
    gastos: { categories: cats, recipients: topRecipients(rows, config), fixedVariable: fixedVsVariable(rows, config) },
    ahorro: { savings, cashflow, adherence: budgetAdherenceSeries(rows, config) },
    cambios: { movers: movers(cats), anomalies: anomalies(rows, config), forecast: forecast(cashflow, ds.currentBalance, ds.recurring, ds.horizonMonths) },
  };
  return <TendenciasShell vm={vm} />;
}
```

- [ ] **Step 2: Shell with segmented lenses**

```tsx
// webapp/src/components/tendencias/tendencias-shell.tsx
"use client";
import { useState } from "react";
import { VerdictHeader } from "./verdict-header";
import { PeriodControl } from "./period-control";
// Lens components imported in Phase 2–4 tasks.

type Lens = "gastos" | "ahorro" | "cambios";
const LENSES: { id: Lens; label: string }[] = [
  { id: "gastos", label: "¿A dónde va?" },
  { id: "ahorro", label: "¿Voy bien?" },
  { id: "cambios", label: "¿Cambios?" },
];

export function TendenciasShell({ vm }: { vm: any }) {
  const [lens, setLens] = useState<Lens>("gastos");
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10">
      <div className="pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">Análisis</p>
        <h1 className="text-2xl font-semibold tracking-tight">Tendencias</h1>
      </div>
      <VerdictHeader verdict={vm.verdict} />
      <PeriodControl range={vm.range} />
      <div role="tablist" className="mt-4 flex gap-1 rounded-xl border border-white/6 bg-z-surface-2/60 p-1">
        {LENSES.map((l) => (
          <button
            key={l.id}
            role="tab"
            aria-selected={lens === l.id}
            onClick={() => setLens(l.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              lens === l.id ? "bg-z-brass/12 text-z-brass" : "text-z-sage-dark hover:text-z-sage-light"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {/* Phase 2: {lens === "gastos" && <LensGastos data={vm.gastos} />} */}
        {/* Phase 3: {lens === "ahorro" && <LensAhorro data={vm.ahorro} />} */}
        {/* Phase 4: {lens === "cambios" && <LensCambios data={vm.cambios} />} */}
      </div>
    </div>
  );
}
```

> Type the `vm` prop properly (export a `TendenciasViewModel` type from the page and import it) once Lens props exist; `any` is a temporary scaffold removed in Task 13.

- [ ] **Step 3: VerdictHeader (variant 2b)**

```tsx
// webapp/src/components/tendencias/verdict-header.tsx
import type { Verdict } from "@zeta/shared";

export function VerdictHeader({ verdict }: { verdict: Verdict }) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-3 rounded-2xl border border-z-brass/25 bg-z-brass/8 p-3">
        <span className="text-lg">📈</span>
        <div>
          <p className="text-sm font-semibold">{verdict.headline}</p>
          {verdict.sub && <p className="text-xs text-z-sage-dark">{verdict.sub}</p>}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {verdict.tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-white/6 bg-black/10 p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-z-sage-dark">{t.label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{t.value}</p>
            {t.deltaLabel && (
              <p className={`mt-0.5 text-[10px] font-semibold ${t.tone === "pos" ? "text-z-income" : t.tone === "neg" ? "text-z-expense" : "text-z-sage-dark"}`}>{t.deltaLabel}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: PeriodControl (searchParam-driven)**

```tsx
// webapp/src/components/tendencias/period-control.tsx
"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const RANGES = ["3M", "6M", "12M", "YTD"] as const;

export function PeriodControl({ range }: { range: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  function setRange(r: string) {
    const next = new URLSearchParams(params);
    next.set("range", r);
    router.push(`${pathname}?${next.toString()}`);
  }
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => setRange(r)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            range === r ? "border-z-brass/25 bg-z-brass/10 text-z-brass" : "border-white/6 bg-white/3 text-z-sage-dark"
          }`}
        >
          {r === "YTD" ? "Año" : r}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Build gate** — `cd webapp && pnpm build` → clean (page renders empty lens area).
- [ ] **Step 6: Commit**

```bash
git add webapp/src/app/\(dashboard\)/tendencias webapp/src/components/tendencias
git commit -m "feat(tendencias): route + segmented-lens shell, verdict header, period control"
```

## Task 13: Lens 1 — Gastos (category trend 1c + recipients + fixed/variable)

**Files:**
- Create: `webapp/src/components/tendencias/lens-gastos.tsx`
- Create: `webapp/src/components/tendencias/category-trend-list.tsx`
- Create: `webapp/src/components/tendencias/top-recipients-card.tsx`
- Create: `webapp/src/components/tendencias/fixed-variable-card.tsx`
- Modify: `tendencias-shell.tsx` (mount `LensGastos`, replace `any` vm type)

**Interfaces:**
- Consumes: `CategoryTrend[]`, `RecipientRank[]`, `FixedVariable`, `formatCurrency`.
- Produces: `LensGastos`, mounted when `lens === "gastos"`.

- [ ] **Step 1: `CategoryTrendList` (variant 1c — ranking + sparkline rows)**

```tsx
// webapp/src/components/tendencias/category-trend-list.tsx
import type { CategoryTrend } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(...points, 1);
  const w = 56, h = 18;
  const d = points.map((p, i) => `${(i / Math.max(points.length - 1, 1)) * w},${h - (p / max) * h}`).join(" ");
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><polyline points={d} fill="none" stroke={color} strokeWidth="1.6" /></svg>;
}

export function CategoryTrendList({ categories, currency }: { categories: CategoryTrend[]; currency: string }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-z-surface-2/80 p-4">
      <p className="mb-3 text-sm font-semibold">Gasto por categoría</p>
      {categories.slice(0, 8).map((c) => (
        <div key={c.categoryId} className="flex items-center gap-3 border-t border-white/6 py-2 first:border-t-0">
          <span className="size-2.5 shrink-0 rounded" style={{ background: c.color }} />
          <span className="min-w-0 flex-1 truncate text-sm">{c.nameEs}</span>
          <Sparkline points={c.monthly} color={c.color} />
          <span className="text-sm font-semibold tabular-nums">{formatCurrency(c.total, currency)}</span>
          {c.momPct !== null && (
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${c.momPct > 0 ? "bg-z-expense/12 text-z-expense" : c.momPct < 0 ? "bg-z-income/10 text-z-income" : "text-z-sage-dark"}`}>
              {c.momPct > 0 ? "▲" : c.momPct < 0 ? "▼" : "~"} {Math.abs(Math.round(c.momPct))}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `TopRecipientsCard`**

```tsx
// webapp/src/components/tendencias/top-recipients-card.tsx
import type { RecipientRank } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";

export function TopRecipientsCard({ recipients, currency }: { recipients: RecipientRank[]; currency: string }) {
  const max = Math.max(...recipients.map((r) => r.total), 1);
  return (
    <div className="mt-3 rounded-2xl border border-white/6 bg-z-surface-2/80 p-4">
      <p className="mb-3 text-sm font-semibold">¿A dónde va? · Top destinatarios</p>
      {recipients.map((r) => (
        <div key={r.destinatarioId ?? "none"} className="flex items-center gap-3 border-t border-white/6 py-2.5 first:border-t-0">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-z-ink" style={{ background: r.color }}>{r.name.charAt(0)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold">{r.name}</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(r.total, currency)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full" style={{ width: `${(r.total / max) * 100}%`, background: r.color }} /></div>
            <p className="mt-1 text-[11px] text-z-sage-dark">{r.count} mov.</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `FixedVariableCard`**

```tsx
// webapp/src/components/tendencias/fixed-variable-card.tsx
import type { FixedVariable } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";

export function FixedVariableCard({ data, currency }: { data: FixedVariable; currency: string }) {
  const total = data.fixed + data.variable || 1;
  const fixedPct = Math.round((data.fixed / total) * 100);
  return (
    <div className="mt-3 rounded-2xl border border-white/6 bg-z-surface-2/80 p-4">
      <p className="mb-3 text-sm font-semibold">Fijos vs. variables</p>
      <div className="flex h-7 overflow-hidden rounded-lg border border-white/6">
        <div className="flex items-center justify-center bg-z-brass text-[11px] font-semibold text-z-ink" style={{ width: `${fixedPct}%` }}>Fijos {fixedPct}%</div>
        <div className="flex items-center justify-center bg-z-expense text-[11px] font-semibold text-z-ink" style={{ width: `${100 - fixedPct}%` }}>Variables {100 - fixedPct}%</div>
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-z-sage-dark">
        <span>Fijos <b className="text-z-white tabular-nums">{formatCurrency(data.fixed, currency)}</b></span>
        <span>Variables <b className="text-z-white tabular-nums">{formatCurrency(data.variable, currency)}</b></span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `LensGastos` composition + mount in shell**

```tsx
// webapp/src/components/tendencias/lens-gastos.tsx
import type { CategoryTrend, FixedVariable, RecipientRank } from "@zeta/shared";
import { CategoryTrendList } from "./category-trend-list";
import { TopRecipientsCard } from "./top-recipients-card";
import { FixedVariableCard } from "./fixed-variable-card";

export interface GastosData { categories: CategoryTrend[]; recipients: RecipientRank[]; fixedVariable: FixedVariable; }

export function LensGastos({ data, currency }: { data: GastosData; currency: string }) {
  return (
    <>
      <CategoryTrendList categories={data.categories} currency={currency} />
      <TopRecipientsCard recipients={data.recipients} currency={currency} />
      <FixedVariableCard data={data.fixedVariable} currency={currency} />
    </>
  );
}
```

In `tendencias-shell.tsx`: import `LensGastos`, render `{lens === "gastos" && <LensGastos data={vm.gastos} currency={vm.currency} />}`, thread a real `currency` field through the page view-model, and replace the `vm: any` with an exported `TendenciasViewModel` type.

- [ ] **Step 5: Build gate** — `cd webapp && pnpm build` → clean.
- [ ] **Step 6: Visual check** — `cd webapp && pnpm dev`, open `/tendencias`, confirm Gastos lens renders the three cards with seeded data. (Don't build against a running dev server — stop dev before any `pnpm build`.)
- [ ] **Step 7: Commit**

```bash
git add webapp/src/components/tendencias
git commit -m "feat(tendencias): Lens 1 — category trend (1c), top recipients, fixed/variable"
```

- [ ] **Step 8: Design gate** — spawn `zetas-front-guy` on the new `webapp/src/components/tendencias/*` files; fix any token/variant violations it flags.

---

# PHASE 3 — Lens 2 (Ahorro)

## Task 14: Savings rate + income-vs-expense + budget adherence

**Files:**
- Create: `webapp/src/components/tendencias/lens-ahorro.tsx`
- Create: `webapp/src/components/tendencias/savings-rate-card.tsx`
- Create: `webapp/src/components/tendencias/income-expense-card.tsx`
- Create: `webapp/src/components/tendencias/budget-adherence-card.tsx`
- Modify: `tendencias-shell.tsx` (mount `LensAhorro`)

**Interfaces:**
- Consumes: `SavingsPoint[]`, `CashflowPoint[]`, `AdherencePoint[]`. Reuse the existing `MonthlyCashflowChart` (grep `webapp/src/components/charts/monthly-cashflow-chart.tsx`) for income-vs-expense rather than re-plotting.
- Produces: `LensAhorro`, mounted when `lens === "ahorro"`.

- [ ] **Step 1: `SavingsRateCard`** — recharts `AreaChart` over `savings.map(s => ({ month: s.month, rate: s.rate ? Math.round(s.rate*100) : 0 }))`, brass stroke, a `ReferenceLine y={20}` labeled "meta 20%", current rate shown large. Use `--z-brass` / `--z-income` token colors (read CSS var values; do not hardcode new hexes — pass token-derived constants).

```tsx
// webapp/src/components/tendencias/savings-rate-card.tsx
"use client";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer } from "recharts";
import type { SavingsPoint } from "@zeta/shared";

export function SavingsRateCard({ savings }: { savings: SavingsPoint[] }) {
  const data = savings.map((s) => ({ month: s.month, rate: s.rate == null ? 0 : Math.round(s.rate * 100) }));
  const current = data[data.length - 1]?.rate ?? 0;
  return (
    <div className="rounded-2xl border border-white/6 bg-z-surface-2/80 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Tasa de ahorro</p>
        <span className="text-lg font-bold tabular-nums text-z-brass">{current}%</span>
      </div>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs><linearGradient id="srGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--z-brass-hot)" stopOpacity={0.4} /><stop offset="1" stopColor="var(--z-brass-hot)" stopOpacity={0.03} /></linearGradient></defs>
            <ReferenceLine y={20} stroke="var(--z-income)" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="rate" stroke="var(--z-brass-hot)" strokeWidth={2.2} fill="url(#srGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `IncomeExpenseCard`** — wrap the existing `MonthlyCashflowChart` if its prop shape accepts `CashflowPoint[]`; otherwise a thin recharts grouped `BarChart` (income `--z-income`, expense `--z-expense`) with an average-net caption. Reuse before rebuild — inspect the existing component's props first.
- [ ] **Step 3: `BudgetAdherenceCard`** — list rows: category name + "excedido N de M meses" + the MoM delta chip (reuse the chip styling from `category-trend-list.tsx`). Sort by `monthsExceeded` (already sorted by engine).
- [ ] **Step 4: `LensAhorro`** composition + mount in shell (`{lens === "ahorro" && <LensAhorro data={vm.ahorro} currency={vm.currency} />}`).
- [ ] **Step 5: Build gate** — clean.
- [ ] **Step 6: Visual check** on `/tendencias` Ahorro lens.
- [ ] **Step 7: Commit** — `git commit -m "feat(tendencias): Lens 2 — savings rate, income-vs-expense, budget adherence"`
- [ ] **Step 8: Design gate** — `zetas-front-guy` on the new components.

---

# PHASE 4 — Lens 3 (Cambios)

## Task 15: Movers + anomalies + forecast

**Files:**
- Create: `webapp/src/components/tendencias/lens-cambios.tsx`
- Create: `webapp/src/components/tendencias/movers-card.tsx`
- Create: `webapp/src/components/tendencias/anomalies-card.tsx`
- Create: `webapp/src/components/tendencias/forecast-card.tsx`
- Modify: `tendencias-shell.tsx` (mount `LensCambios`)

**Interfaces:**
- Consumes: `Mover[]`, `Anomaly[]`, `ForecastPoint[]` (history points carry `projected:false`, forecast points `projected:true`), `formatCurrency`.
- Produces: `LensCambios`, mounted when `lens === "cambios"`.

- [ ] **Step 1: `MoversCard`** — rows: color dot + category + `from → to` (formatted) + delta chip (reuse chip class). `data.movers` already sorted by |delta|.
- [ ] **Step 2: `AnomaliesCard`** — alert-styled rows (brass-ghost surface): "⚠️ Compra inusual en {nameEs}" + "{amount} en {month} — {multiple}× tu promedio". Empty state: "Sin anomalías en el periodo." when `anomalies.length === 0`.
- [ ] **Step 3: `ForecastCard`** — recharts `LineChart`: solid segment for `projected:false`, dashed for `projected:true`, a `ReferenceLine x` at "hoy" boundary, caption "No incluye ingresos no confirmados." Colors via `--z-income` (history) / `--z-brass-hot` (projection).

```tsx
// webapp/src/components/tendencias/forecast-card.tsx
"use client";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { ForecastPoint } from "@zeta/shared";

export function ForecastCard({ points }: { points: ForecastPoint[] }) {
  // Two overlaid series so the projected tail renders dashed.
  const data = points.map((p) => ({ month: p.month, hist: p.projected ? null : p.balance, proj: p.projected ? p.balance : null }));
  // bridge: last historical point also seeds proj so the dashed line connects
  const lastHistIdx = points.findLastIndex((p) => !p.projected);
  if (lastHistIdx >= 0 && data[lastHistIdx]) data[lastHistIdx].proj = points[lastHistIdx].balance;
  return (
    <div className="mt-3 rounded-2xl border border-white/6 bg-z-surface-2/80 p-4">
      <p className="mb-2 text-sm font-semibold">Proyección de saldo</p>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="hist" stroke="var(--z-income)" strokeWidth={2.2} dot={false} connectNulls />
            <Line type="monotone" dataKey="proj" stroke="var(--z-brass-hot)" strokeWidth={2.2} strokeDasharray="4 4" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-z-sage-dark">No incluye ingresos no confirmados.</p>
    </div>
  );
}
```

- [ ] **Step 4: `LensCambios`** composition + mount in shell.
- [ ] **Step 5: Build gate** — clean.
- [ ] **Step 6: Visual check** on `/tendencias` Cambios lens.
- [ ] **Step 7: Commit** — `git commit -m "feat(tendencias): Lens 3 — movers, anomalies, forecast"`
- [ ] **Step 8: Design gate** — `zetas-front-guy` on the new components.

---

# PHASE 5 — Nav entry points, export, gates

## Task 16: Navigation entry points

**Files:**
- Modify: desktop sidebar nav (grep the nav item list, likely `webapp/src/components/.../sidebar*.tsx` or a nav constants file)
- Modify: mobile "Me"/more menu (grep the settings/more menu list)
- Modify: a Dashboard section to add a "Ver tendencias →" link (grep `webapp/src/app/(dashboard)/dashboard/page.tsx` section headers)

**Interfaces:**
- Produces: `/tendencias` reachable from desktop sidebar, mobile "Me" menu, and a Dashboard CTA. Do NOT add to `FOCUS_MODE_PATHS`.

- [ ] **Step 1:** Add a "Tendencias" item (icon: lucide `TrendingUp`) to the desktop sidebar nav list, route `/tendencias`.
- [ ] **Step 2:** Add the same to the mobile "Me"/more menu list.
- [ ] **Step 3:** Add a `BRASS_GHOST_BUTTON_CLASS` "Ver tendencias →" link in the Dashboard's Flujo (cashflow) section header.
- [ ] **Step 4: Build gate** — clean.
- [ ] **Step 5: Commit** — `git commit -m "feat(tendencias): nav entry points (sidebar, Me menu, dashboard CTA)"`

## Task 17: CSV export

**Files:**
- Create: `webapp/src/components/tendencias/export-button.tsx`
- Modify: `tendencias-shell.tsx` (render in header)

**Interfaces:**
- Consumes: the active view-model series.
- Produces: a client button that builds a CSV string in-memory and triggers a download — no library.

- [ ] **Step 1: Implement** — flatten `categorySeries` (category × month matrix) to CSV rows, `new Blob([csv], {type:"text/csv"})`, `URL.createObjectURL`, anchor click, revoke. Filename `tendencias-{range}.csv`.
- [ ] **Step 2: Build gate** — clean.
- [ ] **Step 3: Commit** — `git commit -m "feat(tendencias): CSV export of the period"`

## Task 18: Final gates

- [ ] **Step 1:** `pnpm install` (lockfile sync if any dep changed — none expected) + `cd webapp && pnpm build` clean.
- [ ] **Step 2:** `pnpm --filter @zeta/shared test` all green.
- [ ] **Step 3:** Spawn `perf-auditor` (webapp feature gate) — verify no uncached DB reads on the render path, only active lens mounts charts, dataset is a single cached fetch.
- [ ] **Step 4:** Spawn `server-action-reviewer` on `webapp/src/actions/analytics.ts` — auth, defense-in-depth `.eq("user_id")`, `updateTag` wiring.
- [ ] **Step 5:** Spawn `frontend-auditor` for a full design-system pass on the Tendencias surface.
- [ ] **Step 6:** Address any P0/P1 findings; commit fixes.
- [ ] **Step 7:** Update `BACKLOG.md` with the two deferred items (historical-budget table; mobile Tendencias screen reusing the engine) and the forecast/anomaly heuristic-tuning notes.

---

## Self-Review (completed by plan author)

**Spec coverage:** ✅ Every spec §2 engine function → Task 2–9. Layer 2 dataset → Task 10. Cache wiring → Task 11. IA Direction B shell → Task 12. Three lenses → Tasks 13–15. Nav (§3 decision) → Task 16. Export → Task 17. Caveats (§5) carried into engine comments + BACKLOG (Task 18.7). Testing (§6) → engine unit tests per task + range helper test + visual checks.

**Placeholder scan:** One intentional `// TODO-IN-TASK` in Task 10 Step 5 (currentBalance wiring) is scoped with an explicit implementation note naming the exact existing actions to reuse — it is an instruction, not a deferral. UI tasks 14–17 specify file paths, prop types, reuse targets, and the key logic; recharts card bodies that mirror Task 13's spelled-out patterns are described structurally rather than re-pasted to avoid drift.

**Type consistency:** ✅ `AnalyticsTx`/`AnalyticsConfig`/all result types defined in Task 1, consumed unchanged downstream. `forecast` consumes `CashflowPoint[]` (Task 3 output) — matches. `budgetAdherenceSeries`/`anomalies` consume `categorySeries` (Task 2) — matches. `buildVerdict` consumes `SavingsPoint[]` + `Mover[]` — matches.

**Note for the implementer:** confirm the webapp Vitest filter name (`webapp/package.json` "name") and the exact paths of `getCategoriesCached`/`getDestinatariosCached`/accounts cached reads before Task 10; they exist but the barrel paths must be grepped, not guessed.
