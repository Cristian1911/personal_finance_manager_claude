# Deudas Lenses (`/deudas` Mobile 3-Lens Redesign) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure mobile `/deudas` into three segmented lenses (Carga / Plan / Cuentas) with an honest month-over-month trend replacing the static "Manejable" badge.

**Architecture:** New client `DeudasLensRoot` replaces `DeudasRoot`; lens choice persists in `localStorage`. New pure trend logic in `@zeta/shared` (TDD), one new cached server action `getDebtTrend()`, one new canonical `DebtAccountRow` card. `DeudasGrid` and `DeudasAccountsAccordion` retire (mobile only). Desktop `/deudas`, `/plan`, `/deudas-personales`, RN app: untouched.

**Tech Stack:** Next.js 16 App Router, `"use cache"` + `cacheTag`/`cacheLife("zeta")`, `createCachedClient`, Tailwind v4 with Zeta tokens, Vitest (packages/shared).

**Spec:** `docs/superpowers/specs/2026-06-09-deudas-lenses-design.md`

**Branch:** `feat/deudas-lenses` (already created from origin/main)

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `packages/shared/src/utils/debt-trend.ts` | `computeDebtTrend`, `detectExtraPayments` (pure) |
| Create | `packages/shared/src/utils/__tests__/debt-trend.test.ts` | Unit tests |
| Modify | `packages/shared/src/index.ts` | Export new module |
| Modify | `webapp/src/actions/debt.ts` | Add `getDebtTrend()` + `DebtTrendData` |
| Create | `webapp/src/components/debt/debt-account-row.tsx` | Canonical compact debt account card |
| Create | `webapp/src/components/mobile/v2/deudas/debt-trend-card.tsx` | Honest trend card + sparkline |
| Create | `webapp/src/components/mobile/v2/deudas/deudas-lens-root.tsx` | Lens shell (segmented control + localStorage) + Carga lens |
| Create | `webapp/src/components/mobile/v2/deudas/deudas-plan-lens.tsx` | Plan lens |
| Create | `webapp/src/components/mobile/v2/deudas/deudas-cuentas-lens.tsx` | Cuentas lens |
| Modify | `webapp/src/components/mobile/v2/deudas/deudas-hero.tsx` | Remove "Manejable" pressure chip |
| Modify | `webapp/src/components/accounts/accounts-section.tsx` | Add `hideDebt` prop |
| Modify | `webapp/src/app/(dashboard)/deudas/page.tsx` | Wire new data + lens root in `MobileDebtSection` |
| Delete | `webapp/src/components/mobile/v2/deudas/deudas-root.tsx` | Replaced by lens root |
| Delete | `webapp/src/components/mobile/v2/deudas/deudas-grid.tsx` | Retired (content redistributed) |
| Delete | `webapp/src/components/mobile/v2/deudas/deudas-accounts-accordion.tsx` | Replaced by `DebtAccountRow` list |

**Spec deviation (approved rationale):** the in-page duplication the user flagged is `/deudas` mobile rendering debt accounts twice (lens inventory + `AccountsSection`). Fix = `AccountsSection hideDebt` on mobile `/deudas` + single canonical list in the Cuentas lens. `DebtAccountRow` is exported from `components/debt/` so accounts surfaces can adopt it later; rewiring `/accounts` is out of scope.

---

### Task 1: `computeDebtTrend` in @zeta/shared (TDD)

**Files:**
- Create: `packages/shared/src/utils/debt-trend.ts`
- Create: `packages/shared/src/utils/__tests__/debt-trend.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/shared/src/utils/__tests__/debt-trend.test.ts
import { describe, it, expect } from "vitest";
import { computeDebtTrend } from "../debt-trend";

describe("computeDebtTrend", () => {
  it("returns mejorando when cuota dropped more than 5%", () => {
    const r = computeDebtTrend(900_000, 1_000_000);
    expect(r.status).toBe("mejorando");
    expect(r.deltaPct).toBeCloseTo(-10);
  });

  it("returns mejorando at exactly -5%", () => {
    expect(computeDebtTrend(950_000, 1_000_000).status).toBe("mejorando");
  });

  it("returns estable for flat cuota", () => {
    const r = computeDebtTrend(1_000_000, 1_000_000);
    expect(r.status).toBe("estable");
    expect(r.deltaPct).toBe(0);
  });

  it("returns estable at exactly +10%", () => {
    expect(computeDebtTrend(1_100_000, 1_000_000).status).toBe("estable");
  });

  it("returns mes_pesado above +10%", () => {
    const r = computeDebtTrend(1_120_000, 1_000_000);
    expect(r.status).toBe("mes_pesado");
    expect(r.deltaPct).toBeCloseTo(12);
  });

  it("returns nulls when previous period is missing or zero (never guess)", () => {
    expect(computeDebtTrend(1_000_000, null)).toEqual({ deltaPct: null, status: null });
    expect(computeDebtTrend(1_000_000, 0)).toEqual({ deltaPct: null, status: null });
    expect(computeDebtTrend(null, 1_000_000)).toEqual({ deltaPct: null, status: null });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/shared && pnpm vitest run debt-trend`
Expected: FAIL — `Cannot find module '../debt-trend'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/shared/src/utils/debt-trend.ts
/**
 * Honest month-over-month debt-load trend.
 *
 * The status chip states the TREND of the monthly cuota, never affordability.
 * Thresholds (approved in spec 2026-06-09-deudas-lenses-design.md):
 *   delta <= -5%  -> "mejorando"
 *   delta <= +10% -> "estable"
 *   delta >  +10% -> "mes_pesado"
 * No previous period -> nulls (UI shows "Sin historial suficiente", no chip).
 */
export type DebtTrendStatus = "mejorando" | "estable" | "mes_pesado";

export interface DebtTrendResult {
  deltaPct: number | null;
  status: DebtTrendStatus | null;
}

export function computeDebtTrend(
  currentCuota: number | null,
  previousCuota: number | null
): DebtTrendResult {
  if (
    currentCuota == null ||
    previousCuota == null ||
    !Number.isFinite(currentCuota) ||
    !Number.isFinite(previousCuota) ||
    previousCuota <= 0
  ) {
    return { deltaPct: null, status: null };
  }
  const deltaPct = ((currentCuota - previousCuota) / previousCuota) * 100;
  const status: DebtTrendStatus =
    deltaPct <= -5 ? "mejorando" : deltaPct <= 10 ? "estable" : "mes_pesado";
  return { deltaPct, status };
}
```

- [ ] **Step 4: Export from package index**

In `packages/shared/src/index.ts`, after the line `export * from "./utils/debt-stats";` add:

```typescript
export * from "./utils/debt-trend";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/shared && pnpm vitest run debt-trend`
Expected: 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/utils/debt-trend.ts packages/shared/src/utils/__tests__/debt-trend.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): computeDebtTrend — honest MoM debt-load classifier"
```

---

### Task 2: `detectExtraPayments` in @zeta/shared (TDD)

**Files:**
- Modify: `packages/shared/src/utils/debt-trend.ts`
- Modify: `packages/shared/src/utils/__tests__/debt-trend.test.ts`

- [ ] **Step 1: Write the failing tests** (append to the existing test file)

```typescript
import { detectExtraPayments } from "../debt-trend";

describe("detectExtraPayments", () => {
  const expected = [
    { accountId: "cc-1", cuota: 500_000 },
    { accountId: "loan-1", cuota: 700_000 },
  ];

  it("counts payments made after the cuota was already covered", () => {
    const r = detectExtraPayments(
      [
        { accountId: "cc-1", amount: 500_000, date: "2026-06-02" },
        { accountId: "cc-1", amount: 300_000, date: "2026-06-15" }, // extra
        { accountId: "loan-1", amount: 700_000, date: "2026-06-05" },
      ],
      expected
    );
    expect(r.count).toBe(1);
    expect(r.totalExtra).toBe(300_000);
  });

  it("sorts by date before deciding which payment is extra", () => {
    const r = detectExtraPayments(
      [
        { accountId: "cc-1", amount: 300_000, date: "2026-06-15" },
        { accountId: "cc-1", amount: 500_000, date: "2026-06-02" },
      ],
      expected
    );
    expect(r.count).toBe(1); // the June 15 payment is the extra one
  });

  it("reports zero when payments only cover the cuota", () => {
    const r = detectExtraPayments(
      [{ accountId: "cc-1", amount: 500_000, date: "2026-06-02" }],
      expected
    );
    expect(r).toEqual({ count: 0, totalExtra: 0 });
  });

  it("treats any payment as extra when the account has no expected cuota", () => {
    const r = detectExtraPayments(
      [{ accountId: "cc-2", amount: 200_000, date: "2026-06-03" }],
      expected
    );
    expect(r.count).toBe(1);
    expect(r.totalExtra).toBe(200_000);
  });

  it("handles empty inputs", () => {
    expect(detectExtraPayments([], expected)).toEqual({ count: 0, totalExtra: 0 });
    expect(detectExtraPayments([], [])).toEqual({ count: 0, totalExtra: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/shared && pnpm vitest run debt-trend`
Expected: FAIL — `detectExtraPayments is not a function` (Task 1 tests still pass)

- [ ] **Step 3: Implement** (append to `debt-trend.ts`)

```typescript
/** A payment (INFLOW transaction) made to a debt account this month. */
export interface DebtPaymentTx {
  accountId: string;
  amount: number;
  date: string; // YYYY-MM-DD
}

/** Expected cuota for one debt account this month. */
export interface ExpectedCuota {
  accountId: string;
  cuota: number;
}

export interface ExtraPaymentsResult {
  /** Number of payment transactions made after the cuota was already covered. */
  count: number;
  /** Total amount paid above the expected cuotas. */
  totalExtra: number;
}

export function detectExtraPayments(
  payments: DebtPaymentTx[],
  expected: ExpectedCuota[]
): ExtraPaymentsResult {
  const cuotaByAccount = new Map(expected.map((e) => [e.accountId, e.cuota]));

  const byAccount = new Map<string, DebtPaymentTx[]>();
  for (const p of payments) {
    const list = byAccount.get(p.accountId) ?? [];
    list.push(p);
    byAccount.set(p.accountId, list);
  }

  let count = 0;
  let totalExtra = 0;

  for (const [accountId, txs] of byAccount) {
    const cuota = cuotaByAccount.get(accountId) ?? 0;
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

    if (cuota <= 0) {
      // No expected cuota for this account: every payment is "extra".
      count += sorted.length;
      totalExtra += sorted.reduce((s, t) => s + t.amount, 0);
      continue;
    }

    let paid = 0;
    for (const tx of sorted) {
      if (paid >= cuota) count += 1;
      paid += tx.amount;
    }
    if (paid > cuota) totalExtra += paid - cuota;
  }

  return { count, totalExtra };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/shared && pnpm vitest run debt-trend`
Expected: 11 tests PASS

- [ ] **Step 5: Run the full shared suite** (regression)

Run: `cd packages/shared && pnpm test`
Expected: all suites PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/utils/debt-trend.ts packages/shared/src/utils/__tests__/debt-trend.test.ts
git commit -m "feat(shared): detectExtraPayments — flag payments beyond the expected cuota"
```

---

### Task 3: `getDebtTrend()` server action

**Files:**
- Modify: `webapp/src/actions/debt.ts` (append at end; add imports at top)

- [ ] **Step 1: Add imports**

In the existing `@zeta/shared` import block of `webapp/src/actions/debt.ts`, add `computeDebtTrend`, `detectExtraPayments`, and `type DebtTrendStatus`:

```typescript
import {
  extractDebtAccounts,
  calcUtilization,
  estimateMonthlyInterest,
  generateInsights,
  sanitizeInterestRate,
  computeDebtTrend,
  detectExtraPayments,
  type DebtOverview,
  type DebtAccount,
  type DebtTrendStatus,
} from "@zeta/shared";
```

- [ ] **Step 2: Append the action**

```typescript
// ─── Debt trend (honest MoM cuota comparison) ────────────────────────────────

export interface DebtTrendData {
  deltaPct: number | null;
  status: DebtTrendStatus | null;
  currentCuota: number | null;
  previousCuota: number | null;
  /** Ascending by period (YYYY-MM), up to 6 entries. */
  sparkline: { period: string; total: number }[];
  extraPayments: { count: number; totalExtra: number };
}

const EMPTY_DEBT_TREND: DebtTrendData = {
  deltaPct: null,
  status: null,
  currentCuota: null,
  previousCuota: null,
  sparkline: [],
  extraPayments: { count: 0, totalExtra: 0 },
};

async function getDebtTrendCached(
  userId: string,
  currency: CurrencyCode,
  accessToken: string
): Promise<DebtTrendData> {
  "use cache";
  cacheTag("debt", "snapshots");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, monthly_payment, currency_code")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("account_type", ["CREDIT_CARD", "LOAN"]);

  if (accountsError) throw accountsError;

  const debtIds = (accounts ?? [])
    .filter((a) => a.currency_code === currency)
    .map((a) => a.id);
  if (debtIds.length === 0) return EMPTY_DEBT_TREND;

  const monthStart = `${toColombiaDateString(new Date()).slice(0, 7)}-01`;

  const [snapshotsResult, paymentsResult] = await Promise.all([
    supabase
      .from("statement_snapshots")
      .select("account_id, total_payment_due, minimum_payment, period_to")
      .eq("user_id", userId)
      .in("account_id", debtIds)
      .order("period_to", { ascending: false })
      .limit(debtIds.length * 8),
    supabase
      .from("transactions")
      .select("account_id, amount, transaction_date")
      .eq("user_id", userId)
      .eq("direction", "INFLOW")
      .in("account_id", debtIds)
      .gte("transaction_date", monthStart),
  ]);

  if (snapshotsResult.error) throw snapshotsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  const snapshots = snapshotsResult.data ?? [];

  // Latest snapshot cuota per (account, month) — first seen wins (ordered DESC).
  const cuotaByMonthAccount = new Map<string, Map<string, number>>();
  for (const snap of snapshots) {
    const month = snap.period_to.slice(0, 7);
    const cuota = snap.total_payment_due ?? snap.minimum_payment;
    if (cuota == null) continue;
    let perAccount = cuotaByMonthAccount.get(month);
    if (!perAccount) {
      perAccount = new Map();
      cuotaByMonthAccount.set(month, perAccount);
    }
    if (!perAccount.has(snap.account_id)) {
      perAccount.set(snap.account_id, Math.abs(cuota));
    }
  }

  const sparkline = [...cuotaByMonthAccount.entries()]
    .map(([period, perAccount]) => ({
      period,
      total: [...perAccount.values()].reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-6);

  const currentCuota = sparkline.at(-1)?.total ?? null;
  const previousCuota = sparkline.at(-2)?.total ?? null;
  const { deltaPct, status } = computeDebtTrend(currentCuota, previousCuota);

  // Expected cuota per account = latest snapshot cuota, fallback account.monthly_payment.
  const latestCuotaByAccount = new Map<string, number>();
  for (const snap of snapshots) {
    const cuota = snap.total_payment_due ?? snap.minimum_payment;
    if (cuota != null && !latestCuotaByAccount.has(snap.account_id)) {
      latestCuotaByAccount.set(snap.account_id, Math.abs(cuota));
    }
  }
  const expected = debtIds.map((id) => ({
    accountId: id,
    cuota:
      latestCuotaByAccount.get(id) ??
      Math.abs((accounts ?? []).find((a) => a.id === id)?.monthly_payment ?? 0),
  }));

  const extraPayments = detectExtraPayments(
    (paymentsResult.data ?? []).map((tx) => ({
      accountId: tx.account_id,
      amount: Math.abs(tx.amount),
      date: tx.transaction_date,
    })),
    expected
  );

  return { deltaPct, status, currentCuota, previousCuota, sparkline, extraPayments };
}

export async function getDebtTrend(
  currency?: CurrencyCode
): Promise<DebtTrendData> {
  const baseCurrency = currency ?? "COP";
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return EMPTY_DEBT_TREND;

  try {
    return await getDebtTrendCached(user.id, baseCurrency, accessToken);
  } catch (error) {
    console.error("Error computing debt trend:", error);
    return EMPTY_DEBT_TREND;
  }
}
```

- [ ] **Step 3: Verify invalidation coverage**

Run: `grep -rn "updateTag(\"snapshots\")\|updateTag(\"debt\")" webapp/src --include=*.ts | head`
Expected: transaction/import mutations call `updateTag` for `debt` and/or `snapshots` (via `revalidateFinancialViews()`). If `debt` is missing there, add it to `revalidateFinancialViews()` — check `grep -rn "revalidateFinancialViews" webapp/src/lib webapp/src/actions | head -3` for its definition.

- [ ] **Step 4: Typecheck via build**

Run: `cd webapp && pnpm build 2>&1 | tail -15`
Expected: build PASSES (action compiles; nothing consumes it yet)

- [ ] **Step 5: Commit**

```bash
git add webapp/src/actions/debt.ts
git commit -m "feat(deudas): getDebtTrend action — MoM cuota trend + extra-payment detection"
```

---

### Task 4: Canonical `DebtAccountRow`

**Files:**
- Create: `webapp/src/components/debt/debt-account-row.tsx`

- [ ] **Step 1: Create the component**

```tsx
// webapp/src/components/debt/debt-account-row.tsx
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

export interface DebtAccountRowData {
  id: string;
  name: string;
  type: "CREDIT_CARD" | "LOAN";
  balance: number;
  currency: CurrencyCode;
  creditLimit: number | null;
  interestRate: number | null;
  monthlyPayment: number | null;
  cutoffDay: number | null;
  /** Loans only — months remaining at current payment pace. */
  remainingMonths?: number | null;
  otherCurrencies?: { currency: string; balance: number }[];
}

/**
 * Canonical compact debt account card — the ONE representation of a debt
 * account. Consumed by the /deudas Cuentas lens; exported for accounts
 * surfaces to adopt (kills the divergent duplicate cards).
 */
export function DebtAccountRow({
  account,
  href,
}: {
  account: DebtAccountRowData;
  href?: string;
}) {
  const isCC = account.type === "CREDIT_CARD";
  const utilization =
    isCC && account.creditLimit && account.creditLimit > 0
      ? Math.min(100, (account.balance / account.creditLimit) * 100)
      : null;

  const metaParts: string[] = [];
  if (account.monthlyPayment && account.monthlyPayment > 0) {
    metaParts.push(
      isCC
        ? `cuota ${formatCurrency(account.monthlyPayment, account.currency)}`
        : `${formatCurrency(account.monthlyPayment, account.currency)}/mes`
    );
  }
  if (isCC && account.cutoffDay) metaParts.push(`corte día ${account.cutoffDay}`);
  if (!isCC && account.remainingMonths) metaParts.push(`faltan ${account.remainingMonths} meses`);
  if (account.interestRate && account.interestRate > 0) {
    metaParts.push(`${account.interestRate.toFixed(1)}% EA`);
  }

  const body = (
    <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-z-sage-light">
          {account.name}
        </p>
        <p
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            account.balance > 0 ? "text-z-debt" : "text-z-income"
          )}
        >
          {formatCurrency(account.balance, account.currency)}
        </p>
      </div>

      {utilization != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className={cn(
              "h-full rounded-full",
              utilization > 60 ? "bg-z-debt/80" : "bg-z-brass/80"
            )}
            style={{ width: `${utilization}%` }}
          />
        </div>
      )}

      {(metaParts.length > 0 || account.otherCurrencies?.length) && (
        <p className="mt-2 truncate text-[10px] text-muted-foreground">
          {metaParts.join(" · ")}
          {account.otherCurrencies?.map(
            (oc) => ` · ${formatCurrency(oc.balance, oc.currency as CurrencyCode)} ${oc.currency}`
          )}
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block active:opacity-80">
        {body}
      </Link>
    );
  }
  return body;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd webapp && npx tsc --noEmit 2>&1 | grep debt-account-row`
Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/debt/debt-account-row.tsx
git commit -m "feat(deudas): canonical DebtAccountRow card"
```

---

### Task 5: `DebtTrendCard` + remove "Manejable" chip from hero

**Files:**
- Create: `webapp/src/components/mobile/v2/deudas/debt-trend-card.tsx`
- Modify: `webapp/src/components/mobile/v2/deudas/deudas-hero.tsx`

- [ ] **Step 1: Create `DebtTrendCard`**

```tsx
// webapp/src/components/mobile/v2/deudas/debt-trend-card.tsx
"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { StateChip } from "@/components/mobile/v2/state-chip";
import type { DebtTrendData } from "@/actions/debt";
import type { CurrencyCode } from "@/types/domain";

const STATUS_META = {
  mejorando: { label: "Mejorando", variant: "sage" as const },
  estable: { label: "Estable", variant: "brass" as const },
  mes_pesado: { label: "Mes pesado", variant: "danger" as const },
};

export function DebtTrendCard({
  trend,
  currency,
}: {
  trend: DebtTrendData;
  currency: CurrencyCode;
}) {
  const meta = trend.status ? STATUS_META[trend.status] : null;
  const max = Math.max(...trend.sparkline.map((p) => p.total), 1);

  return (
    <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
            Tendencia
          </p>
          {trend.deltaPct != null ? (
            <p
              className={cn(
                "mt-1 text-[16px] font-semibold tabular-nums",
                trend.deltaPct > 10
                  ? "text-z-debt"
                  : trend.deltaPct <= -5
                    ? "text-z-income"
                    : "text-foreground"
              )}
            >
              {trend.deltaPct > 0 ? "▲" : trend.deltaPct < 0 ? "▼" : "·"}{" "}
              {Math.abs(trend.deltaPct).toFixed(0)}% vs mes pasado
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Sin historial suficiente
            </p>
          )}
        </div>
        {meta && <StateChip label={meta.label} variant={meta.variant} />}
      </div>

      {trend.extraPayments.count > 0 && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Hiciste {trend.extraPayments.count} pago
          {trend.extraPayments.count !== 1 ? "s" : ""} extra (
          {formatCurrency(trend.extraPayments.totalExtra, currency)}) este mes
        </p>
      )}

      {trend.sparkline.length >= 2 && (
        <div className="mt-3 flex h-8 items-end gap-1" aria-hidden>
          {trend.sparkline.map((p, i) => {
            const isLast = i === trend.sparkline.length - 1;
            return (
              <div
                key={p.period}
                className={cn(
                  "flex-1 rounded-t-sm",
                  isLast && trend.status === "mes_pesado"
                    ? "bg-z-debt/70"
                    : "bg-z-brass/35"
                )}
                style={{ height: `${Math.max(12, (p.total / max) * 100)}%` }}
                title={`${p.period}: ${formatCurrency(p.total, currency)}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Remove the pressure chip from `DeudasHero`**

In `webapp/src/components/mobile/v2/deudas/deudas-hero.tsx`:

1. Delete the import: `import { StateChip } from "@/components/mobile/v2/state-chip";`
2. Delete the pressure computation block (the comment `// Pressure: >30% interest = aprieta...` and the `pressure` + `pressureLabel` const declarations).
3. Replace the footer block:

```tsx
      {/* Footer */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {capitalPct}% capital · {interestPct}% costo financiero
        </span>
        <StateChip label={pressureLabel} variant={pressure} />
      </div>
```

with:

```tsx
      {/* Footer */}
      <div className="mt-2">
        <span className="text-[10px] text-muted-foreground">
          {capitalPct}% capital · {interestPct}% costo financiero
        </span>
      </div>
```

- [ ] **Step 3: Typecheck**

Run: `cd webapp && npx tsc --noEmit 2>&1 | grep -E "deudas-hero|debt-trend-card"`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/v2/deudas/debt-trend-card.tsx webapp/src/components/mobile/v2/deudas/deudas-hero.tsx
git commit -m "feat(deudas): honest DebtTrendCard replaces static Manejable badge"
```

---

### Task 6: Lens shell + Carga lens (`DeudasLensRoot`)

**Files:**
- Create: `webapp/src/components/mobile/v2/deudas/deudas-lens-root.tsx`

Plan/Cuentas lens components arrive in Tasks 7–8; this task references them, so create them as stubs here and fill them next (keeps the tree compiling).

- [ ] **Step 1: Create stub lens files**

```tsx
// webapp/src/components/mobile/v2/deudas/deudas-plan-lens.tsx (stub — Task 7 fills it)
export function DeudasPlanLens(_props: Record<string, never>) {
  return null;
}
```

```tsx
// webapp/src/components/mobile/v2/deudas/deudas-cuentas-lens.tsx (stub — Task 8 fills it)
export function DeudasCuentasLens(_props: Record<string, never>) {
  return null;
}
```

(The real prop interfaces land in Tasks 7–8; `DeudasLensRoot` below already passes the final props, so replace the stub signatures wholesale in those tasks.)

- [ ] **Step 2: Create `DeudasLensRoot`**

```tsx
// webapp/src/components/mobile/v2/deudas/deudas-lens-root.tsx
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { DeudasHero } from "./deudas-hero";
import { DebtTrendCard } from "./debt-trend-card";
import { DeudasSalaryBar } from "./deudas-salary-bar";
import { DeudasPlanLens } from "./deudas-plan-lens";
import { DeudasCuentasLens } from "./deudas-cuentas-lens";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import type { CurrencyCode } from "@/types/domain";
import type { DebtStats, DebtOverview, MonthlyBreakdown } from "@zeta/shared";
import type { DebtTrendData } from "@/actions/debt";
import type { DebtCountdownData } from "@/actions/debt-countdown";

const LENSES = [
  { id: "carga", label: "Carga" },
  { id: "plan", label: "Plan" },
  { id: "cuentas", label: "Cuentas" },
] as const;

export type DeudasLens = (typeof LENSES)[number]["id"];

const STORAGE_KEY = "zeta:deudas-lens";

export interface PersonasSummary {
  activeCount: number;
  iOweTotal: number;
  owedToMeTotal: number;
}

export interface ExchangeRateInfo {
  rate: number;
  avg30d: number;
  percentVsAvg: number;
  from: CurrencyCode;
}

interface DeudasLensRootProps {
  stats: DebtStats;
  overview: DebtOverview;
  salaryBreakdown: MonthlyBreakdown | null;
  trend: DebtTrendData | null;
  countdown: DebtCountdownData | null;
  personasSummary: PersonasSummary | null;
  exchangeRate: ExchangeRateInfo | null;
  currency: CurrencyCode;
  extraPaymentTrigger?: React.ReactNode;
}

export function DeudasLensRoot({
  stats,
  overview,
  salaryBreakdown,
  trend,
  countdown,
  personasSummary,
  exchangeRate,
  currency,
  extraPaymentTrigger,
}: DeudasLensRootProps) {
  // SSR-safe: render "carga" first, then adopt the persisted lens after mount.
  const [lens, setLens] = useState<DeudasLens>("carga");
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "plan" || saved === "cuentas") setLens(saved);
  }, []);

  const selectLens = (next: DeudasLens) => {
    setLens(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const { activeZone, toggle } = useExpandableZone<string>();

  return (
    <div className="space-y-3">
      {/* Segmented control */}
      <div
        role="tablist"
        aria-label="Vista de deudas"
        className="flex gap-1 rounded-full border border-white/6 bg-white/[0.03] p-1"
      >
        {LENSES.map((l) => (
          <button
            key={l.id}
            role="tab"
            aria-selected={lens === l.id}
            onClick={() => selectLens(l.id)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              lens === l.id
                ? "border border-z-brass/30 bg-z-brass/15 text-z-brass"
                : "text-muted-foreground active:bg-white/[0.06]"
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* ── Carga (default): cuánto se quema + tendencia honesta + salario ── */}
      {lens === "carga" && (
        <>
          <DeudasHero
            totalMonthlyPayment={stats.totalMonthlyPayment}
            monthlyInterest={overview.monthlyInterestEstimate}
            currency={currency}
            accounts={overview.accounts.map((a) => ({
              id: a.id,
              name: a.name,
              type: a.type as "CREDIT_CARD" | "LOAN",
              monthlyPayment: a.monthlyPayment ?? 0,
              interestRate: a.interestRate ?? 0,
              balance: a.balance,
              currency: a.currency,
            }))}
            expanded={activeZone === "hero"}
            onToggle={() => toggle("hero")}
          />
          {trend && <DebtTrendCard trend={trend} currency={currency} />}
          {salaryBreakdown && (
            <DeudasSalaryBar breakdown={salaryBreakdown} currency={currency} />
          )}
        </>
      )}

      {/* ── Plan: horizonte + hito + acciones + insights ── */}
      {lens === "plan" && (
        <DeudasPlanLens
          countdown={countdown}
          stats={stats}
          insights={overview.insights}
          currency={currency}
          extraPaymentTrigger={extraPaymentTrigger}
        />
      )}

      {/* ── Cuentas: inventario canónico ── */}
      {lens === "cuentas" && (
        <DeudasCuentasLens
          overview={overview}
          stats={stats}
          personasSummary={personasSummary}
          exchangeRate={exchangeRate}
          currency={currency}
        />
      )}
    </div>
  );
}
```

Note: with the stub props (`Record<string, never>`) this won't typecheck until Tasks 7–8 replace the stubs. That's expected — Tasks 6–8 form one compiling unit; the build gate runs in Task 8. If executing tasks strictly in order, temporarily type the stubs as `(_props: any)` to keep `tsc` quiet, then replace in Tasks 7–8.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/v2/deudas/deudas-lens-root.tsx webapp/src/components/mobile/v2/deudas/deudas-plan-lens.tsx webapp/src/components/mobile/v2/deudas/deudas-cuentas-lens.tsx
git commit -m "feat(deudas): lens shell with Carga lens (segmented control + localStorage)"
```

---

### Task 7: Plan lens

**Files:**
- Modify (replace stub): `webapp/src/components/mobile/v2/deudas/deudas-plan-lens.tsx`

- [ ] **Step 1: Implement the lens**

```tsx
// webapp/src/components/mobile/v2/deudas/deudas-plan-lens.tsx
"use client";

import Link from "next/link";
import { Banknote, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { formatMonthLabel, parseMonth } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";
import type { DebtStats, DebtInsight } from "@zeta/shared";
import type { DebtCountdownData } from "@/actions/debt-countdown";

const INSIGHT_COLOR: Record<DebtInsight["type"], string> = {
  warning: "border-z-alert/25 text-z-alert",
  info: "border-z-brass/25 text-z-brass",
  success: "border-z-income/25 text-z-income",
};

interface DeudasPlanLensProps {
  countdown: DebtCountdownData | null;
  stats: DebtStats;
  insights: DebtInsight[];
  currency: CurrencyCode;
  extraPaymentTrigger?: React.ReactNode;
}

export function DeudasPlanLens({
  countdown,
  stats,
  insights,
  currency,
  extraPaymentTrigger,
}: DeudasPlanLensProps) {
  const closestLoan = stats.loans.remainingMonths;
  const closestProgress = closestLoan
    ? stats.loans.progressList.find((p) => p.accountName === closestLoan.accountName)
    : null;
  const closestPayment = closestLoan
    ? stats.loans.payments.find((p) => p.accountName === closestLoan.accountName)
    : null;

  const chipClass =
    "inline-flex items-center gap-2 rounded-full border border-white/6 bg-white/[0.03] px-3 py-1.5 text-xs transition-colors";

  return (
    <div className="space-y-3">
      {/* Horizon hero */}
      <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
          Libre de deudas
        </p>
        {countdown ? (
          <>
            <p className="mt-2 text-[28px] font-[680] capitalize leading-none tracking-[-0.04em] text-z-brass">
              {formatMonthLabel(parseMonth(countdown.projectedDate))}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {countdown.monthsToFree} meses al ritmo actual
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-z-brass/80"
                style={{ width: `${countdown.progressPercent}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {countdown.progressPercent.toFixed(0)}% del camino recorrido
            </p>
            {countdown.extraPaymentScenario && (
              <p className="mt-2 text-[10px] text-z-income">
                Con {formatCurrency(countdown.extraPaymentScenario.extraAmount, currency)} extra/mes
                terminarías {countdown.extraPaymentScenario.monthsSaved} meses antes
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Completa cuotas mínimas en tus cuentas para proyectar tu fecha.
          </p>
        )}
      </div>

      {/* Próximo hito */}
      {closestLoan && (
        <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
            Próximo hito
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-z-sage-light">
                {closestLoan.accountName}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {closestProgress ? `${closestProgress.percentage.toFixed(0)}% pagado` : ""}
                {closestPayment
                  ? ` · ${formatCurrency(closestPayment.amount, currency)}/mes`
                  : ""}
              </p>
            </div>
            <MilestoneRing months={closestLoan.months} />
          </div>
        </div>
      )}

      {/* Action row — Plata extra + Simular live here */}
      <div className="flex flex-wrap gap-2 px-1">
        {extraPaymentTrigger && (
          <div className={chipClass}>
            <Banknote className="size-3.5 text-z-brass" />
            {extraPaymentTrigger}
          </div>
        )}
        <Link href="/deudas/planificador" className={`${chipClass} active:bg-white/[0.06]`}>
          <Calculator className="size-3.5 text-z-brass" />
          <span>Simular pagos</span>
        </Link>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={cn(
                PANEL_INSET_CLASS,
                "border p-3",
                INSIGHT_COLOR[insight.type]
              )}
            >
              <p className="text-xs font-semibold">{insight.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {insight.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MilestoneRing({ months }: { months: number }) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  // Visual cue only: fewer months remaining = fuller ring (capped at 36 months).
  const fillPct = Math.max(0, Math.min(1, 1 - months / 36));
  return (
    <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          className="stroke-z-income"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fillPct)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-z-income">
        {months}m
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd webapp && npx tsc --noEmit 2>&1 | grep deudas-plan-lens`
Expected: no output. (If `AccountPaymentEntry`/`AccountProgressEntry` field names differ, check `packages/shared/src/utils/debt-stats.ts` — entries use `accountName`, `amount`, `percentage`.)

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/v2/deudas/deudas-plan-lens.tsx
git commit -m "feat(deudas): Plan lens — horizon, próximo hito, actions, insights"
```

---

### Task 8: Cuentas lens + `AccountsSection hideDebt`

**Files:**
- Modify (replace stub): `webapp/src/components/mobile/v2/deudas/deudas-cuentas-lens.tsx`
- Modify: `webapp/src/components/accounts/accounts-section.tsx`

- [ ] **Step 1: Implement the lens**

```tsx
// webapp/src/components/mobile/v2/deudas/deudas-cuentas-lens.tsx
"use client";

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { DebtAccountRow } from "@/components/debt/debt-account-row";
import { ExchangeRateNudge } from "@/components/debt/exchange-rate-nudge";
import type { CurrencyCode } from "@/types/domain";
import type { DebtOverview, DebtStats } from "@zeta/shared";
import type { PersonasSummary, ExchangeRateInfo } from "./deudas-lens-root";

interface DeudasCuentasLensProps {
  overview: DebtOverview;
  stats: DebtStats;
  personasSummary: PersonasSummary | null;
  exchangeRate: ExchangeRateInfo | null;
  currency: CurrencyCode;
}

export function DeudasCuentasLens({
  overview,
  stats,
  personasSummary,
  exchangeRate,
  currency,
}: DeudasCuentasLensProps) {
  const remainingByName = new Map(
    stats.loans.remainingList.map((e) => [e.accountName, e.months])
  );

  const secondaryCurrencies = overview.debtByCurrency.filter(
    (d) => d.currency !== currency && d.totalDebt > 0
  );

  return (
    <div className="space-y-3">
      {/* Header tiles: cupo ring + total debt */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(PANEL_INSET_CLASS, "flex flex-col items-center p-3.5")}>
          <UtilizationRing percentage={overview.overallUtilization} />
          <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
            Uso del cupo
          </p>
        </div>
        <div className={cn(PANEL_INSET_CLASS, "flex flex-col items-center justify-center p-3.5")}>
          <p className="text-[18px] font-[680] tabular-nums tracking-[-0.03em]">
            {formatCurrency(overview.totalDebt, currency)}
          </p>
          <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
            Deuda total
          </p>
        </div>
      </div>

      {/* Canonical account list */}
      <div className="space-y-2">
        {overview.accounts.map((a) => (
          <DebtAccountRow
            key={a.id}
            href={`/accounts?focus=${a.id}`}
            account={{
              id: a.id,
              name: a.name,
              type: a.type as "CREDIT_CARD" | "LOAN",
              balance: a.balance,
              currency: a.currency,
              creditLimit: a.creditLimit ?? null,
              interestRate: a.interestRate ?? null,
              monthlyPayment: a.monthlyPayment ?? null,
              cutoffDay: a.cutoffDay ?? null,
              remainingMonths: remainingByName.get(a.name) ?? null,
              otherCurrencies: a.currencyBreakdown
                ?.filter((cb) => cb.currency !== a.currency && cb.balance > 0)
                .map((cb) => ({ currency: cb.currency, balance: cb.balance })),
            }}
          />
        ))}
      </div>

      {/* Personas chip */}
      {personasSummary && personasSummary.activeCount > 0 && (
        <Link
          href="/deudas-personales"
          className={cn(
            PANEL_INSET_CLASS,
            "flex items-center justify-between p-3 active:opacity-80"
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="size-4 text-z-brass" />
            <span className="text-xs">
              {personasSummary.activeCount} deuda
              {personasSummary.activeCount !== 1 ? "s" : ""} con personas
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {personasSummary.owedToMeTotal > 0 &&
              `te deben ${formatCurrency(personasSummary.owedToMeTotal, currency)}`}
            {personasSummary.owedToMeTotal > 0 && personasSummary.iOweTotal > 0 && " · "}
            {personasSummary.iOweTotal > 0 &&
              `debes ${formatCurrency(personasSummary.iOweTotal, currency)}`}
            <ArrowRight className="size-3" />
          </span>
        </Link>
      )}

      {/* Multi-currency context */}
      {exchangeRate && secondaryCurrencies.length > 0 && (
        <ExchangeRateNudge
          rate={exchangeRate.rate}
          avg30d={exchangeRate.avg30d}
          percentVsAvg={exchangeRate.percentVsAvg}
          from={exchangeRate.from}
          to={currency}
        />
      )}
    </div>
  );
}

function UtilizationRing({ percentage }: { percentage: number }) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, percentage) / 100);
  const hot = percentage > 60;
  return (
    <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          className={hot ? "stroke-z-debt" : "stroke-z-brass"}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center text-[10px] font-bold",
          hot ? "text-z-debt" : "text-z-brass"
        )}
      >
        {percentage.toFixed(0)}%
      </div>
    </div>
  );
}
```

Verify the `href`: run `grep -n "focus" webapp/src/app/\(dashboard\)/accounts/page.tsx | head -3`. If `/accounts` has no `focus` param handling, use `href="/accounts"` instead.

- [ ] **Step 2: Add `hideDebt` to `AccountsSection`**

In `webapp/src/components/accounts/accounts-section.tsx`:

```tsx
export function AccountsSection({ hideDebt = false }: { hideDebt?: boolean }) {
```

and change the debt block's condition from `{debtAccounts.length > 0 && (` to:

```tsx
      {!hideDebt && debtAccounts.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-z-sage-dark">Deuda</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {debtAccounts.map((account) => (
              <AccountCard key={account.id} account={account} allAccounts={allMinimal} />
            ))}
          </div>
        </div>
      )}
```

(Only the condition changes — the inner JSX is the file's existing content, shown for context.)

- [ ] **Step 3: Typecheck**

Run: `cd webapp && npx tsc --noEmit 2>&1 | grep -E "cuentas-lens|accounts-section"`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/v2/deudas/deudas-cuentas-lens.tsx webapp/src/components/accounts/accounts-section.tsx
git commit -m "feat(deudas): Cuentas lens — canonical inventory + personas chip; AccountsSection hideDebt"
```

---

### Task 9: Page wiring + retire old components

**Files:**
- Modify: `webapp/src/app/(dashboard)/deudas/page.tsx`
- Delete: `deudas-root.tsx`, `deudas-grid.tsx`, `deudas-accounts-accordion.tsx` (all under `webapp/src/components/mobile/v2/deudas/`)

- [ ] **Step 1: Rewrite `MobileDebtSection`** in `page.tsx`

Replace the `MobileDebtSection` function with:

```tsx
async function MobileDebtSection({
  currency,
  month,
}: {
  currency: CurrencyCode;
  month: string | undefined;
}) {
  const isCurrentMonth =
    !month || month >= new Date().toISOString().slice(0, 7);

  const [
    overview,
    incomeEstimate,
    sourceAccountsResult,
    usdRateResult,
    trend,
    countdown,
    personasResult,
  ] = await Promise.all([
    getDebtOverview(currency, month),
    getEstimatedIncome(currency, month),
    getNonDebtAccounts(),
    currency !== "USD" ? getExchangeRate("USD", currency) : Promise.resolve(null),
    isCurrentMonth ? getDebtTrend(currency) : Promise.resolve(null),
    getDebtFreeCountdown(currency),
    getPersonalDebtsOverview(),
  ]);
  const sourceAccounts = sourceAccountsResult.success ? sourceAccountsResult.data : [];
  const usdToCopRate = usdRateResult?.rate ?? null;

  if (overview.accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-2">
          No tienes cuentas de deuda registradas.
        </p>
        <Link href="/accounts" className="text-primary hover:underline text-sm">
          Agregar tarjeta de crédito o préstamo
        </Link>
      </div>
    );
  }

  const salaryBreakdown =
    incomeEstimate && incomeEstimate.monthlyAverage > 0
      ? getCurrentSalaryBreakdown({
          monthlyIncome: incomeEstimate.monthlyAverage,
          debtPayments: overview.accounts
            .filter((a) => a.balance > 0)
            .map((a) => ({
              accountId: a.id,
              name: a.name,
              amount: getMinPayment(a),
            })),
        })
      : null;

  const stats = computeDebtStats(overview.accounts);

  const personasSummary = personasResult.success
    ? {
        activeCount:
          personasResult.data.iOwe.byPerson.length +
          personasResult.data.owedToMe.byPerson.length,
        iOweTotal: personasResult.data.iOwe.total,
        owedToMeTotal: personasResult.data.owedToMe.total,
      }
    : null;

  const secondaryCurrencies = overview.debtByCurrency.filter(
    (d) => d.currency !== currency && d.totalDebt > 0
  );
  const exchangeRate =
    usdRateResult && secondaryCurrencies.length > 0
      ? {
          rate: usdRateResult.rate,
          avg30d: usdRateResult.avg30d,
          percentVsAvg: usdRateResult.percentVsAvg,
          from: secondaryCurrencies[0].currency as CurrencyCode,
        }
      : null;

  return (
    <DeudasLensRoot
      stats={stats}
      overview={overview}
      salaryBreakdown={salaryBreakdown}
      trend={trend}
      countdown={countdown}
      personasSummary={personasSummary}
      exchangeRate={exchangeRate}
      currency={currency}
      extraPaymentTrigger={
        <ExtraPaymentTrigger
          debtAccounts={overview.accounts}
          sourceAccounts={sourceAccounts}
          currency={currency}
          usdToCopRate={usdToCopRate}
          variant="compact"
        />
      }
    />
  );
}
```

- [ ] **Step 2: Update page imports**

In `page.tsx`:
- Remove: `import { DeudasRoot } from "@/components/mobile/v2/deudas/deudas-root";`
- Add:

```tsx
import { DeudasLensRoot } from "@/components/mobile/v2/deudas/deudas-lens-root";
import { getDebtTrend } from "@/actions/debt";
import { getDebtFreeCountdown } from "@/actions/debt-countdown";
import { getPersonalDebtsOverview } from "@/actions/personal-debts";
```

- In the mobile branch only, change `<AccountsSection />` to `<AccountsSection hideDebt />` (desktop branch keeps `<AccountsSection />`).
- The `UtilizationRingMobile` function at the bottom of `page.tsx` becomes unused — delete it (verify first: `grep -rn "UtilizationRingMobile" webapp/src`).

- [ ] **Step 3: Delete retired components**

```bash
grep -rln "DeudasRoot\b|deudas-root|DeudasGrid|deudas-grid|DeudasAccountsAccordion|deudas-accounts-accordion" webapp/src -E
```
Expected: no remaining imports outside the deleted files themselves. Then:

```bash
git rm webapp/src/components/mobile/v2/deudas/deudas-root.tsx webapp/src/components/mobile/v2/deudas/deudas-grid.tsx webapp/src/components/mobile/v2/deudas/deudas-accounts-accordion.tsx
```

- [ ] **Step 4: Build**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm install && cd webapp && pnpm build 2>&1 | tail -15`
Expected: build PASSES. (Check first that no dev server is running on :3000 — building clobbers a live dev server's `.next`.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(deudas): wire 3-lens mobile root; retire grid/accordion/old root"
```

---

### Task 10: Verification gates + review agents

- [ ] **Step 1: Full shared test suite**

Run: `cd packages/shared && pnpm test`
Expected: all PASS

- [ ] **Step 2: Manual smoke test**

Start `cd webapp && pnpm dev`, open `http://localhost:3000/deudas` in mobile viewport:
- Segmented control shows Carga/Plan/Cuentas; default Carga
- Hero has NO "Manejable" chip; trend card below shows chip or "Sin historial suficiente"
- Switch to Plan: horizon + hito + Plata extra/Simular chips + insights
- Switch to Cuentas: ring + total tiles, account rows, personas chip (if active personal debts), NO duplicated "Deuda" section under Mis cuentas
- Reload page → lens choice persisted
- Desktop viewport: unchanged (DebtQuickStats still present)

- [ ] **Step 3: Review agents** (per CLAUDE.md gates — run as parallel subagents)

- `server-action-reviewer` → `getDebtTrend` in `webapp/src/actions/debt.ts`
- `zetas-front-guy` → all new/modified TSX in `webapp/src/components/mobile/v2/deudas/` + `debt-account-row.tsx`
- `perf-auditor` → `/deudas` mobile (new queries added to `Promise.all`; verify caching + no uncached render-path reads)

- [ ] **Step 4: Fix findings, re-run build, final commit**

```bash
cd webapp && pnpm build 2>&1 | tail -5
git add -A && git commit -m "fix(deudas): review agent findings"
```

- [ ] **Step 5: Dry-merge against main before PR**

```bash
git fetch origin main && git merge --no-commit --no-ff origin/main; git merge --abort
```
Expected: no conflicts. Then create PR per repo workflow.
