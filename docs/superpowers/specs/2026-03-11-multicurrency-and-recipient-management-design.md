# Multi-Currency Validation & Recipient Management Enhancement

## Overview

Two independent improvements to the Zeta webapp:

1. **Multi-currency validation** — Fix broken cross-currency aggregation by scoping all dashboard metrics to the user's preferred currency. No exchange rates or conversion — just honest, currency-aware totals.

2. **Recipient management enhancement** — Smarter pattern detection with noise stripping, a dedicated import wizard step for recipient curation, and a background suggestion scanner on the destinatarios page.

---

## Feature 1: Multi-Currency — Currency-Scoped Aggregation

### Problem

The storage layer correctly tracks currency per transaction, account, and snapshot. But every aggregation function (dashboard hero, cashflow, budget pace, net worth, debt) naively sums amounts across currencies without conversion, producing incorrect totals when a user has both COP and USD accounts.

### Solution

All aggregation queries receive a `currency` parameter. The dashboard resolves the user's `preferred_currency` from their profile (default: `"COP"`) and passes it through. No exchange rates, no conversion — filter only.

### Implementation Approach: Currency Flow

The dashboard page (`app/(dashboard)/dashboard/page.tsx`) is the orchestrator. It already calls `getAuthenticatedClient()` which returns the user. The flow:

1. Dashboard page fetches `profiles.preferred_currency` for the current user (single query, cached with React `cache()`)
2. Passes `currency` as a parameter to every aggregation function in the `Promise.all()` block
3. Each aggregation function adds `.eq("currency_code", currency)` to its Supabase queries
4. Components receive currency-filtered data — no component-level filtering needed

Functions that already accept `month?` get a second param: `getDashboardHeroData(month, currency)`, etc.

For debt: `getDebtOverview()` currently accepts no params. It gets a `currency` param. The debt simulator page similarly resolves `preferred_currency` and passes it to `allocateLumpSum(accounts, currency)` — the function filters accounts by currency instead of the current hardcoded `"COP"`.

### Affected Queries

**`actions/charts.ts`:**

| Function | Current Signature | New Signature |
|----------|------------------|---------------|
| `getDashboardHeroData(month?)` | Sums all accounts | `getDashboardHeroData(month?, currency)` — filter accounts + obligations |
| `getNetWorthHistory(month?)` | Sums all assets/liabilities | `getNetWorthHistory(month?, currency)` — filter by currency |
| `getMonthlyCashflow(month?)` | Sums all transactions | `getMonthlyCashflow(month?, currency)` — `.eq("currency_code", currency)` |
| `getDailyBudgetPace(month?)` | Sums all budget spending | `getDailyBudgetPace(month?, currency)` — filter transactions |
| `getCategorySpending(month?)` | Sums all categories | `getCategorySpending(month?, currency)` — filter transactions |

**`actions/debt.ts`:**

| Function | Current Behavior | Fix |
|----------|-----------------|-----|
| `getDebtOverview()` | Hardcoded `.filter("COP")` on lines 72, 78 | Accept `currency` param, replace hardcoded `"COP"` |

**`lib/utils/debt-simulator.ts`:**

| Function | Current Behavior | Fix |
|----------|-----------------|-----|
| `allocateLumpSum()` | `.filter(a => a.currency === "COP")` | Accept `currency` param, filter by it. Callers pass pre-resolved `preferred_currency` |

### Accounts Overview

`getAccountsWithSparklineData()` returns `{ deposits: AccountWithSparkline[], debt: AccountWithSparkline[] }`. Each `AccountWithSparkline` already has `currency_code`. The component (`accounts-overview.tsx`) adds rendering logic: within the deposits and debt sections, group accounts by `currency_code` and show a per-currency subtotal label (e.g. "COP" section header with total, "USD" section header with total). This is a component-layer change — the action doesn't change.

### Dashboard Hero

The hero card shows metrics for `preferred_currency` only. A small label "En COP" (or whatever the currency is) appears next to the title.

If the user has active accounts in currencies other than their preferred one, show a note: "Tienes cuentas en otras monedas no incluidas en estos totales." (Generic wording — works for any combination of secondary currencies.)

### Edge Case: No Accounts in Preferred Currency

If `preferred_currency` is set to a currency with no accounts (e.g. user sets EUR but only has COP + USD), fall back to the currency of the user's first active account (ordered by `created_at`). This prevents an empty dashboard.

### Profile Setting

Add a "Moneda preferida" dropdown to the existing settings page (`app/(dashboard)/settings/page.tsx`). Options come from the `currency_code` enum. The update action goes through `actions/profile.ts` — add an `updatePreferredCurrency(currency)` server action with Zod validation (`z.enum(["COP", "USD", "EUR", ...])`) and `.eq("id", user.id)` guard.

### Out of Scope (Future)

- Exchange rates or conversion
- Unified cross-currency net worth
- Currency toggle on dashboard (could be added later as enhancement to Approach B)

---

## Feature 2: Recipient Management Enhancement

### Problem

The existing destinatarios system has pattern matching and import-time suggestions, but:
- The detection algorithm produces too much noise ("SUC", "PAGO" as standalone suggestions)
- There's no dedicated space to curate matches during import — suggestions are crammed into the confirm step
- Transaction history isn't mined for patterns outside the import flow

### Sub-Feature 2A: Enhanced Detection Algorithm

#### Noise Stripping

New exported `cleanDescription(raw)` function in `packages/shared/src/utils/destinatario-matcher.ts`. This **replaces** the current token-based n-gram approach in `detectDestinatarioSuggestions()`.

Algorithm:
1. Uppercase + trim
2. Strip known noise tokens (full words only, not substrings):
   - Common prefixes: `SUC`, `SUCURSAL`, `OFC`, `OFICINA`, `PAG`, `PAGO`, `COMPRA`
   - Numeric suffixes: strip trailing digit-only tokens (branch codes, terminal IDs)
   - Bank-specific junk: `DISPONIBLE`, `CR`, `DB`, `REVERSO DE`
3. Collapse whitespace
4. Return cleaned string

**Examples:**

| Raw Description | Current Token Output | `cleanDescription()` Output |
|----------------|---------------------|---------------------------|
| `MERCADO PAGO SUC 001` | `["mercado", "pago", "suc", "mercado pago", "pago suc"]` | `MERCADO` |
| `NETFLIX.COM 8843291` | `["netflix.com", "8843291", "netflix.com 8843291"]` | `NETFLIX.COM` |
| `PAGO SUCURSAL VIRTUAL BANCOLOMBIA` | `["pago", "sucursal", "virtual", ...]` | `VIRTUAL BANCOLOMBIA` |
| `DLO*GOOGLE Archero` | `["dlo*google", "archero", ...]` | `DLO*GOOGLE ARCHERO` |

The key difference: current code generates multiple candidate patterns per description (n-grams). The new approach produces **one cleaned description per transaction**, then groups by exact cleaned match. This eliminates noisy fragments.

#### Improved Grouping

`detectDestinatarioSuggestions()` is rewritten:

1. Run `cleanDescription()` on each transaction description
2. Group transactions by cleaned description
3. Groups with 2+ transactions become suggestions
4. Each suggestion carries: `cleanedPattern`, `rawDescriptions: string[]` (originals for display), `count`, `transactionPreviews: { date, rawDescription, amount }[]`

### Sub-Feature 2B: Import Wizard Step 2.5 — "Destinatarios"

#### Wizard Flow Change

Current: Upload → Review → Confirm → Results (4 steps)
New: Upload → Review → **Destinatarios** → Confirm → Results (5 steps)

The step counter in `app/(dashboard)/import/page.tsx` updates from 4 to 5. New component: `webapp/src/components/import/step-destinatarios.tsx`

#### Transaction Scope

Step 2.5 processes **all transactions from all mapped statements** — i.e. every transaction from statements that the user mapped to an account in Step 2. This is the same set that Step 3 (Confirm) will later show for selection.

#### Step Behavior

On entering the step:

1. Takes all transactions from mapped statements (from Step 2)
2. Runs `cleanDescription()` on each
3. Groups by cleaned description
4. Matches against existing destinatario rules (via `prepareDestinatarioRules()`)
5. Splits into: **already matched** (collapsed summary) and **unmatched suggestions** (interactive)

#### UI Layout

**Already matched section** (top, collapsed by default):
"23 transacciones ya tienen destinatario asignado" — expandable to see the list grouped by destinatario name.

**Suggestions section** (main area):
Each suggestion is a card showing:
- Cleaned pattern as title (e.g. "MERCADO PAGO")
- "12 transacciones" count badge
- Expandable transaction checklist — each row shows date, raw description, amount. All checked by default. User can uncheck to exclude specific transactions from the match.
- Name input — pre-filled with cleaned pattern, editable to a readable name
- Category dropdown — optional, sets `default_category_id`
- "Crear destinatario" button — creates destinatario + rule, re-runs matching on remaining transactions

**Real-time feedback:** After clicking "Crear destinatario", the created suggestion disappears from the suggestions list, its transactions move to the "already matched" count, and remaining unmatched transactions are re-evaluated against the new rules. This happens client-side by re-running `matchDestinatario()` with updated rules.

**Skip option:** "Omitir" button to proceed to Confirm without creating any destinatarios. This step is never blocking.

#### Data Flow to Confirm Step

When proceeding to Confirm:
- Transactions carry their `destinatario_id` and `default_category_id` from matching
- The existing `DestinatarioSuggestions` component in step-confirm.tsx is **removed entirely** — recipient matching is no longer the Confirm step's responsibility
- step-confirm.tsx still receives `destinatarioRules` (for category pre-fill from matched destinatarios) but does NOT run suggestion detection

### Sub-Feature 2C: `/destinatarios` Page — Sugerencias Tab

#### Tab Layout

The existing destinatarios page gets two tabs (using the existing shadcn Tabs component):
- **"Mis destinatarios"** (default) — current list with search, sort, merge
- **"Sugerencias"** — background-detected patterns from transaction history

#### Backend

New server action `getDestinatarioSuggestions()` in `actions/destinatarios.ts`:
- Queries transactions where `destinatario_id IS NULL` and `raw_description IS NOT NULL`
- Applies `cleanDescription()` on each (in JS, not SQL — the noise token list is in the shared package)
- Groups by cleaned output
- Returns groups with 3+ occurrences, sorted by count desc
- Each group includes: `cleanedPattern`, `count`, `dateRange: { from, to }`, `sampleTransactions: { date, rawDescription, amount }[]` (up to 5)
- Limit: top 20 suggestions

Pure read query — no scheduler, runs when user visits the tab.

#### Suggestion Cards

Each card shows:
- Cleaned pattern as title
- Transaction count + date range ("8 transacciones, oct 2025 — mar 2026")
- Expandable preview — last 5 transactions (date, raw description, amount)
- "Crear destinatario" button — inline form (name pre-filled, optional category)
- "Ignorar" dismiss button — hides suggestion (stored in localStorage with 7-day snooze, same pattern as dashboard alert dismissal)

#### Empty State

"No encontramos patrones nuevos. Las sugerencias aparecen cuando tienes transacciones recurrentes sin destinatario asignado."

#### What This Doesn't Do

- No curation (add/remove transactions) — that's only in the import step where accuracy matters most
- No pagination — capped at 20 suggestions

---

## File Impact Summary

### Multi-Currency

| File | Change |
|------|--------|
| `actions/charts.ts` | Add `currency` param to 5 aggregation functions, filter queries |
| `actions/debt.ts` | Add `currency` param to `getDebtOverview()`, replace hardcoded COP |
| `actions/profile.ts` | Add `updatePreferredCurrency()` server action with Zod validation |
| `lib/utils/debt-simulator.ts` | Add `currency` param to `allocateLumpSum()`, filter by it |
| `app/(dashboard)/dashboard/page.tsx` | Fetch `preferred_currency` from profile, pass to all aggregation calls |
| `app/(dashboard)/deudas/page.tsx` | Fetch `preferred_currency`, pass to debt queries |
| `app/(dashboard)/deudas/simulador/page.tsx` | Fetch `preferred_currency`, pass to simulator |
| `components/dashboard/dashboard-hero.tsx` | Show "En COP" label + secondary currency note |
| `components/dashboard/accounts-overview.tsx` | Group accounts by currency within deposit/debt sections |
| `app/(dashboard)/settings/page.tsx` | Add "Moneda preferida" dropdown |

### Recipient Management

| File | Change |
|------|--------|
| `packages/shared/src/utils/destinatario-matcher.ts` | Add exported `cleanDescription()`, rewrite `detectDestinatarioSuggestions()` |
| `components/import/step-destinatarios.tsx` | **New** — Step 2.5 component |
| `components/import/step-confirm.tsx` | Remove `DestinatarioSuggestions` integration, remove suggestion detection logic |
| `components/import/destinatario-suggestions.tsx` | **Delete** — replaced by step-destinatarios |
| `app/(dashboard)/import/page.tsx` | Update wizard from 4 to 5 steps |
| `actions/destinatarios.ts` | Add `getDestinatarioSuggestions()` server action |
| `app/(dashboard)/destinatarios/page.tsx` | Add tabs layout + sugerencias tab |
| `components/destinatarios/destinatario-suggestions-tab.tsx` | **New** — background suggestions UI |

---

## Dependencies Between Features

None. Multi-currency and recipient management are fully independent. They can be built and shipped in either order or in parallel.

## Recommended Build Order

1. **Multi-currency** first — smaller scope, fixes existing bugs (wrong totals)
2. **Recipient management** second — larger scope, enhances existing feature
