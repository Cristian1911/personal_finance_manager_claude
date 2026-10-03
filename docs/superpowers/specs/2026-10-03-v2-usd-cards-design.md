# Zeta v2: credit cards with a USD section (design, 2026-10-03)

**Owner decision (2026-10-03):** the first version of multi-currency covers **cards with a USD balance**.
- The USD section of a statement goes to the **same card**, as Bancolombia PDFs carry it.
- Its debt is kept **in dollars**.
- In Pagos and Disponible it counts **in pesos at the day's rate + 3 %** (`10-build-plan.md` §4; F11/D7 in `11-use-cases.md`).

Accounts held in another currency come later.

## What exists already

**Server: no migration needed**
- `accounts.currency_balances JSONB` holds `{ "USD": { current_balance, credit_limit, minimum_payment, total_payment_due, interest_rate } }`. v1 uses it the same way, and it is not encrypted.
- `transactions.amount_in_base_currency` and `exchange_rate`.
- `statement_snapshots` is unique per (account, currency, period).
- `exchange_rate_cache` (`USD_COP`) is refreshed hourly on weekdays and readable by anyone.

**Engine**
- `toDisponibleMovements` already uses `amountInBaseCurrency` for foreign rows and marks them "≈", with the reason `foreign_currency`.
- `recordStatement` already takes a currency.

## Changes

### 1. Phone schema and sync (additive)
- `accounts.currency_balances TEXT` (JSON) and `transactions.amount_in_base_currency REAL` on the phone.
- Both are added to the sync column lists.
- Contract tests on both adapters.

### 2. Rate on the phone
- The `/api/v2/snapshot` pull also returns `rates: { USD_COP: { rate, at } }` from `exchange_rate_cache`.
- The phone keeps the last one in a small `fx_rates` table (phone-only, replaced on every pull).
- Offline, the phone uses the last rate it has. The figure carries "≈", like everything foreign.

### 3. Import
- **`planStatements`:** a USD section whose last 4 matches a COP section in the same PDF, or an existing card, goes to that card. Its review shows "Debes USD 1.234 · ≈ $5.100.000".
- **`statementCommands` for a USD section:**
  - Rows go through `captureBankTransaction` with `currencyCode: "USD"` and `amountInBaseCurrency` = USD × rate × 1.03. The currency is part of the row id.
  - `editAccount` is skipped (the card's cut and limit come from the COP section).
  - `recordStatement` runs with `currencyCode: "USD"`.
  - `anchorStatementBalance` runs with `currencyCode: "USD"`. It sets `currency_balances.USD.current_balance` at the cut, plus the USD rows after the cut.
- **`captureBankTransaction`:** a row whose currency differs from the account's moves `currency_balances[currency]`, not `current_balance`.

### 4. Reads
- `inicio-read` / `extractos` read snapshots in every currency, and the accounts read includes `currency_balances`.
- **Card bill** (Pagos, Disponible's Por pagar):
  - It is the COP minimum + the USD minimum × rate × 1.03, shown as "≈ $X · incluye USD 45".
  - Before the statement, the estimate uses each USD row's `amountInBaseCurrency`.
  - It is exact in USD once the PDF is in. The pesos stay "≈" until the payment.
- **Mis cuentas / Cuenta:**
  - The card shows "Debes $3.750.000 · USD 1.234".
  - Extractos are listed per currency.
  - The USD rate in use is shown ("Dólar hoy $3.950").
- **Payment matching:** a COP payment to the card covers the COP bill first. The rest goes to the USD part, at the day's rate.

### 5. Tests
- Engine: USD rows don't move the COP balance; the USD anchor; the bill with a USD minimum; ids differ per currency; the rate fallback when offline.
- Contract tests on sql.js and PGlite for the changed commands.
- The web preview and the simulator with the owner's Bancolombia PDF (COP + USD).

## Out of scope (next)
- Accounts in another currency.
- A default currency in Ajustes (S10-12).
- The "cuándo conviene pagar la deuda en dólares" metric (S10-8, Debo phase). It builds on this work.
