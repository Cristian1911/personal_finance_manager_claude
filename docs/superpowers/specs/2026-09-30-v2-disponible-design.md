# v2 Disponible — pure functions (2026-09-30)

**Scope (owner: "continue with computeDisponible"):** the M1 math only, as pure functions in `@zeta/shared` with tests. No tables, no settings screens, no Inicio UI (later M1 PRs). Rules: `docs/mlp/10-build-plan.md` §4, decisions S3-0…S3-8, D5, D8 in `docs/mlp/12-decision-log.md`, worked examples in `docs/mlp/sessions/03-disponible.html`.

**Principle:** no database, no clock. Everything (today, holidays, movements, bills) comes in as input, so the phone and the server get the same answer.

## 1. Pieces (`packages/shared/src/engine/disponible/`)

| File | Function | Job |
|---|---|---|
| `dates.ts` | `addDays`, `diffDays`, … | ISO `YYYY-MM-DD` arithmetic in UTC (no local-time drift). |
| `cycle.ts` | `computePayCycle` | The cycle containing `today`: semimonthly (15/30), monthly, biweekly or irregular (calendar month). A payday on a weekend or holiday moves to the business day before; a day past month end clamps to the last day. The cycle starts when the salary actually arrived (up to 5 days early). Otherwise it starts on the expected date with `startsOnExpectedDate` (the UI's "~"); a salary up to 5 days late clears the "~" without moving the start. |
| `disponible.ts` | `computeDisponible` | `Disponible = Llega − Por pagar − Ahorro − Ya salió ± ajustes`; `perDay = ⌊Disponible ÷ días que faltan (incluye hoy)⌋₁₀₀` (0 when negative); the starting Disponible and per-day, used by the verdict. Returns every line (Spanish labels) and why the number is approximate. |
| `verdict.ts` | `computeVerdict`, `verdictMessage`, `findBillAtRisk` | Vas bien / Cuidado / Te pasaste with the no-flicker rule; Spanish messages; the bill-at-risk check (due within 3 days, or overdue). |
| `card-bill.ts` | `estimateCardMinimum`, `projectCardBillAtCut` | S3-6 minimum before the PDF; S3-2 big purchases in full; S3-5 look-ahead at the cut date. |
| `movements.ts` | `toDisponibleMovements`, `occurrencesToCycleInputs` | Stored rows → the inputs below. Excluded, merged-duplicate and cancelled rows drop out. A movement linked to an occurrence is salary or a bill payment. Personal debts: lent → spend, repaid to you → Te pagaron, you pay back → settles that Tú debes, borrowed → money in (the debt's direction is derived from role + flow when not joined). Transfer legs learn their counterpart. The rest goes by `flow_class`, never category. Foreign currency uses the COP amount and is "≈" until the PDF. Occurrences: income → expected income, bill → obligation, skipped gone. A paid occurrence whose movement isn't passed (or was excluded) counts as paid / received, a link to a merged duplicate follows to the survivor, and one movement paying several bills settles all of them. |

## 2. Input contract of `computeDisponible`

- `cycle`, `today`, `accounts: { id, countsInDisponible, isDebt? }`.
- A debt account never counts, whatever its setting says.
- `movements`: already classified by the caller: `spend | payment | income | salary | repayment | refund | transfer | ignored`, with `obligationId` for payments, `expectedIncomeId` for salary, `counterpartAccountId` for transfers, and `approx` for foreign-currency estimates.
  - Movements on accounts that don't count are ignored, so card purchases never touch Disponible (S3-0).
  - A transfer to a debt account is a payment. A plain transfer (no `obligationId`) pays that account's open bills in due order; the rest is an extra payment. A debt payment whose card/loan isn't known pays the earliest open card or loan bills first, so it's never subtracted twice.
  - A salary paid into an account that doesn't count confirms its expected income without adding money; the transfer that brings it in does. An expected income marked `received` (paid outside the window) counts without a "~".
  - A transfer from a debt account is an advance ("Avance de tarjeta o crédito").
  - A transfer to an account we don't know is money out (Ya salió), never Ahorro.
  - An ATM withdrawal is `spend` (S3-1); logging that cash later is `ignored`. Trip purchases (v1.1) are also `ignored`.
- `expectedIncomes`: an expected salary counts until it arrives, then the real amount replaces it.
- `obligations`: bills, card bills (at minimum), loan cuotas and Tú debes (D8), each with `dueDate`, `amount`, `paidBefore` and `estimated` (≈). Por pagar = what's still unpaid of those due by the cycle end. Payments move money Por pagar → Ya salió. Paying more than the remaining amount is an extra payment and lowers Disponible now. Partial payments show "pagado X de Y" (D5). A bill is paid once its payments reach 95% of the amount (D5 ±5%). An estimated (≈) bill closes with any payment, because the real amount replaces the estimate.
- `savingsTarget` + `reservations` (S3-7) make up Ahorro. A transfer out of the counted set fills Ahorro first, and only the excess goes to Ya salió (no double subtraction).
- `carryOver` (Te pasaste / Te sobró el ciclo pasado, S3-3), `balanceAdjustments` ("Cuadrar con mi saldo").
- `anchor` (first cycle: the balance told today; movements before it are inside that balance, so a salary seen before it drops its expected income and a bill paid before it counts as paid; a same-day movement needs `at` to be placed after it), `irregular` + `openingBalance` (only received money counts; the part of the expected income not received yet comes back apart as `expectedApart`).
- `staleSources`: a quiet source makes the number approximate.

**Starting Disponible** = Llega − (each obligation's amount − `paidBefore`) − Ahorro ± ajustes, i.e. the cycle before any spending, with today's knowledge. Laura: $521.100 ÷ 15 = $34.700/day.

## 3. Verdict (S3-4, S3-5)

- **Te pasaste** when Disponible < 0.
- **Cuidado** when nothing is left per day ("No te queda para gastar hasta el 30"), when per-day < 85% of the starting per-day, when a bill is at risk within 3 days, or when the next cycle would be short.
- **Vas bien** otherwise.
- **No flicker:** the shown state worsens immediately but only improves after the better state has held for 24 h; the clock restarts whenever the better state changes. The caller stores the returned `memo` and passes it back.

## 4. Tests

One test per §4 row and per movement row of session 3, plus the worked examples:
- Laura: $421.100 / $35.000 per day, Vas bien.
- Cuidado at $250.000 spent: $271.100 / $22.500 per day.
- Card minimum: $640.000 of $1.850.000.
- "Te pasaste por $85.000".

## 5. Out of scope

`user_cycle_settings`, `account_settings`, `bill_reservations` tables; the classifier that turns stored transactions into `movements`; cycle summaries (S1-3); Inicio widgets.
