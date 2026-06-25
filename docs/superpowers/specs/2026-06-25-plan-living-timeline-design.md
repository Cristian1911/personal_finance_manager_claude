# Plan "Periodo" → Living Timeline — design spec

**Date:** 2026-06-25 · **Status:** approved (brainstorm) · **Scope:** webapp (desktop + mobile-web). Native RN app out of scope — parity audited later.

Mockups: `.superpowers/brainstorm/88968-1782420809/content/`. Design brief for Claude Design: `claude-ai-design/plan-living-timeline-brief.md`.

---

## 1. Problem

The "Periodo" plan (envelope budgeting — income envelopes left, expenses right, expense→income assignments) is a **static day-1 snapshot**. It shows the whole month flat; past and future carry equal weight. By the 25th the paychecks have landed and most expenses are paid, yet the board still presents stale envelopes to "allocate". The user can't trust it to answer **"where am I right now, and what's left?"**

Verification also surfaced a **data bug** that is the concrete face of the complaint:

- `upsertBalanceEnvelopes()` (`webapp/src/actions/cashflow-planner.ts:496-608`) overwrites the `Saldo · <cuenta>` income envelope's `amount` with the account's **live** `current_balance` on **every load** — no freeze.
- Each paycheck is **also** a separate income entry.
- `hydratePeriodData()` (`:209-212`) sums **all** income entries into `total_income`.
- ⇒ when a paycheck lands, `current_balance` rises → the Saldo envelope grows → **and** the paycheck entry still counts → **double count**. ("Today I received the last payment, that should now be the saldo one.")

There is also **no income-confirm path that creates an INFLOW**: `payPlanningEntry()` (`:1167-1419`) always inserts `direction: "OUTFLOW"` and decrements the source balance — it is built for expenses.

## 2. Goal / core value

Make the plan a **living timeline that advances daily**. Settled reality folds into a live balance; only what's actionable stays surfaced. Every glance answers **"Am I on track?"** — one trustworthy number, backed by a time-aware view of commitments.

## 3. Concepts & definitions

| Concept | Definition |
|---|---|
| **Opening balance** (`Saldo inicial`) | The spendable accounts' real balance **at period start**, **frozen**. Counted once as the period's starting funds. No longer overwritten on load. |
| **Saldo actual** | The spendable accounts' **live** real balance, read **directly from `accounts.current_balance`** (NOT a sum of envelopes). Hero bridge line. |
| **Income state** | Derived per income envelope: `esperado` (expected_date ≥ today, not confirmed) · `confirmado` (a real INFLOW transaction is linked — via import auto-match or manual confirm) · `atrasado` (expected_date < today, still unconfirmed). |
| **Confirmar recibido** | The action that makes Saldo real. Two paths: **auto** (recognized bank import links the transaction → occurrence `paid` → confirmed), **manual** (always opens a **confirmation sheet** — confirm/adjust amount + account, or link an already-imported movement → creates/links an INFLOW transaction, updates balance, marks the envelope confirmed). |
| **Assignments** | Persist after income lands. Each envelope shows committed-vs-free. |
| **Comprometido** | Unpaid assigned expense amounts. **Time-aware split** (§4). |
| **Puedo gastar** | `Saldo actual − Comprometido(cuenta ahora)`. The only headline number the user spends against. May go negative (over-committed → shown in red). |

## 4. Comprometido — the time-aware rule (novel logic)

A commitment reduces **Puedo gastar now** only if it must come out of money already in hand. For each **unpaid** expense, classify its committed amount:

```
nextIncomeDate = expected_date of the earliest still-`esperado` income after today
                 (null if none remain → then everything pending is "cuenta ahora")

cuenta ahora  ⟸  any of:
  - the amount is assigned to the current balance / Saldo, OR
  - the amount is assigned to an income that is already `confirmado` (money is in the account), OR
  - the amount is assigned to an income that is `atrasado` (its funding paycheck didn't arrive on time), OR
  - the expense's due date (expected_date) < nextIncomeDate   ← timing override, regardless of assignment

cubierto       ⟸  assigned to an `esperado` income that lands on/before the expense's due date and is not `atrasado`

(unassigned remainder: classify by the timing override — due before nextIncomeDate ⇒ cuenta ahora; else surfaced as "sin asignar", not subtracted)
```

- **Puedo gastar** = `Saldo actual − Σ(cuenta ahora)`
- **Comprometido (display)** = total unpaid assigned, shown split: `cuenta ahora` (amber) + `cubierto por próximo ingreso` (green).
- The red/overflow state appears only when `Σ(cuenta ahora) > Saldo actual`.

> Confirmed edge: a commitment assigned to an income that has since become `atrasado` flips to **cuenta ahora** — the money it was waiting on didn't arrive.

## 5. UX / Layout

**Toggle hero** (segmented control `Puedo gastar | Comprometido`):
- Big number swaps on tap; the inactive number's bar segment dims; both remain visible via a secondary line + the split bar.
- On `Comprometido`, the number breaks into `cuenta ahora` + `cubierto por próximo ingreso`.
- Bridge line: `Saldo actual · cuentas reales`.
- Split bar: libre (brass `#d9b681`) vs comprometido-cuenta-ahora (amber `#e0976a`).

**HOY divider** splits the period (`Hoy · 25 jun · quedan N días`).

**Collapse the settled, both sides:**
- Income: `✓ N confirmados · $X recibidos [mostrar ▾]` — collapsed by default.
- Expenses: `✓ N pagados · $Y [mostrar ▾]` — collapsed by default.
- Only actionable items stay expanded: income to confirm (`esperado` / `atrasado`), expenses pending (with assignment chips + Pagar/Asignar).

**Income envelope card** — state-colored left border (`confirmado` green / `esperado` neutral / `atrasado` red), amount, state chip, and (when confirmed/expanded) committed-vs-free. `Confirmar recibido` button on `esperado`; `¿Llegó? Confirmar` on `atrasado`.

**Expense row** — `pendiente` / `pagado`; assignment chips showing which income(s) fund it and coverage; per-row `cuenta ahora` / `cubierto` tag; Pagar / Asignar actions.

**Confirmation sheet (manual confirm)** — amount (prefilled = expected, editable), target account, optional "link an already-imported movement", confirm. Deliberate gate (accuracy over speed).

**Breakpoints:**
- **Desktop (~960px):** full-width hero → HOY divider → two columns (Ingresos | Gastos), each collapsing its settled items.
- **Mobile-web (~380px):** hero → HOY divider → `Ingresos / Gastos` tabs (single column), same collapse behavior. Respect bottom tab-bar clearance.

## 6. Backend / data-model changes

All within existing tables (`planning_periods`, `planning_entries`, `planning_assignments`). **No schema migration required** — the changes are in derivation + a new action path. (Confirm during planning whether an explicit `opening_balance` marker beats the existing `notes = "[saldo]"` sentinel.)

1. **Freeze the opening-balance envelope.** `upsertBalanceEnvelopes()` must set the `Saldo` envelope's `amount` **once** (at period creation / first seed) and **stop overwriting it** on subsequent loads. It represents opening funds, not live balance.
2. **Saldo actual reads live from `accounts`.** New cached read summing `current_balance` over the user's spendable (non-debt) accounts in the period currency. This is the hero's bridge number — independent of the envelopes.
3. **Fix `total_income` double-count.** With the opening frozen and counted once, paychecks counted once each, the sum is correct. Verify the Saldo envelope is included exactly once (as opening) and not re-grown.
4. **New income-confirm action** (`confirmIncomeReceived` or an INCOME branch in `payPlanningEntry`): create **or** link a real **INFLOW** transaction to the target account, apply `applyAccountBalanceDelta` (INFLOW), link to the recurring occurrence when the entry has `recurring_template_id` (reuse `linkExistingTransactionToOccurrence`), and mark the entry `COMPLETED`. Mirror the side-effect chain webapp server actions already run (idempotency, occurrence linking). The auto path (import → occurrence `paid`) already flips the entry to confirmed — no change needed there.
5. **State derivation** (`esperado` / `confirmado` / `atrasado`) computed in `hydratePeriodData()` from `status` + `expected_date` + occurrence status + today.
6. **Comprometido classification** (§4) computed in `hydratePeriodData()` (or a shared helper, so the hero and the per-row tags agree). Returns per-expense `{ cuentaAhora, cubierto }` and period totals `{ puedoGastar, comprometidoAhora, comprometidoCubierto }`.
7. **Cache + invalidation.** New reads use `"use cache"` + `cacheTag()` + `cacheLife("zeta")` via `createCachedClient(accessToken)`. Confirm/pay/assign mutations call `updateTag(...)` (not `revalidateTag`) for read-your-writes, plus `revalidateFinancialViews()` so dashboard/balances reflect the new transaction.

## 7. Affected surfaces (starting map — confirm in plan)

- `webapp/src/actions/cashflow-planner.ts` — freeze opening, live saldo read, income-confirm action, state + comprometido derivation, totals.
- `webapp/src/types/cashflow-planner.ts` / `domain.ts` — extend `PeriodPlanData` with state + comprometido split + saldo actual.
- `webapp/src/components/cashflow-planner/` — `envelope-board.tsx` (hero, HOY divider, collapse, desktop 2-col), `income-envelope-card.tsx` (states + confirm), `expense-entry-row.tsx` (cuenta-ahora/cubierto tags), new confirm sheet.
- `webapp/src/components/plan/tabs/plan-tab-periodo.tsx` and `webapp/src/components/mobile/v2/plan/*` — mobile-web hero + tabs + collapse.
- Shared classifier helper (web-only for now; consider `@zeta/shared` if the RN parity pass will reuse it).

## 8. Edge cases

- No upcoming income left in period → `nextIncomeDate` null → all pending = `cuenta ahora`.
- Income `atrasado` → its funded commitments flip to `cuenta ahora`.
- Unassigned pending amount → timing-override only; surfaced as "sin asignar".
- Multi-currency: comprometido + saldo computed in the period currency using existing exchange-rate conversion in `hydratePeriodData`.
- Manual confirm for a **non-recurring** income (no template) → just creates the INFLOW + marks confirmed, no occurrence link.
- Re-opening a past/closed period → opening stays frozen; states derive against that period's window, not today.

## 9. Out of scope

- Native React Native app (`mobile/`) — parity audited later.
- Reworking the old `Ingresos / Gastos / Superávit` summary cards beyond folding the primary answer into the new hero (decide placement in plan; not a blocker).
- Auto-categorization / AI — none.

## 10. Testing

- **Unit (Vitest):** the comprometido classifier — table of cases covering each `cuenta ahora` trigger (current-balance assignment, confirmado assignment, atrasado assignment, due-before-next-income), `cubierto`, unassigned, no-upcoming-income, and the overflow (negative Puedo gastar) case. This is money logic → it gets a real test.
- **Derivation:** income state (`esperado`/`confirmado`/`atrasado`) from status + date + occurrence.
- **Manual:** double-count fix — land a paycheck, confirm it, assert `total_income` and Saldo actual don't double; confirm-income creates an INFLOW and raises `current_balance`; collapse/expand both sides; desktop + mobile-web reflow.
- **Gates:** `pnpm build`; `server-action-reviewer` on the new/changed actions; `zetas-front-guy` on the UI; `perf-auditor` on the new reads.
