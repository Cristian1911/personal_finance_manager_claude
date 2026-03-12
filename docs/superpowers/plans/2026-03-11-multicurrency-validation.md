# Multi-Currency Validation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken cross-currency aggregation by scoping all dashboard/debt metrics to the user's preferred currency.

**Architecture:** Every aggregation function gains a `currency` parameter. The dashboard page resolves `preferred_currency` from the user's profile and passes it to all chart/debt queries. No exchange rates — filter only.

**Tech Stack:** Next.js 15 (App Router), Supabase, TypeScript, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-11-multicurrency-and-recipient-management-design.md`

---

## File Structure

| File | Responsibility | Change |
|------|---------------|--------|
| `webapp/src/actions/charts.ts` | Dashboard aggregation queries | Add `currency` param to 5 functions, filter queries |
| `webapp/src/actions/debt.ts` | Debt overview aggregation | Replace hardcoded `"COP"` with `currency` param |
| `webapp/src/lib/utils/debt-simulator.ts` | Debt payoff calculator | Replace hardcoded `"COP"` with `currency` param |
| `webapp/src/app/(dashboard)/dashboard/page.tsx` | Dashboard page orchestrator | Fetch `preferred_currency`, pass to all queries |
| `webapp/src/app/(dashboard)/deudas/page.tsx` | Debt dashboard page | Fetch `preferred_currency`, pass to `getDebtOverview` |
| `webapp/src/app/(dashboard)/deudas/simulador/page.tsx` | Debt simulator page | Fetch `preferred_currency`, pass through |
| `webapp/src/components/dashboard/dashboard-hero.tsx` | Hero metrics card | Show "En COP" label + secondary currency note |
| `webapp/src/components/dashboard/accounts-overview.tsx` | Account list on dashboard | Sub-group by currency within deposit/debt |

---

## Chunk 1: Currency-Scoped Aggregation

### Task 1: Add currency param to chart aggregation functions

**Files:**
- Modify: `webapp/src/actions/charts.ts`

- [ ] **Step 1: Add `currency` param to `getCategorySpending`**

At line 46, change:
```typescript
export async function getCategorySpending(month?: string): Promise<CategorySpending[]>
```
to:
```typescript
export async function getCategorySpending(month?: string, currency?: string): Promise<CategorySpending[]>
```

Then after the transaction query (around line 72, where transactions are fetched), add `.eq("currency_code", currency ?? "COP")` to the Supabase query chain.

- [ ] **Step 2: Add `currency` param to `getMonthlyCashflow`**

At line 122, change:
```typescript
export async function getMonthlyCashflow(month?: string): Promise<MonthlyCashflow[]>
```
to:
```typescript
export async function getMonthlyCashflow(month?: string, currency?: string): Promise<MonthlyCashflow[]>
```

Add `.eq("currency_code", currency ?? "COP")` to the transaction query.

- [ ] **Step 3: Add `currency` param to `getDailyBudgetPace`**

At line 629, change:
```typescript
export async function getDailyBudgetPace(
  month?: string
): Promise<{ data: DailyBudgetPace[]; totalBudget: number; totalSpent: number }>
```
to:
```typescript
export async function getDailyBudgetPace(
  month?: string, currency?: string
): Promise<{ data: DailyBudgetPace[]; totalBudget: number; totalSpent: number }>
```

Add `.eq("currency_code", currency ?? "COP")` to the transaction query used for budget pace calculation.

- [ ] **Step 4: Add `currency` param to `getDashboardHeroData`**

At line 415, change:
```typescript
export async function getDashboardHeroData(
  month?: string
): Promise<DashboardHeroData>
```
to:
```typescript
export async function getDashboardHeroData(
  month?: string, currency?: string
): Promise<DashboardHeroData>
```

Filter the accounts query at line 440 to only sum accounts matching the currency:
```typescript
const baseCurrency = currency ?? "COP";
const currencyAccounts = accounts.filter((a) => a.currency_code === baseCurrency);
const totalLiquid = currencyAccounts.reduce((sum, a) => sum + a.current_balance, 0);
```

Filter obligations at line 477 by currency:
```typescript
const allObligations = [...recurringObligations, ...statementObligations]
    .filter((o) => o.currency_code === baseCurrency)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
```

Replace the currency resolution at line 482:
```typescript
const currency_out = baseCurrency;
```

- [ ] **Step 5: Add `currency` param to `getNetWorthHistory`**

At line 325, change:
```typescript
export async function getNetWorthHistory(month?: string): Promise<NetWorthHistory[]>
```
to:
```typescript
export async function getNetWorthHistory(month?: string, currency?: string): Promise<NetWorthHistory[]>
```

Filter accounts by currency at lines 340-346:
```typescript
const baseCurrency = currency ?? "COP";
const currencyAccounts = accounts.filter((a) => a.currency_code === baseCurrency);
const totalAssets = currencyAccounts
    .filter((a) => a.account_type !== "CREDIT_CARD" && a.account_type !== "LOAN")
    .reduce((sum, a) => sum + a.current_balance, 0);
const totalLiabilities = currencyAccounts
    .filter((a) => a.account_type === "CREDIT_CARD" || a.account_type === "LOAN")
    .reduce((sum, a) => sum + computeDebtBalance(a as Parameters<typeof computeDebtBalance>[0]), 0);
```

- [ ] **Step 6: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Clean build (no callers need changes yet — new params are optional with `?? "COP"` defaults)

- [ ] **Step 7: Commit**

```bash
git add webapp/src/actions/charts.ts
git commit -m "feat(multicurrency): add currency param to chart aggregation functions"
```

---

### Task 2: Add currency param to debt functions

**Files:**
- Modify: `webapp/src/actions/debt.ts`
- Modify: `webapp/src/lib/utils/debt-simulator.ts`

- [ ] **Step 1: Add `currency` param to `getDebtOverview`**

At line 12, change:
```typescript
export async function getDebtOverview(): Promise<DebtOverview>
```
to:
```typescript
export async function getDebtOverview(currency?: string): Promise<DebtOverview>
```

Replace lines 62-82. Everywhere `"COP"` is hardcoded, use `const baseCurrency = currency ?? "COP"`:
- Line 62: `const copEntry = byCurrency.get(baseCurrency);`
- Line 72: `.filter((a) => a.type === "CREDIT_CARD" && a.currency === baseCurrency)`
- Line 78: `.filter((a) => a.currency === baseCurrency)`

- [ ] **Step 2: Add `currency` param to `allocateLumpSum`**

At line 184, change:
```typescript
export function allocateLumpSum(
  accounts: DebtAccount[],
  lumpSum: number
): LumpSumResult
```
to:
```typescript
export function allocateLumpSum(
  accounts: DebtAccount[],
  lumpSum: number,
  currency?: string
): LumpSumResult
```

At line 190, replace:
```typescript
.filter((a) => a.balance > 0 && a.currency === "COP")
```
with:
```typescript
.filter((a) => a.balance > 0 && a.currency === (currency ?? "COP"))
```

- [ ] **Step 3: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Clean build (params are optional)

- [ ] **Step 4: Commit**

```bash
git add webapp/src/actions/debt.ts webapp/src/lib/utils/debt-simulator.ts
git commit -m "feat(multicurrency): add currency param to debt functions"
```

---

### Task 3: Wire preferred_currency through dashboard and debt pages

**Files:**
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`
- Modify: `webapp/src/app/(dashboard)/deudas/page.tsx`
- Modify: `webapp/src/app/(dashboard)/deudas/simulador/page.tsx`

- [ ] **Step 1: Resolve preferred_currency in dashboard page**

In `dashboard/page.tsx`, after `const { supabase, user } = await getAuthenticatedClient();` (line 66), fetch the user's preferred currency:

```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("preferred_currency")
  .eq("id", user.id)
  .single();

const currency = profile?.preferred_currency ?? "COP";
```

Then update the `Promise.all` block (lines 185-194) to pass `currency`:
```typescript
const [heroData, accountsData, budgetPaceData, cashflowData, categoryData, allAccountsResult, latestSnapshotDates] =
    await Promise.all([
      getDashboardHeroData(month, currency),
      getAccountsWithSparklineData(),
      getDailyBudgetPace(month, currency),
      getMonthlyCashflow(month, currency),
      getCategorySpending(month, currency),
      getAccounts(),
      getLatestSnapshotDates(),
    ]);
```

- [ ] **Step 2: Resolve preferred_currency in deudas page**

In `deudas/page.tsx`, after auth, fetch profile and pass currency:
```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("preferred_currency")
  .eq("id", user.id)
  .single();

const currency = profile?.preferred_currency ?? "COP";
const overview = await getDebtOverview(currency);
```

Also replace the hardcoded COP filtering in component logic (around line 40):
```typescript
const copCreditCards = creditCards.filter((a) => a.currency === currency);
```

- [ ] **Step 3: Resolve preferred_currency in simulador page**

In `deudas/simulador/page.tsx`, after auth, fetch profile and pass currency:
```typescript
const currency = profile?.preferred_currency ?? "COP";
const overview = await getDebtOverview(currency);
```

Pass currency to the DebtSimulator component as a prop so `allocateLumpSum` uses it.

- [ ] **Step 4: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 5: Commit**

```bash
git add webapp/src/app/\(dashboard\)/dashboard/page.tsx webapp/src/app/\(dashboard\)/deudas/page.tsx webapp/src/app/\(dashboard\)/deudas/simulador/page.tsx
git commit -m "feat(multicurrency): wire preferred_currency through dashboard and debt pages"
```

---

### Task 4: Dashboard hero currency label and accounts overview grouping

**Files:**
- Modify: `webapp/src/components/dashboard/dashboard-hero.tsx`
- Modify: `webapp/src/components/dashboard/accounts-overview.tsx`

- [ ] **Step 1: Add currency label to dashboard hero**

In `dashboard-hero.tsx`, add a currency label next to the title. After the "Disponible para gastar" heading, add:
```tsx
<span className="text-sm font-normal text-muted-foreground ml-2">
  En {code}
</span>
```

- [ ] **Step 2: Add secondary currency note to dashboard hero**

The `DashboardHeroData` type needs a new field. In `charts.ts`, add `hasOtherCurrencies: boolean` to the return value. Set it based on whether accounts exist in currencies other than the base:
```typescript
const hasOtherCurrencies = accounts.some((a) => a.currency_code !== baseCurrency);
```

In `dashboard-hero.tsx`, if `data.hasOtherCurrencies`:
```tsx
{data.hasOtherCurrencies && (
  <p className="text-xs text-muted-foreground mt-1">
    Tienes cuentas en otras monedas no incluidas en estos totales.
  </p>
)}
```

- [ ] **Step 3: Group accounts by currency in accounts overview**

In `accounts-overview.tsx`, within the deposits and debt rendering sections (lines 143-162), group accounts by `currency_code` before rendering. Add a currency header within each group:

```tsx
{Object.entries(
  Object.groupBy(previewDeposits, (a) => a.currency_code)
).map(([curr, accts]) => (
  <div key={curr}>
    {Object.keys(Object.groupBy(previewDeposits, (a) => a.currency_code)).length > 1 && (
      <p className="text-xs text-muted-foreground mt-2 mb-1">{curr}</p>
    )}
    <div className="divide-y">
      {accts!.map((a) => <AccountRow key={a.id} account={a} />)}
    </div>
  </div>
))}
```

Only show the currency sub-header when there are multiple currencies in that group.

- [ ] **Step 4: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/dashboard/dashboard-hero.tsx webapp/src/components/dashboard/accounts-overview.tsx webapp/src/actions/charts.ts
git commit -m "feat(multicurrency): currency label on hero, group accounts by currency"
```

---

### Task 5: Preferred currency setting in profile

**Files:**
- Modify: `webapp/src/app/(dashboard)/settings/page.tsx` (or the ProfileForm component it renders)

- [ ] **Step 1: Check if ProfileForm already has preferred_currency**

Read `webapp/src/actions/profile.ts` — it already has `preferred_currency` in the Zod schema (line 11) and `updateProfile()` already saves it. Read the ProfileForm component to see if the dropdown exists.

If the dropdown already exists in the form, this task is done. If not:

- [ ] **Step 2: Add currency dropdown to ProfileForm**

Add a Select field for "Moneda preferida" with options from the currency enum: COP, USD, EUR, BRL, MXN, PEN, CLP, ARS. Pre-select the current value from `profile.preferred_currency`.

- [ ] **Step 3: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/settings/ webapp/src/app/\(dashboard\)/settings/
git commit -m "feat(multicurrency): preferred currency setting in profile"
```

---

### Task 6: Edge case — fallback when no accounts in preferred currency

**Files:**
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Add fallback logic**

After resolving `currency` from profile, check if there are accounts in that currency. If not, fall back:

```typescript
const { data: currencyCheck } = await supabase
  .from("accounts")
  .select("id")
  .eq("user_id", user.id)
  .eq("is_active", true)
  .eq("currency_code", currency)
  .limit(1);

if (!currencyCheck?.length) {
  // Fallback to first active account's currency
  const { data: fallback } = await supabase
    .from("accounts")
    .select("currency_code")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .single();
  if (fallback) currency = fallback.currency_code;
}
```

Note: make `currency` a `let` instead of `const` for this.

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(multicurrency): fallback when no accounts in preferred currency"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full build**

Run: `cd webapp && pnpm build`
Expected: Clean build, no type errors

- [ ] **Step 2: Manual smoke test**

Start dev server: `cd webapp && pnpm dev`
- Dashboard should show "En COP" label
- If user has USD accounts, note about other currencies should appear
- Accounts overview should group by currency when mixed
- Settings should show currency dropdown
- Debt dashboard should respect preferred currency

- [ ] **Step 3: Final commit if any fixes needed**
