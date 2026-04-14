# Income-Aware Runway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace calendar-month daily budget with pay-cycle budgeting — window is always "now → next income", obligations scoped to that window, runway chart shows single segment to next income.

**Architecture:** Add `getNextIncomeOccurrenceCached()` (exported) to `occurrences.ts` that queries the nearest future INFLOW occurrence. `getDashboardHeroData()` calls it in parallel with existing fetches, scopes obligations to the pay-cycle window. `getBurnRateCached()` calls the cached inner directly (no public wrapper — avoids `cookies()` inside `"use cache"`). Both callers use `PAY_CYCLE_LOOKAHEAD_DAYS = 45` for `getPendingOccurrences` to share cache entries, then filter in JS. UI components update labels and add nudge/income indicators.

**Tech Stack:** Next.js 15 server actions, Supabase via `createCachedClient`, recharts for charts, existing `recurring_occurrences` table.

**Review fixes incorporated:** FK hints on joins, `ensureOccurrencesForRange` before queries, `Promise.all` parallelization, `.limit(50)`, `toColombiaDateString` for timezone safety, try/catch in wrapper, no public wrappers inside `"use cache"`.

---

## Shared Constant

Add to `webapp/src/actions/occurrences.ts` near the top:

```typescript
/** Fixed lookahead for pending occurrences — covers any monthly pay cycle and ensures
 *  cache key alignment between getDashboardHeroData and getBurnRateCached. */
export const PAY_CYCLE_LOOKAHEAD_DAYS = 45;
```

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `webapp/src/actions/occurrences.ts` | Modify | Add exported `getNextIncomeOccurrenceCached()` + public wrapper with ensure + try/catch |
| `webapp/src/actions/charts.ts` | Modify | Parallel-fetch next income, scope obligations with `PAY_CYCLE_LOOKAHEAD_DAYS`, add pay-cycle fields |
| `webapp/src/actions/live-dashboard.ts` | Modify | Use `daysUntilIncome`, pass income fields, fix `breakdown.totalLiquid` semantic |
| `webapp/src/actions/burn-rate.ts` | Modify | Parallelize all queries, call cached inners directly, single-segment chart, obligation markers |
| `webapp/src/components/mobile/v2/inicio/inicio-hero.tsx` | Modify | Pay-cycle breakdown, income annotation, nudge, "hoy" on payday |
| `webapp/src/components/mobile/v2/inicio/inicio-root.tsx` | Modify | Pass new hero fields through |
| `webapp/src/components/dashboard/dashboard-hero.tsx` | Modify | Pay-cycle labels, income indicator, nudge banner |
| `webapp/src/components/dashboard/burn-rate-card.tsx` | Modify | Obligation markers, income-window subtitle, plan CTA |
| `webapp/src/components/dashboard/burndown-expandable.tsx` | Modify | Pay-cycle critical/warning thresholds, obligation dots |
| `webapp/src/hooks/use-live-metrics.ts` | Modify | Add income fields to fingerprint |

---

### Task 1: Add `getNextIncomeOccurrenceCached()` to occurrences.ts

**Files:**
- Modify: `webapp/src/actions/occurrences.ts`

Exported cached function + public wrapper with `ensureOccurrencesForRange`, try/catch, Colombia timezone, `.limit(50)`, FK hints.

- [ ] **Step 1: Add shared constant and interface after existing imports**

```typescript
import { addDays, startOfMonth } from "date-fns";
import { toColombiaDateString } from "@/lib/utils/date";

/** Fixed lookahead — covers any monthly pay cycle, ensures cache key alignment. */
export const PAY_CYCLE_LOOKAHEAD_DAYS = 45;

export interface NextIncomeInfo {
  date: string;           // ISO date "YYYY-MM-DD"
  amount: number;         // Expected amount
  name: string;           // Merchant/description
  daysUntil: number;      // Days from today (1 = today or tomorrow)
}
```

- [ ] **Step 2: Add the exported cached inner function**

```typescript
// ─── Next income occurrence ──────────────────────────────────────────────────

export async function getNextIncomeOccurrenceCached(
  userId: string,
  todayStr: string,
  currency: string,
  accessToken: string,
): Promise<NextIncomeInfo | null> {
  "use cache";
  cacheTag("occurrences");
  cacheTag("recurring");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select(`
      occurrence_date,
      expected_amount,
      recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner (
        merchant_name,
        description,
        direction,
        currency_code,
        accounts!recurring_transaction_templates_account_id_fkey (
          account_type
        )
      )
    `)
    .eq("user_id", userId)
    .eq("status", "pending")
    .gte("occurrence_date", todayStr)
    .order("occurrence_date", { ascending: true })
    .limit(50);

  if (error || !data || data.length === 0) return null;

  // Find first INFLOW from non-debt account in matching currency
  for (const row of data) {
    const tpl = row.recurring_transaction_templates as {
      merchant_name: string | null;
      description: string | null;
      direction: string;
      currency_code: string;
      accounts: { account_type: string } | null;
    };
    if (tpl.direction !== "INFLOW") continue;
    if (tpl.currency_code !== currency) continue;
    const acctType = tpl.accounts?.account_type;
    if (acctType === "CREDIT_CARD" || acctType === "LOAN") continue;

    const occDate = new Date(row.occurrence_date + "T12:00:00");
    const today = new Date(todayStr + "T12:00:00");
    const daysUntil = Math.max(
      1,
      Math.ceil((occDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    );

    return {
      date: row.occurrence_date,
      amount: row.expected_amount,
      name: tpl.merchant_name ?? tpl.description ?? "Ingreso",
      daysUntil,
    };
  }

  return null;
}
```

- [ ] **Step 3: Add the public wrapper with ensure + try/catch**

```typescript
export async function getNextIncomeOccurrence(
  currency?: string,
): Promise<NextIncomeInfo | null> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return null;

  try {
    // Ensure occurrences are generated far enough ahead for any pay cycle
    const now = new Date();
    await ensureOccurrencesForRange(
      startOfMonth(now),
      addDays(now, PAY_CYCLE_LOOKAHEAD_DAYS),
    );

    const todayStr = toColombiaDateString(now);
    return getNextIncomeOccurrenceCached(user.id, todayStr, currency ?? "COP", accessToken);
  } catch (error) {
    console.error("Error loading next income occurrence:", error);
    return null;
  }
}
```

Note: `ensureOccurrencesForRange` must exist. If only `ensureCurrentOccurrences` exists, check its range — it generates through `endOfMonth + 14 days`. If that's insufficient (< 45 days from today in the second half of a month), either extend it or add a new helper. The key requirement: occurrences must exist 45 days ahead.

- [ ] **Step 4: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add webapp/src/actions/occurrences.ts
git commit -m "feat: add getNextIncomeOccurrenceCached() for pay-cycle budgeting"
```

---

### Task 2: Update `getDashboardHeroData()` to use pay-cycle window

**Files:**
- Modify: `webapp/src/actions/charts.ts:688-809`

Parallel-fetch next income alongside existing calls. Use `PAY_CYCLE_LOOKAHEAD_DAYS` for cache-aligned pending occurrences.

- [ ] **Step 1: Add imports**

```typescript
import { getNextIncomeOccurrence, PAY_CYCLE_LOOKAHEAD_DAYS, type NextIncomeInfo } from "@/actions/occurrences";
```

- [ ] **Step 2: Update `DashboardHeroData` interface (line 688)**

```typescript
export interface DashboardHeroData {
  totalLiquid: number;
  pendingObligations: PendingObligation[];
  totalPending: number;
  availableToSpend: number;
  pendingIncome: number;
  pendingIncomeCount: number;
  monthlyIncome: number;
  monthlySpent: number;
  freshness: "fresh" | "stale" | "outdated";
  oldestUpdate: string | null;
  currency: string;
  hasOtherCurrencies: boolean;
  // Pay-cycle fields
  nextIncomeDate: string | null;
  nextIncomeAmount: number;
  nextIncomeName: string | null;
  daysUntilIncome: number;
  windowObligations: number;
  incomeConfigured: boolean;
}
```

- [ ] **Step 3: Update the empty return (line 709-723) with new field defaults**

```typescript
    return {
      totalLiquid: 0, pendingObligations: [], totalPending: 0, availableToSpend: 0,
      pendingIncome: 0, pendingIncomeCount: 0, monthlyIncome: 0, monthlySpent: 0,
      freshness: "outdated", oldestUpdate: null, currency: "COP", hasOtherCurrencies: false,
      nextIncomeDate: null, nextIncomeAmount: 0, nextIncomeName: null,
      daysUntilIncome: 1, windowObligations: 0, incomeConfigured: false,
    };
```

- [ ] **Step 4: Parallelize fetches — move `getNextIncomeOccurrence` into `Promise.all`**

Replace the existing `Promise.all` (line ~727) with:

```typescript
  const [accountsResult, monthMetrics, nextIncome] = await Promise.all([
    getAccounts(),
    getMonthMetrics(month, currency),
    getNextIncomeOccurrence(baseCurrency).catch(() => null),
  ]);
```

Note: `.catch(() => null)` ensures income fetch failure doesn't break the dashboard.

- [ ] **Step 5: Replace pending occurrences section (lines 765-807)**

```typescript
  const incomeConfigured = nextIncome !== null;

  // Compute window end: next income date or end of month
  const now = new Date();
  const colombiaToday = toColombiaDateString(now);
  let daysUntilIncome: number;
  let windowEndDate: string;

  if (nextIncome) {
    daysUntilIncome = nextIncome.daysUntil;
    windowEndDate = nextIncome.date;
  } else {
    const colombiaDay = getColombiaDayOfMonth(now);
    const [yearStr, monthStr] = colombiaToday.split("-");
    const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
    daysUntilIncome = Math.max(daysInMonth - colombiaDay, 1);
    windowEndDate = `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;
  }

  // Use PAY_CYCLE_LOOKAHEAD_DAYS for cache-aligned fetch, filter in JS
  const pendingResult = await getPendingOccurrences(PAY_CYCLE_LOOKAHEAD_DAYS, baseCurrency);
  const pendingOccurrences = pendingResult.success ? pendingResult.data : [];

  // Filter to pay-cycle window
  const windowOccurrences = pendingOccurrences.filter(
    (o) => o.occurrence_date >= colombiaToday && o.occurrence_date <= windowEndDate
  );

  const recurringObligations: PendingObligation[] = windowOccurrences
    .filter((o) => o.direction === "OUTFLOW")
    .map((o) => ({
      id: o.id,
      name: o.merchant_name ?? o.description ?? "Recurrente",
      amount: o.expected_amount,
      currency_code: o.currency_code,
      due_date: o.occurrence_date,
    }));

  const windowObligationsTotal = windowOccurrences
    .filter((o) => o.direction === "OUTFLOW" && o.account_type !== "CREDIT_CARD")
    .reduce((sum, o) => sum + o.expected_amount, 0);

  const pendingInflowOccurrences = windowOccurrences
    .filter((o) => o.direction === "INFLOW" && o.account_type !== "CREDIT_CARD" && o.account_type !== "LOAN");
  const pendingIncome = pendingInflowOccurrences.reduce((sum, o) => sum + o.expected_amount, 0);
  const pendingIncomeCount = pendingInflowOccurrences.length;

  const allObligations = recurringObligations.sort((a, b) => a.due_date.localeCompare(b.due_date));
  const totalPending = allObligations.reduce((sum, o) => sum + o.amount, 0);
  const availableToSpend = totalLiquid - windowObligationsTotal;

  return {
    totalLiquid, pendingObligations: allObligations, totalPending, availableToSpend,
    pendingIncome, pendingIncomeCount,
    monthlyIncome: monthMetrics.income, monthlySpent: monthMetrics.expenses,
    freshness, oldestUpdate, currency: baseCurrency, hasOtherCurrencies,
    nextIncomeDate: nextIncome?.date ?? null, nextIncomeAmount: nextIncome?.amount ?? 0,
    nextIncomeName: nextIncome?.name ?? null, daysUntilIncome,
    windowObligations: windowObligationsTotal, incomeConfigured,
  };
```

- [ ] **Step 6: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -20`

- [ ] **Step 7: Commit**

```bash
git add webapp/src/actions/charts.ts
git commit -m "feat: scope dashboard hero to pay-cycle window (now → next income)"
```

---

### Task 3: Update `getLiveDashboardData()` for pay-cycle

**Files:**
- Modify: `webapp/src/actions/live-dashboard.ts`

- [ ] **Step 1: Update `LiveDashboardData` interface**

```typescript
export interface LiveDashboardData {
  hero: {
    availablePerDay: number;
    availableTotal: number;
    daysRemaining: number;
    nextIncomeDate: string | null;
    nextIncomeAmount: number;
    nextIncomeName: string | null;
    incomeConfigured: boolean;
    breakdown: {
      totalLiquid: number;
      fixedExpenses: number;
      alreadySpent: number;
    };
  };
  metrics: {
    spentToday: number;
    spentYesterday: number;
    avgLast7: number;
  };
  attention: {
    overdueReminders: AttentionOverdueReminder[];
    upcomingPayments: AttentionUpcomingPayment[];
    pendingEmails: AttentionPendingEmail[];
  };
}
```

- [ ] **Step 2: Replace function body after Promise.all (lines 50-78)**

```typescript
  // Use pay-cycle window from hero data instead of calendar month
  const daysRemaining = heroData.daysUntilIncome;

  const now = new Date();
  const todayStr = toColombiaDateString(now);
  const yesterdayStr = toColombiaDateString(subDays(now, 1));
  const sevenDaysAgo = toColombiaDateString(subDays(now, 7));

  const spentToday = dailySpending.find((d) => d.date === todayStr)?.amount ?? 0;
  const spentYesterday = dailySpending.find((d) => d.date === yesterdayStr)?.amount ?? 0;
  const last7Days = dailySpending.filter((d) => d.date < todayStr && d.date >= sevenDaysAgo);
  const avgLast7 = last7Days.length > 0
    ? last7Days.reduce((sum, d) => sum + d.amount, 0) / last7Days.length
    : 0;

  return {
    hero: {
      availablePerDay: heroData.availableToSpend / daysRemaining,
      availableTotal: heroData.availableToSpend,
      daysRemaining,
      nextIncomeDate: heroData.nextIncomeDate,
      nextIncomeAmount: heroData.nextIncomeAmount,
      nextIncomeName: heroData.nextIncomeName,
      incomeConfigured: heroData.incomeConfigured,
      breakdown: {
        totalLiquid: heroData.totalLiquid,
        fixedExpenses: heroData.windowObligations,
        alreadySpent: heroData.monthlySpent,
      },
    },
    metrics: { spentToday, spentYesterday, avgLast7 },
    attention: {
      overdueReminders: attentionItems.overdueReminders,
      upcomingPayments: attentionItems.upcomingPayments,
      pendingEmails: attentionItems.pendingEmails,
    },
  };
```

Note: `breakdown.totalLiquid` now maps to `heroData.totalLiquid` (liquid balance) instead of `heroData.monthlyIncome`. The UI label in Task 5 changes to "Saldo líquido" to match.

- [ ] **Step 3: Remove unused imports** (`getColombiaDayOfMonth` if no longer used)

- [ ] **Step 4: Verify build + commit**

```bash
cd webapp && pnpm build 2>&1 | tail -20
git add webapp/src/actions/live-dashboard.ts
git commit -m "feat: live dashboard uses pay-cycle window from hero data"
```

---

### Task 4: Update `useLiveDashboard` fingerprint

**Files:**
- Modify: `webapp/src/hooks/use-live-metrics.ts:13-18`

- [ ] **Step 1: Update fingerprint**

```typescript
function fingerprint(d: LiveDashboardData): string {
  const emailIds = d.attention.pendingEmails.map(e => e.id).sort().join(",");
  const reminderIds = d.attention.overdueReminders.map(r => r.id).sort().join(",");
  const paymentIds = d.attention.upcomingPayments.map(p => p.templateId + p.occurrenceDate).sort().join(",");
  return `${emailIds}:${reminderIds}:${paymentIds}:${d.hero.availableTotal}:${d.metrics.spentToday}:${d.hero.daysRemaining}:${d.hero.nextIncomeDate}`;
}
```

- [ ] **Step 2: Verify build + commit**

```bash
cd webapp && pnpm build 2>&1 | tail -20
git add webapp/src/hooks/use-live-metrics.ts
git commit -m "feat: include income fields in live dashboard fingerprint"
```

---

### Task 5: Update mobile hero (`InicioHero` + `InicioRoot`)

**Files:**
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-hero.tsx`
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-root.tsx`

- [ ] **Step 1: Update `InicioHeroProps`**

```typescript
interface InicioHeroProps {
  availablePerDay: number;
  availableTotal: number;
  daysRemaining: number;
  currency: CurrencyCode;
  nextIncomeDate: string | null;
  nextIncomeAmount: number;
  nextIncomeName: string | null;
  incomeConfigured: boolean;
  breakdown?: { totalLiquid: number; fixedExpenses: number; alreadySpent: number };
  primaryAccount?: { id: string; name: string; currentBalance: number; currencyCode: CurrencyCode };
  expanded?: boolean;
  onToggle?: () => void;
}
```

- [ ] **Step 2: Add imports and update destructure**

```typescript
import { formatDate } from "@/lib/utils/date";
```

Add `nextIncomeDate, nextIncomeAmount, nextIncomeName, incomeConfigured` to destructure.

- [ ] **Step 3: Update subtitle (line 69-72)**

```tsx
      <p className="mt-2 text-xs text-muted-foreground">
        {nextIncomeDate
          ? <>= {formatCurrency(availableTotal, currency)} · {nextIncomeDate === toColombiaDateString(new Date()) ? "hoy" : `${daysRemaining} días`} hasta {formatDate(nextIncomeDate, "d MMM")}</>
          : <>= {formatCurrency(availableTotal, currency)} · {daysRemaining} días restantes</>
        }
      </p>
```

Note: Import `toColombiaDateString` for the "hoy" check on payday.

- [ ] **Step 4: Update breakdown section (lines 86-119)**

```tsx
            {breakdown && (
              <div className={cn(PANEL_INSET_CLASS, "border-white/8 bg-black/20 p-3 space-y-1.5")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">Cómo se calcula</p>
                <div className="flex justify-between text-xs text-z-sage-light">
                  <span>Saldo líquido</span>
                  <span>{formatCurrency(breakdown.totalLiquid, currency)}</span>
                </div>
                <div className="flex justify-between text-xs text-z-sage-light">
                  <span>− Obligaciones pendientes</span>
                  <span className="text-z-expense">−{formatCurrency(breakdown.fixedExpenses, currency)}</span>
                </div>
                <div className="flex justify-between text-xs text-z-sage-light">
                  <span>− Ya gastado este mes</span>
                  <span className="text-z-expense">−{formatCurrency(breakdown.alreadySpent, currency)}</span>
                </div>
                <div className="border-t border-white/8 pt-1.5 flex justify-between text-xs font-semibold text-foreground">
                  <span>= Disponible</span>
                  <span>{formatCurrency(availableTotal, currency)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  ÷ {daysRemaining} días{nextIncomeDate ? ` (hasta ${formatDate(nextIncomeDate, "d MMM")})` : ""} = {formatCurrency(availablePerDay, currency)}/día
                </p>
                {nextIncomeDate && (
                  <div className="border-t border-white/8 pt-1.5 flex justify-between text-xs text-z-income">
                    <span>Próximo ingreso: {nextIncomeName}</span>
                    <span>+{formatCurrency(nextIncomeAmount, currency)} el {formatDate(nextIncomeDate, "d MMM")}</span>
                  </div>
                )}
              </div>
            )}

            {!incomeConfigured && (
              <Link
                href="/plan?tab=recurrentes"
                onClick={(e) => e.stopPropagation()}
                className={cn(PANEL_INSET_CLASS, "mt-2 flex items-center justify-between border-z-brass/20 bg-z-brass/5 p-3 transition-colors hover:bg-z-brass/10")}
              >
                <p className="text-[11px] text-z-brass">Configura tus ingresos recurrentes para un presupuesto diario más preciso</p>
                <ChevronRight className="size-3.5 shrink-0 text-z-brass/50" />
              </Link>
            )}
```

- [ ] **Step 5: Update `InicioRootProps.hero` type + component call**

Add to `InicioRootProps.hero`:
```typescript
  nextIncomeDate?: string | null;
  nextIncomeAmount?: number;
  nextIncomeName?: string | null;
  incomeConfigured?: boolean;
```

Pass through in `<InicioHero>`:
```tsx
  nextIncomeDate={live.hero.nextIncomeDate ?? hero.nextIncomeDate ?? null}
  nextIncomeAmount={live.hero.nextIncomeAmount ?? hero.nextIncomeAmount ?? 0}
  nextIncomeName={live.hero.nextIncomeName ?? hero.nextIncomeName ?? null}
  incomeConfigured={live.hero.incomeConfigured ?? hero.incomeConfigured ?? false}
```

- [ ] **Step 6: Update page server component that constructs `InicioRoot` props**

Pass new fields from `getDashboardHeroData()`:
```typescript
  nextIncomeDate: heroData.nextIncomeDate,
  nextIncomeAmount: heroData.nextIncomeAmount,
  nextIncomeName: heroData.nextIncomeName,
  incomeConfigured: heroData.incomeConfigured,
```

- [ ] **Step 7: Verify build + commit**

```bash
cd webapp && pnpm build 2>&1 | tail -20
git add webapp/src/components/mobile/v2/inicio/ webapp/src/app/
git commit -m "feat: mobile hero shows pay-cycle budget with income annotation and nudge"
```

---

### Task 6: Update desktop `DashboardHero`

**Files:**
- Modify: `webapp/src/components/dashboard/dashboard-hero.tsx`

- [ ] **Step 1: Add import + destructure new fields**

```typescript
import { formatDate } from "@/lib/utils/date";
```

Add to destructure: `nextIncomeDate, nextIncomeAmount, nextIncomeName, daysUntilIncome, incomeConfigured`

- [ ] **Step 2: Add window label + update guidance copy**

```typescript
  const windowLabel = nextIncomeDate
    ? `hasta el ${formatDate(nextIncomeDate, "d 'de' MMMM")}`
    : "de este mes";

  const guidanceCopy = hasPendingObligations
    ? `Tienes ${pendingObligations.length} ${pendingObligations.length === 1 ? "pago" : "pagos"} por ${formatCurrency(totalPending, code)} ${windowLabel}.`
    : freshness === "outdated"
      ? "Tu foto actual ya no es lo bastante confiable para decidir con seguridad."
      : freshness === "stale"
        ? "Tu margen se ve estable, pero conviene revisar saldos."
        : "Tu margen está listo para ayudarte a decidir el siguiente paso.";
```

- [ ] **Step 3: Update "Disponible" label**

```tsx
  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
    Disponible {windowLabel}
  </p>
```

- [ ] **Step 4: Add income indicator + nudge before StatusHeadline**

```tsx
        {nextIncomeDate && (
          <div className="flex items-center gap-2 rounded-xl border border-z-income/15 bg-z-income/5 px-4 py-2.5">
            <ArrowDownLeft className="size-4 text-z-income" />
            <p className="text-sm text-z-sage-light">
              Próximo ingreso: <span className="font-semibold text-z-income">+{formatCurrency(nextIncomeAmount, code)}</span> el {formatDate(nextIncomeDate, "d MMM")}
              {nextIncomeName && <span className="text-muted-foreground"> · {nextIncomeName}</span>}
            </p>
          </div>
        )}

        {!incomeConfigured && (
          <Link href="/plan?tab=recurrentes"
            className="flex items-center gap-2 rounded-xl border border-z-brass/15 bg-z-brass/5 px-4 py-2.5 transition-colors hover:bg-z-brass/10">
            <CalendarClock className="size-4 text-z-brass" />
            <p className="text-sm text-z-brass">Configura tus ingresos recurrentes para un presupuesto diario más preciso</p>
          </Link>
        )}
```

- [ ] **Step 5: Verify build + commit**

```bash
cd webapp && pnpm build 2>&1 | tail -20
git add webapp/src/components/dashboard/dashboard-hero.tsx
git commit -m "feat: desktop hero shows pay-cycle window with income indicator and nudge"
```

---

### Task 7: Update burn rate — parallelized, single segment, obligation markers

**Files:**
- Modify: `webapp/src/actions/burn-rate.ts`

**Critical:** `getBurnRateCached` has `"use cache"` — must call cached inners directly, NOT public wrappers (which call `getAuthenticatedClient()` → `cookies()`).

- [ ] **Step 1: Add types and imports**

```typescript
import {
  getNextIncomeOccurrenceCached,
  PAY_CYCLE_LOOKAHEAD_DAYS,
  type NextIncomeInfo,
} from "@/actions/occurrences";

// Import getPendingOccurrencesCached — must be exported from occurrences.ts
import { getPendingOccurrencesCached } from "@/actions/occurrences";

export interface ObligationMarker {
  date: string;
  name: string;
  amount: number;
}
```

Update `BurnRateResponse`:

```typescript
export interface BurnRateResponse {
  total: BurnRateResult;
  discretionary: BurnRateResult;
  liquidBalance: number;
  disponible: number;
  currency: CurrencyCode;
  nextIncomeDate: string | null;
  nextIncomeAmount: number;
  obligations: ObligationMarker[];
}
```

- [ ] **Step 2: Ensure `getPendingOccurrencesCached` is exported from occurrences.ts**

In `occurrences.ts`, change the existing `async function getPendingOccurrencesCached(...)` to `export async function getPendingOccurrencesCached(...)`.

- [ ] **Step 3: Parallelize all fetches in `getBurnRateCached`**

Replace the sequential queries with:

```typescript
  const todayStr = toColombiaDateString(today);
  const threeMonthsAgo = toColombiaDateString(subMonths(today, 3));
  const rangeEnd = addDays(today, PAY_CYCLE_LOOKAHEAD_DAYS).toISOString().split("T")[0];

  const [
    { data: templates },
    { data: accounts, error: accountsError },
    { data: transactions, error: txError },
    nextIncome,
    pendingOccurrences,
  ] = await Promise.all([
    supabase.from("recurring_transaction_templates")
      .select("amount, direction, currency_code")
      .eq("user_id", userId).eq("is_active", true),
    supabase.from("accounts")
      .select("id, current_balance, currency_code, account_type")
      .eq("user_id", userId).eq("is_active", true)
      .in("account_type", ["CHECKING", "SAVINGS"]),
    supabase.from("transactions")
      .select("id, amount, transaction_date, direction, is_recurring")
      .eq("user_id", userId).eq("direction", "OUTFLOW")
      .eq("is_excluded", false).is("reconciled_into_transaction_id", null)
      .eq("currency_code", baseCurrency).gte("transaction_date", threeMonthsAgo)
      .order("transaction_date", { ascending: true }),
    getNextIncomeOccurrenceCached(userId, todayStr, baseCurrency, accessToken),
    getPendingOccurrencesCached(userId, todayStr, rangeEnd, accessToken),
  ]);
```

- [ ] **Step 4: Build obligation markers + window end**

```typescript
  if (accountsError) throw accountsError;
  if (!accounts || accounts.length === 0) return null;
  if (txError) throw txError;
  if (!transactions || transactions.length === 0) return null;

  // Window end for obligation scoping
  let windowEndDate: string;
  if (nextIncome) {
    windowEndDate = nextIncome.date;
  } else {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    windowEndDate = `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  }

  const obligationMarkers: ObligationMarker[] = (pendingOccurrences ?? [])
    .filter((o) => o.direction === "OUTFLOW" && o.occurrence_date >= todayStr && o.occurrence_date <= windowEndDate)
    .map((o) => ({
      date: o.occurrence_date,
      name: o.merchant_name ?? o.description ?? "Recurrente",
      amount: o.expected_amount,
    }));
```

- [ ] **Step 5: Pass `windowEndDate` to `computeBurnRate` + update return**

Update `computeBurnRate` signature to accept `windowEndDate: string`. Replace the projected point logic to project to `windowEndDate` instead of $0:

```typescript
  // Add projected point at window end (next income or month end)
  if (windowEndDate > todayStr) {
    const daysToEnd = Math.max(1, Math.ceil(
      (new Date(windowEndDate + "T12:00:00").getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    ));
    const projectedBalance = Math.max(0, balance - dailyAverage * daysToEnd);
    dataPoints.push({ date: windowEndDate, balance: projectedBalance });
  }
```

Return:
```typescript
  return {
    total, discretionary, liquidBalance, disponible, currency: baseCurrency,
    nextIncomeDate: nextIncome?.date ?? null,
    nextIncomeAmount: nextIncome?.amount ?? 0,
    obligations: obligationMarkers,
  };
```

- [ ] **Step 6: Verify build + commit**

```bash
cd webapp && pnpm build 2>&1 | tail -20
git add webapp/src/actions/burn-rate.ts webapp/src/actions/occurrences.ts
git commit -m "feat: burn rate parallelized with pay-cycle segment and obligation markers"
```

---

### Task 8: Update `BurnRateCard` — obligation markers + plan CTA

**Files:**
- Modify: `webapp/src/components/dashboard/burn-rate-card.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { formatDate } from "@/lib/utils/date";
import Link from "next/link";
```

- [ ] **Step 2: Update subtitle (lines 125-139)**

```tsx
        <p className="text-sm text-muted-foreground mb-4">
          {data.nextIncomeDate ? (
            <>Margen hasta <span className="text-foreground font-medium">{formatDate(data.nextIncomeDate, "d 'de' MMMM")}</span> · </>
          ) : (
            <>{runwayDateFormatted && <>Al ritmo actual, {runwayDateFormatted} · </>}</>
          )}
          Promedio diario: <span className="text-foreground">{formatCurrency(result.dailyAverage, data.currency)}</span>
          {result.monthsOfData <= 1 && (
            <span className="text-xs text-muted-foreground/60 ml-1">· Basado en {result.monthsOfData} mes de datos</span>
          )}
        </p>
```

- [ ] **Step 3: Add obligation reference lines in chart (before `</AreaChart>`)**

```tsx
              {data.obligations.map((ob) => (
                <ReferenceLine key={ob.date} x={ob.date}
                  stroke="var(--z-expense)" strokeOpacity={0.3} strokeDasharray="2 2"
                  label={{ value: ob.name, position: "top", fontSize: 9, fill: "var(--z-sage-dark)" }}
                />
              ))}
```

- [ ] **Step 4: Add plan CTA after chart**

```tsx
        <div className="mt-3 text-center">
          <Link href="/plan" className="text-xs font-medium text-z-brass hover:text-z-brass/80 transition-colors">
            Ver plan mensual completo →
          </Link>
        </div>
```

- [ ] **Step 5: Verify build + commit**

```bash
cd webapp && pnpm build 2>&1 | tail -20
git add webapp/src/components/dashboard/burn-rate-card.tsx
git commit -m "feat: burn rate chart shows obligation markers and plan CTA"
```

---

### Task 9: Update `BurndownExpandable` (mobile) for pay-cycle

**Files:**
- Modify: `webapp/src/components/dashboard/burndown-expandable.tsx`

- [ ] **Step 1: Update critical/warning calculation**

Replace month-based `daysRemaining` with income-aware:

```typescript
  const daysRemaining = data.nextIncomeDate
    ? Math.max(1, Math.ceil(
        (new Date(data.nextIncomeDate + "T12:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ))
    : (() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
      })();
```

- [ ] **Step 2: Update explanation text**

Use "al próximo ingreso" when income configured, "al cierre del mes" otherwise:

```tsx
  {data.nextIncomeDate ? " al próximo ingreso" : ` al día ${daysInMonth}`}
```

- [ ] **Step 3: Pass obligations to `RunwayMiniChart` and add dot markers**

Add `obligations` prop, render small circles at obligation dates in the SVG.

- [ ] **Step 4: Verify build + commit**

```bash
cd webapp && pnpm build 2>&1 | tail -20
git add webapp/src/components/dashboard/burndown-expandable.tsx
git commit -m "feat: mobile burndown uses pay-cycle window with obligation markers"
```

---

### Task 10: Wire up page-level server components

**Files:**
- Find and modify pages that render `DashboardHero` and `InicioRoot`

- [ ] **Step 1: Find pages**

`DashboardHero` receives `data: DashboardHeroData` directly — no changes needed since the interface was updated.

`InicioRoot` has its `hero` prop constructed manually. Add new fields from `heroData`:

```typescript
  nextIncomeDate: heroData.nextIncomeDate,
  nextIncomeAmount: heroData.nextIncomeAmount,
  nextIncomeName: heroData.nextIncomeName,
  incomeConfigured: heroData.incomeConfigured,
```

- [ ] **Step 2: Verify build + commit**

```bash
cd webapp && pnpm build 2>&1 | tail -20
git add webapp/src/app/
git commit -m "feat: wire pay-cycle hero fields through page server components"
```

---

### Task 11: Visual verification + final build gate

- [ ] **Step 1: Full build**

```bash
cd webapp && pnpm install && pnpm build 2>&1 | tail -30
```

- [ ] **Step 2: Start dev server and test**

Test cases:
1. **With recurring income**: Hero shows "Disponible hasta [date]", pay-cycle breakdown, income annotation
2. **Without recurring income**: Falls back to end-of-month, nudge visible
3. **On payday**: Shows "hoy" not "en 1 día"
4. **Mobile hero**: Same behavior — expanded breakdown shows "Saldo líquido"
5. **Burn rate card**: Chart ends at next income, obligation markers visible
6. **Burndown expandable**: Critical/warning thresholds use pay-cycle days

- [ ] **Step 3: Commit fixes**

```bash
git add -A && git commit -m "fix: visual adjustments from income-aware runway testing"
```
