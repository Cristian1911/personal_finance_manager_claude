# Multi-Currency Validation + Exchange Rate Nudge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix currency mixing bugs in budget/accounts/recurring, add exchange rate caching with frankfurter.app, and show a USD debt payment nudge when the dollar is cheap.

**Architecture:** Three independent fixes (currency filters on existing queries) + one new subsystem (exchange rate cache + nudge component). The fixes are mechanical `.eq()` additions. The exchange rate system is a new server action + migration + component.

**Tech Stack:** Supabase (migration + queries), frankfurter.app (free exchange rate API), Next.js server actions, React server components.

---

## Task 1: Fix budget/categories currency filtering

**Files:**
- Modify: `webapp/src/actions/categories.ts` — add currency param to `getCategoriesWithBudgetData`
- Modify: `webapp/src/app/(dashboard)/categories/page.tsx` — pass currency through

- [ ] **Step 1: Add currency parameter to getCategoriesWithBudgetData**

In `webapp/src/actions/categories.ts`, import `getPreferredCurrency` and add currency filtering:

```typescript
// At top of file, add import:
import { getPreferredCurrency } from "@/actions/profile";

// Change function signature (line ~380):
export async function getCategoriesWithBudgetData(
  month?: string
): Promise<ActionResult<CategoryBudgetData[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const target = parseMonth(month);
  const currency = await getPreferredCurrency();
```

Then add `.eq("currency_code", currency)` to the two transaction queries inside the `Promise.all`:

```typescript
    // 3. This month's spending — ADD CURRENCY FILTER
    executeVisibleTransactionQuery(() =>
      supabase
        .from("transactions")
        .select("amount, category_id")
        .eq("direction", "OUTFLOW")
        .eq("is_excluded", false)
        .eq("currency_code", currency)  // ← ADD THIS
        .gte("transaction_date", monthStartStr(target))
        .lte("transaction_date", monthEndStr(target))
    ),

    // 4. Last 3 months spending for averages — ADD CURRENCY FILTER
    executeVisibleTransactionQuery(() =>
      supabase
        .from("transactions")
        .select("amount, category_id, transaction_date")
        .eq("direction", "OUTFLOW")
        .eq("is_excluded", false)
        .eq("currency_code", currency)  // ← ADD THIS
        .gte("transaction_date", monthsBeforeStart(target, 3))
        .lt("transaction_date", monthStartStr(target))
    ),

    // 5. Active recurring templates — ADD CURRENCY FILTER
    supabase
      .from("recurring_transaction_templates")
      .select("category_id, amount")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .eq("direction", "OUTFLOW")
      .eq("currency_code", currency),  // ← ADD THIS
```

- [ ] **Step 2: Build and verify**

```bash
cd webapp && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/categories.ts
git commit -m "fix: filter budget/category queries by preferred currency"
```

---

## Task 2: Fix accounts net worth currency mixing

**Files:**
- Modify: `webapp/src/app/(dashboard)/accounts/page.tsx`

- [ ] **Step 1: Filter net worth by preferred currency, show secondary currencies**

```typescript
import { getAccounts } from "@/actions/accounts";
import { getPreferredCurrency } from "@/actions/profile";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

export default async function AccountsPage() {
  const [result, currency] = await Promise.all([
    getAccounts(),
    getPreferredCurrency(),
  ]);
  const accounts = result.success ? result.data : [];

  // Net worth in preferred currency only
  const primaryAccounts = accounts.filter((a) => a.currency_code === currency);
  const totalBalance = primaryAccounts.reduce((sum, acc) => {
    if (acc.account_type === "CREDIT_CARD" || acc.account_type === "LOAN") {
      return sum - acc.current_balance;
    }
    return sum + acc.current_balance;
  }, 0);

  // Detect secondary currencies
  const secondaryCurrencies = new Map<string, number>();
  for (const acc of accounts) {
    if (acc.currency_code !== currency) {
      const prev = secondaryCurrencies.get(acc.currency_code) ?? 0;
      const val = (acc.account_type === "CREDIT_CARD" || acc.account_type === "LOAN")
        ? -acc.current_balance
        : acc.current_balance;
      secondaryCurrencies.set(acc.currency_code, prev + val);
    }
  }
```

Update the display to show secondary currencies:

```tsx
<p className="text-muted-foreground">
  Patrimonio neto: {formatCurrency(totalBalance, currency)}
  {secondaryCurrencies.size > 0 && (
    <span className="ml-2 text-xs">
      {Array.from(secondaryCurrencies.entries())
        .map(([cur, bal]) => `${formatCurrency(bal, cur as CurrencyCode)} ${cur}`)
        .join(" · ")}
    </span>
  )}
</p>
```

- [ ] **Step 2: Build and verify**

```bash
cd webapp && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add "webapp/src/app/(dashboard)/accounts/page.tsx"
git commit -m "fix: filter net worth by preferred currency, show secondary"
```

---

## Task 3: Exchange rate cache migration + server action

**Files:**
- Create: Supabase migration for `exchange_rate_cache` table
- Create: `webapp/src/actions/exchange-rate.ts`

- [ ] **Step 1: Create migration**

Use Supabase MCP tool:

```sql
CREATE TABLE exchange_rate_cache (
  pair text PRIMARY KEY,
  rate numeric NOT NULL,
  rates_30d jsonb NOT NULL DEFAULT '[]',
  avg_30d numeric,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exchange_rate_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_can_read_rates" ON exchange_rate_cache
  FOR SELECT USING (true);
CREATE POLICY "authenticated_can_upsert_rates" ON exchange_rate_cache
  FOR ALL USING (auth.role() = 'authenticated');
```

- [ ] **Step 2: Regenerate types**

```bash
cd webapp && npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts
```

- [ ] **Step 3: Create exchange rate server action**

Create `webapp/src/actions/exchange-rate.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import type { CurrencyCode } from "@/types/domain";

export interface ExchangeRateResult {
  rate: number;
  avg30d: number | null;
  percentVsAvg: number | null;
  fetchedAt: string;
  pair: string;
}

const FRANKFURTER_BASE = "https://api.frankfurter.app";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get the exchange rate for a currency pair (e.g., USD → COP).
 * Checks cache first; fetches from frankfurter.app if stale (>24h).
 */
export async function getExchangeRate(
  from: CurrencyCode,
  to: CurrencyCode
): Promise<ExchangeRateResult | null> {
  if (from === to) return null;

  const pair = `${from}_${to}`;
  const supabase = await createClient();

  // Check cache
  const { data: cached } = await supabase
    .from("exchange_rate_cache")
    .select("*")
    .eq("pair", pair)
    .single();

  const now = Date.now();
  const cacheAge = cached?.fetched_at
    ? now - new Date(cached.fetched_at).getTime()
    : Infinity;

  if (cached && cacheAge < CACHE_TTL_MS) {
    return {
      rate: Number(cached.rate),
      avg30d: cached.avg_30d ? Number(cached.avg_30d) : null,
      percentVsAvg: cached.avg_30d
        ? ((Number(cached.rate) - Number(cached.avg_30d)) / Number(cached.avg_30d)) * 100
        : null,
      fetchedAt: cached.fetched_at,
      pair,
    };
  }

  // Fetch fresh rate
  try {
    const [latestRes, historyRes] = await Promise.all([
      fetch(`${FRANKFURTER_BASE}/latest?from=${from}&to=${to}`),
      fetch(`${FRANKFURTER_BASE}/${getDateDaysAgo(30)}..?from=${from}&to=${to}`),
    ]);

    if (!latestRes.ok || !historyRes.ok) return cached ? formatCached(cached, pair) : null;

    const latest = await latestRes.json();
    const history = await historyRes.json();

    const rate = latest.rates?.[to];
    if (!rate) return cached ? formatCached(cached, pair) : null;

    // Build 30-day rates array
    const rates30d: { date: string; rate: number }[] = [];
    for (const [date, rates] of Object.entries(history.rates ?? {})) {
      const r = (rates as Record<string, number>)?.[to];
      if (r) rates30d.push({ date, rate: r });
    }

    const avg30d = rates30d.length > 0
      ? rates30d.reduce((s, r) => s + r.rate, 0) / rates30d.length
      : null;

    // Upsert cache
    await supabase.from("exchange_rate_cache").upsert({
      pair,
      rate,
      rates_30d: rates30d,
      avg_30d: avg30d,
      fetched_at: new Date().toISOString(),
    });

    return {
      rate,
      avg30d,
      percentVsAvg: avg30d ? ((rate - avg30d) / avg30d) * 100 : null,
      fetchedAt: new Date().toISOString(),
      pair,
    };
  } catch {
    // Network error — return stale cache if available
    return cached ? formatCached(cached, pair) : null;
  }
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatCached(cached: any, pair: string): ExchangeRateResult {
  return {
    rate: Number(cached.rate),
    avg30d: cached.avg_30d ? Number(cached.avg_30d) : null,
    percentVsAvg: cached.avg_30d
      ? ((Number(cached.rate) - Number(cached.avg_30d)) / Number(cached.avg_30d)) * 100
      : null,
    fetchedAt: cached.fetched_at,
    pair,
  };
}
```

- [ ] **Step 4: Build and verify**

```bash
cd webapp && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add webapp/src/actions/exchange-rate.ts webapp/src/types/database.ts
git commit -m "feat: add exchange rate cache with frankfurter.app"
```

---

## Task 4: Exchange rate nudge component on deudas page

**Files:**
- Create: `webapp/src/components/debt/exchange-rate-nudge.tsx`
- Modify: `webapp/src/app/(dashboard)/deudas/page.tsx`

- [ ] **Step 1: Create nudge component**

Create `webapp/src/components/debt/exchange-rate-nudge.tsx`:

```typescript
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, DollarSign, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface Props {
  rate: number;
  avg30d: number | null;
  percentVsAvg: number | null;
  from: CurrencyCode;
  to: CurrencyCode;
}

export function ExchangeRateNudge({ rate, avg30d, percentVsAvg, from, to }: Props) {
  const formattedRate = formatCurrency(rate, to);
  const isCheap = percentVsAvg !== null && percentVsAvg < -2;
  const isNeutral = percentVsAvg === null || Math.abs(percentVsAvg) <= 2;

  // Only show nudge if rate is below average (good time to pay) or neutral
  // Don't show when expensive (>2% above average) — don't stress the user
  if (percentVsAvg !== null && percentVsAvg > 2) {
    return null;
  }

  if (isCheap) {
    return (
      <Card style={{
        borderColor: "color-mix(in srgb, var(--z-income) 30%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--z-income) 10%, transparent)",
      }}>
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <TrendingDown className="h-5 w-5 text-z-income shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-z-income">
                1 {from} = {formattedRate} — {Math.abs(percentVsAvg!).toFixed(1)}% más barato que tu promedio
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Buen momento para pagar tus deudas en {from}. Promedio 30 días: {formatCurrency(avg30d!, to)}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Neutral — just show the rate
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <DollarSign className="h-3.5 w-3.5" />
      <span>{from} hoy: {formattedRate}</span>
    </div>
  );
}
```

- [ ] **Step 2: Wire nudge into deudas page**

In `webapp/src/app/(dashboard)/deudas/page.tsx`, add the exchange rate fetch and nudge component.

Add imports:
```typescript
import { getExchangeRate } from "@/actions/exchange-rate";
import { ExchangeRateNudge } from "@/components/debt/exchange-rate-nudge";
```

In the data fetching section (inside the function, after `overview` and `incomeEstimate` are available), detect secondary currencies and fetch rate:

```typescript
  // Check for secondary currency debts (e.g., USD on a COP user)
  const secondaryCurrencies = overview.debtByCurrency
    .filter((d) => d.currency !== currency && d.totalDebt > 0)
    .map((d) => d.currency);

  // Fetch exchange rate for first secondary currency (if any)
  const exchangeRate = secondaryCurrencies.length > 0
    ? await getExchangeRate(secondaryCurrencies[0] as CurrencyCode, currency)
    : null;
```

Add the nudge component after the overview cards section:

```tsx
      {/* Exchange rate nudge */}
      {exchangeRate && secondaryCurrencies.length > 0 && (
        <ExchangeRateNudge
          rate={exchangeRate.rate}
          avg30d={exchangeRate.avg30d}
          percentVsAvg={exchangeRate.percentVsAvg}
          from={secondaryCurrencies[0] as CurrencyCode}
          to={currency}
        />
      )}
```

- [ ] **Step 3: Build and verify**

```bash
cd webapp && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/debt/exchange-rate-nudge.tsx "webapp/src/app/(dashboard)/deudas/page.tsx"
git commit -m "feat: add exchange rate nudge for USD debt on deudas page"
```

---

## Final Verification

- [ ] **Run full build**

```bash
cd webapp && pnpm build
```

All 4 tasks should build cleanly. The exchange rate nudge will only show for users who have debt in a currency different from their preferred currency.
