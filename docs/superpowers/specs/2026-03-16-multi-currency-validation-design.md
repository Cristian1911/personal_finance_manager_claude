# Multi-Currency Validation + Exchange Rate Nudge

**Date:** 2026-03-16
**Status:** Approved
**Branch:** TBD (new feature branch)

---

## Problem

Zeta supports 8 currencies and multi-currency credit cards (COP + USD on the same card). The schema is solid, but several pages mix currencies in totals without filtering or converting:

1. **Budget/categories** — `getCategoriesWithBudgetData()` fetches all transactions regardless of currency, so USD purchases inflate COP budget tracking
2. **Accounts net worth** — `totalBalance` sums all accounts without currency filtering, mixing COP + USD
3. **Recurring templates** — recurring expense queries have no currency filter

Additionally, users with USD debt have no visibility into exchange rate movements, missing opportunities to pay when the dollar is cheap.

## Design

### Part 1: Currency Filtering Bug Fixes

**`getCategoriesWithBudgetData()` in `webapp/src/actions/categories.ts`:**
- Add `currency` parameter (defaults to preferred currency)
- Add `.eq("currency_code", currency)` to the transactions query
- Add `.eq("currency_code", currency)` to the recurring templates query
- Update the categories page to pass `currency` through

**`accounts/page.tsx` net worth calculation:**
- Filter accounts by `preferred_currency` for the main total
- Detect secondary currencies and show them separately (same pattern as `DebtHeroCard` with `secondaryCurrencies`)
- Show: "Patrimonio neto: $X COP" + "También tienes: $Y USD"

**Recurring expense queries:**
- Add `.eq("currency_code", currency)` wherever recurring templates are fetched for budget/obligation calculations

### Part 2: Exchange Rate Cache

**New table: `exchange_rate_cache`**

```sql
CREATE TABLE exchange_rate_cache (
  pair text PRIMARY KEY,           -- e.g. "USD_COP"
  rate numeric NOT NULL,           -- today's rate e.g. 4180.50
  rates_30d jsonb NOT NULL DEFAULT '[]', -- [{date: "2026-03-16", rate: 4180.50}, ...]
  avg_30d numeric,                 -- precomputed 30-day average
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- No RLS needed — this is app-level shared data, not user-specific
ALTER TABLE exchange_rate_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exchange_rate_cache_read" ON exchange_rate_cache FOR SELECT USING (true);
```

No user_id column — exchange rates are global. All authenticated users can read. Only the server action writes (via service role or a dedicated insert policy).

**Server action: `getExchangeRate(from, to)`**

- File: `webapp/src/actions/exchange-rate.ts`
- Checks `exchange_rate_cache` for the pair
- If `fetched_at` is >24h old (or row doesn't exist), fetches from `frankfurter.app`:
  - `GET https://api.frankfurter.app/latest?from=USD&to=COP`
  - Also fetches 30-day history: `GET https://api.frankfurter.app/2026-02-14..2026-03-16?from=USD&to=COP`
  - Upserts the cache row with new rate, rates_30d array, and computed avg_30d
- Returns: `{ rate: number, avg30d: number, percentVsAvg: number, fetchedAt: string }`
- The first user of the day pays ~200ms fetch; all others get cached data

**Frankfurter API details:**
- Free, open source, no API key required
- Uses ECB daily reference rates
- Supports COP, USD, EUR, BRL, MXN, PEN, CLP, ARS (all Zeta currencies)
- Rate limit: no documented limit, but we call at most once per 24h per pair

### Part 3: Currency Conversion in Totals

**Where conversion applies:**
- Accounts net worth: convert secondary currency accounts to preferred currency for a unified total
- Debt overview: the `debtByCurrency` already shows secondary currencies — add converted COP equivalent
- Salary bar: if user has USD debt payments, convert to COP for the salary proportion

**Display pattern:**
- Primary total in preferred currency (bold, large)
- Secondary amounts shown as: "$450 USD (~$1.881.000 COP)"
- Conversion note: "Tasa: 1 USD = $4,180 COP (hoy)"

**Where conversion does NOT apply:**
- Individual transaction amounts (always shown in original currency)
- Statement snapshots (stored in original currency)
- Per-account balances in account detail pages (original currency)

### Part 4: USD Debt Payment Nudge

**Location:** Deudas page, above the salary bar (or below the hero cards)

**Logic:**
1. Check if user has any debt accounts with currency !== preferred_currency
2. If yes, fetch exchange rate for that currency pair
3. Compare today's rate vs 30-day average:
   - **Below average by >2%**: Show green surface card (surface-income pattern)
     - "El dólar está a $4,180 — 3.2% más barato que tu promedio de 30 días. Buen momento para pagar tus deudas en USD."
   - **Above average by >2%**: No nudge (don't add stress)
   - **Within 2%**: Neutral info line — "Dólar hoy: $4,180 COP"

**Component:** `ExchangeRateNudge` — client component on the deudas page
- Props: `rate: number`, `avg30d: number`, `currency: string`, `preferredCurrency: string`
- Only rendered when the user has secondary currency debts

### Part 5: Future Considerations (NOT in scope)

- **Manual "check rate" button** — for features that need real-time rates (e.g., "pay now" flow)
- **Automatic conversion at import time** — populate `amount_in_base_currency` and `exchange_rate` on transactions
- **Currency selector per page** — let users toggle between COP and USD views
- **Multi-currency budget tracking** — separate budgets per currency

## Files Changed

**New files:**
- `webapp/src/actions/exchange-rate.ts` — server action for rate fetching/caching
- `webapp/src/components/debt/exchange-rate-nudge.tsx` — nudge component

**Modified files:**
- `webapp/src/actions/categories.ts` — add currency filter to budget queries
- `webapp/src/app/(dashboard)/accounts/page.tsx` — filter net worth by currency
- `webapp/src/app/(dashboard)/deudas/page.tsx` — add nudge component
- `webapp/src/app/(dashboard)/categories/page.tsx` — pass currency to data fetching

**Migration:**
- New `exchange_rate_cache` table

## Success Criteria

1. Budget page only shows transactions in the user's preferred currency
2. Net worth only sums accounts in preferred currency, shows secondary separately
3. Exchange rate is fetched and cached automatically (no user action needed)
4. Users with USD debt see a nudge when the dollar is cheap
5. No external API calls more than once per 24h per currency pair
