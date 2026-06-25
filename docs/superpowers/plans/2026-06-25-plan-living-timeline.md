# Plan "Periodo" Living Timeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static "Periodo" plan into a living timeline that advances daily — a live Saldo actual, income states (esperado/confirmado/atrasado), a confirm-received flow that records a real INFLOW, and a time-aware Comprometido that drives one trustworthy "Puedo gastar".

**Architecture:** Two pure, fully-unit-tested helpers (income-state + commitment classifier) hold all the new money logic. `hydratePeriodData()` (the sole builder of `PeriodPlanData`) calls them and exposes new fields; every UI surface (desktop `EnvelopeBoard`, mobile `MobilePeriodoView`, the new `PeriodHero`) reads those fields. A new `confirmIncomeReceived` action adds the missing INFLOW path. The opening-balance envelope is frozen to kill the double-count.

**Tech Stack:** Next.js 15 (App Router, Server Actions), TypeScript strict, Tailwind v4, shadcn/ui, Supabase, Vitest. Spec: `docs/superpowers/specs/2026-06-25-plan-living-timeline-design.md`.

## Global Constraints

- **Spanish-first UI** — every user-facing string in Spanish.
- **Tokens only** — `text-z-income`, `text-z-expense`, `text-z-brass`, `text-z-ink`, `border-white/6`, `bg-card`; envelope palette via `getEnvelopeColor(index)` from `@/lib/constants/envelope-colors`. No hardcoded hex except the existing per-envelope `c.hex` pattern. Comprometido amber uses existing `text-amber-400`.
- **Currency** — always `formatCurrency(amount, code)` from `@/lib/utils/currency`. Numbers `tabular-nums`.
- **Dates** — compare period/entry dates as `YYYY-MM-DD` **strings** (lexicographic). NEVER `new Date("YYYY-MM-DD")` (UTC-midnight bug). Display via `formatDate()` from `@/lib/utils/date`.
- **Cache** — mutations call `updateTag("cashflow-planner")` (NOT `revalidateTag`); money-moving mutations also `updateTag("occurrences")` + `revalidateFinancialViews()`. Pattern copied from existing `payPlanningEntry`.
- **Auth/DB** — `getAuthenticatedClient()`; defense-in-depth `.eq("user_id", user.id)` on every query.
- **Scope** — webapp only (desktop + mobile-web). Native RN app out of scope.
- **Review gates per touched surface** — `server-action-reviewer` (new/changed actions), `zetas-front-guy` (TSX/CSS), `perf-auditor` (new render-path reads). `pnpm build` must pass.

---

## File Structure

**New:**
- `webapp/src/lib/utils/plan-commitments.ts` — pure helpers: `deriveIncomeState`, `classifyCommitments`, all types. No imports from app/DB.
- `webapp/src/lib/utils/plan-commitments.test.ts` — Vitest unit tests (the money-logic gate).
- `webapp/src/components/cashflow-planner/period-hero.tsx` — the toggle hero (Puedo gastar / Comprometido).
- `webapp/src/components/cashflow-planner/confirm-income-dialog.tsx` — the income confirmation sheet.
- `webapp/src/components/cashflow-planner/settled-group.tsx` — the collapsible "✓ N confirmados / pagados" bar (shared income+expense).

**Modify:**
- `webapp/src/types/cashflow-planner.ts` — extend `PeriodPlanData` + `IncomeEnvelope`; add per-expense commitment field.
- `webapp/src/actions/cashflow-planner.ts` — `hydratePeriodData` (wire helpers + accounts read), `upsertBalanceEnvelopes` (freeze), new `confirmIncomeReceived`.
- `webapp/src/components/cashflow-planner/income-envelope-card.tsx` — state border/chip + Confirmar button.
- `webapp/src/components/cashflow-planner/expense-entry-row.tsx` — cuenta-ahora/cubierto tag.
- `webapp/src/components/cashflow-planner/envelope-board.tsx` — mount hero, HOY divider, collapse settled, desktop Pagar.
- `webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx` — hero, HOY divider, Ingresos/Gastos tabs, collapse settled.
- `webapp/src/components/plan/tabs/plan-tab-periodo.tsx` — hero mount point (replace the `<h2>Planear tu dinero</h2>` block context as needed).

---

## Task 1: Income state derivation (pure helper)

**Files:**
- Create: `webapp/src/lib/utils/plan-commitments.ts`
- Test: `webapp/src/lib/utils/plan-commitments.test.ts`

**Interfaces:**
- Produces: `type IncomeState = "esperado" | "confirmado" | "atrasado" | "omitido"`; `function deriveIncomeState(status: PlanningEntryStatus, expectedDate: string, todayISO: string): IncomeState`.

- [ ] **Step 1: Write the failing test**

```ts
// webapp/src/lib/utils/plan-commitments.test.ts
import { describe, it, expect } from "vitest";
import { deriveIncomeState } from "./plan-commitments";

describe("deriveIncomeState", () => {
  const today = "2026-06-25";
  it("COMPLETED → confirmado", () => {
    expect(deriveIncomeState("COMPLETED", "2026-06-23", today)).toBe("confirmado");
  });
  it("SKIPPED → omitido", () => {
    expect(deriveIncomeState("SKIPPED", "2026-06-10", today)).toBe("omitido");
  });
  it("PLANNED with future date → esperado", () => {
    expect(deriveIncomeState("PLANNED", "2026-06-26", today)).toBe("esperado");
  });
  it("PLANNED with today's date → esperado", () => {
    expect(deriveIncomeState("PLANNED", "2026-06-25", today)).toBe("esperado");
  });
  it("PLANNED with past date → atrasado", () => {
    expect(deriveIncomeState("PLANNED", "2026-06-20", today)).toBe("atrasado");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd webapp && pnpm vitest run src/lib/utils/plan-commitments.test.ts`
Expected: FAIL — `deriveIncomeState is not a function` / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// webapp/src/lib/utils/plan-commitments.ts
import type { PlanningEntryStatus } from "@/types/domain";

export type IncomeState = "esperado" | "confirmado" | "atrasado" | "omitido";

/** Date args are YYYY-MM-DD; compared as strings (no Date/timezone). */
export function deriveIncomeState(
  status: PlanningEntryStatus,
  expectedDate: string,
  todayISO: string,
): IncomeState {
  if (status === "COMPLETED") return "confirmado";
  if (status === "SKIPPED") return "omitido";
  return expectedDate < todayISO ? "atrasado" : "esperado";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd webapp && pnpm vitest run src/lib/utils/plan-commitments.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/utils/plan-commitments.ts webapp/src/lib/utils/plan-commitments.test.ts
git commit -m "feat(plan): deriveIncomeState helper (esperado/confirmado/atrasado/omitido)"
```

---

## Task 2: Time-aware Comprometido classifier (pure helper — the money gate)

**Files:**
- Modify: `webapp/src/lib/utils/plan-commitments.ts`
- Test: `webapp/src/lib/utils/plan-commitments.test.ts`

**Interfaces:**
- Consumes: `IncomeState` (Task 1).
- Produces:
```ts
export interface CommitmentIncomeRef {
  entryId: string;
  state: IncomeState;          // opening-balance seeds are passed as "confirmado"
  expectedDate: string;        // YYYY-MM-DD
  isOpeningBalance: boolean;
}
export interface CommitmentExpenseInput {
  entryId: string;
  dueDate: string;             // expected_date, YYYY-MM-DD
  unpaidAmount: number;        // converted_amount when status !== COMPLETED, else 0
  assignments: { incomeEntryId: string; amount: number }[];
}
export interface ExpenseCommitment {
  cuentaAhora: number;
  cubierto: number;
  sinAsignar: number;
}
export interface CommitmentSummary {
  saldoActual: number;
  comprometidoAhora: number;
  comprometidoCubierto: number;
  puedoGastar: number;         // saldoActual - comprometidoAhora
  nextIncomeDate: string | null;
  perExpense: Record<string, ExpenseCommitment>;
}
export function classifyCommitments(
  expenses: CommitmentExpenseInput[],
  incomeRefs: CommitmentIncomeRef[],
  saldoActual: number,
  todayISO: string,
): CommitmentSummary;
```

The rule (from spec §4): a committed amount is **cuenta ahora** if it is funded from the current balance (opening seed or a `confirmado` income), or from an `atrasado` income (its money never arrived), or it is due before the funder lands; otherwise it is **cubierto**. An unassigned remainder is **cuenta ahora** if due before the next expected income, else **sin asignar** (not subtracted). `nextIncomeDate` = earliest `expectedDate` among `esperado` incomes on/after today.

- [ ] **Step 1: Write the failing tests**

```ts
// append to webapp/src/lib/utils/plan-commitments.test.ts
import { classifyCommitments, type CommitmentIncomeRef } from "./plan-commitments";

describe("classifyCommitments", () => {
  const today = "2026-06-25";
  const opening: CommitmentIncomeRef = { entryId: "saldo", state: "confirmado", expectedDate: "2026-06-01", isOpeningBalance: true };
  const nomina26: CommitmentIncomeRef = { entryId: "n26", state: "esperado", expectedDate: "2026-06-26", isOpeningBalance: false };
  const nominaLate: CommitmentIncomeRef = { entryId: "nlate", state: "atrasado", expectedDate: "2026-06-20", isOpeningBalance: false };

  it("nextIncomeDate is the earliest esperado on/after today", () => {
    const r = classifyCommitments([], [opening, nomina26, nominaLate], 0, today);
    expect(r.nextIncomeDate).toBe("2026-06-26");
  });

  it("assigned to opening/current balance → cuenta ahora", () => {
    const r = classifyCommitments(
      [{ entryId: "rent", dueDate: "2026-06-25", unpaidAmount: 300000, assignments: [{ incomeEntryId: "saldo", amount: 300000 }] }],
      [opening, nomina26], 399554, today);
    expect(r.perExpense.rent.cuentaAhora).toBe(300000);
    expect(r.comprometidoAhora).toBe(300000);
    expect(r.puedoGastar).toBe(99554);
  });

  it("assigned to a future income, due after it lands → cubierto", () => {
    const r = classifyCommitments(
      [{ entryId: "exito", dueDate: "2026-06-28", unpaidAmount: 355891, assignments: [{ incomeEntryId: "n26", amount: 355891 }] }],
      [opening, nomina26], 399554, today);
    expect(r.perExpense.exito.cubierto).toBe(355891);
    expect(r.comprometidoCubierto).toBe(355891);
    expect(r.comprometidoAhora).toBe(0);
    expect(r.puedoGastar).toBe(399554);
  });

  it("assigned to a future income but due BEFORE it lands → cuenta ahora", () => {
    const r = classifyCommitments(
      [{ entryId: "early", dueDate: "2026-06-25", unpaidAmount: 100000, assignments: [{ incomeEntryId: "n26", amount: 100000 }] }],
      [opening, nomina26], 399554, today);
    expect(r.perExpense.early.cuentaAhora).toBe(100000);
  });

  it("assigned to an ATRASADO income → cuenta ahora (funding didn't arrive)", () => {
    const r = classifyCommitments(
      [{ entryId: "x", dueDate: "2026-06-30", unpaidAmount: 50000, assignments: [{ incomeEntryId: "nlate", amount: 50000 }] }],
      [opening, nominaLate], 399554, today);
    expect(r.perExpense.x.cuentaAhora).toBe(50000);
  });

  it("unassigned remainder due before next income → cuenta ahora; due after → sin asignar", () => {
    const r = classifyCommitments(
      [
        { entryId: "soon", dueDate: "2026-06-25", unpaidAmount: 40000, assignments: [] },
        { entryId: "later", dueDate: "2026-06-29", unpaidAmount: 80000, assignments: [] },
      ],
      [opening, nomina26], 399554, today);
    expect(r.perExpense.soon.cuentaAhora).toBe(40000);
    expect(r.perExpense.later.sinAsignar).toBe(80000);
    expect(r.comprometidoAhora).toBe(40000);
  });

  it("no upcoming income → everything pending is cuenta ahora", () => {
    const r = classifyCommitments(
      [{ entryId: "a", dueDate: "2026-06-30", unpaidAmount: 90000, assignments: [] }],
      [opening], 50000, today);
    expect(r.nextIncomeDate).toBeNull();
    expect(r.perExpense.a.cuentaAhora).toBe(90000);
    expect(r.puedoGastar).toBe(-40000); // over-committed → negative
  });

  it("partial assignment splits across buckets", () => {
    const r = classifyCommitments(
      [{ entryId: "sub", dueDate: "2026-06-30", unpaidAmount: 200000, assignments: [{ incomeEntryId: "n26", amount: 120000 }] }],
      [opening, nomina26], 399554, today);
    expect(r.perExpense.sub.cubierto).toBe(120000);   // assigned to n26, due after
    expect(r.perExpense.sub.sinAsignar).toBe(80000);  // remainder, due after next income
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd webapp && pnpm vitest run src/lib/utils/plan-commitments.test.ts`
Expected: FAIL — `classifyCommitments is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to webapp/src/lib/utils/plan-commitments.ts
export interface CommitmentIncomeRef {
  entryId: string;
  state: IncomeState;
  expectedDate: string;
  isOpeningBalance: boolean;
}
export interface CommitmentExpenseInput {
  entryId: string;
  dueDate: string;
  unpaidAmount: number;
  assignments: { incomeEntryId: string; amount: number }[];
}
export interface ExpenseCommitment { cuentaAhora: number; cubierto: number; sinAsignar: number; }
export interface CommitmentSummary {
  saldoActual: number;
  comprometidoAhora: number;
  comprometidoCubierto: number;
  puedoGastar: number;
  nextIncomeDate: string | null;
  perExpense: Record<string, ExpenseCommitment>;
}

export function classifyCommitments(
  expenses: CommitmentExpenseInput[],
  incomeRefs: CommitmentIncomeRef[],
  saldoActual: number,
  todayISO: string,
): CommitmentSummary {
  const incomeById = new Map(incomeRefs.map((i) => [i.entryId, i]));
  const upcoming = incomeRefs
    .filter((i) => i.state === "esperado" && i.expectedDate >= todayISO)
    .map((i) => i.expectedDate)
    .sort();
  const nextIncomeDate = upcoming.length ? upcoming[0] : null;
  const dueBeforeNext = (due: string) => nextIncomeDate === null || due < nextIncomeDate;

  const perExpense: Record<string, ExpenseCommitment> = {};
  let comprometidoAhora = 0;
  let comprometidoCubierto = 0;

  for (const exp of expenses) {
    let ahora = 0, cubierto = 0, sinAsignar = 0;
    let assignedTotal = 0;

    for (const a of exp.assignments) {
      assignedTotal += a.amount;
      const inc = incomeById.get(a.incomeEntryId);
      if (!inc || inc.isOpeningBalance || inc.state === "confirmado" || inc.state === "atrasado") {
        ahora += a.amount;                       // funded from money in hand, or funder is late/unknown
      } else if (exp.dueDate < inc.expectedDate) {
        ahora += a.amount;                       // due before the funder lands
      } else {
        cubierto += a.amount;                    // funder lands in time
      }
    }

    const remainder = Math.max(0, exp.unpaidAmount - assignedTotal);
    if (remainder > 0) {
      if (dueBeforeNext(exp.dueDate)) ahora += remainder;
      else sinAsignar += remainder;
    }

    perExpense[exp.entryId] = { cuentaAhora: ahora, cubierto, sinAsignar };
    comprometidoAhora += ahora;
    comprometidoCubierto += cubierto;
  }

  return {
    saldoActual,
    comprometidoAhora,
    comprometidoCubierto,
    puedoGastar: saldoActual - comprometidoAhora,
    nextIncomeDate,
    perExpense,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd webapp && pnpm vitest run src/lib/utils/plan-commitments.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/utils/plan-commitments.ts webapp/src/lib/utils/plan-commitments.test.ts
git commit -m "feat(plan): time-aware commitment classifier (cuenta ahora vs cubierto)"
```

---

## Task 3: Extend PeriodPlanData + IncomeEnvelope types

**Files:**
- Modify: `webapp/src/types/cashflow-planner.ts`

**Interfaces:**
- Produces: new optional-free fields the hero + cards read (set by Task 5's hydrate).

- [ ] **Step 1: Add the types**

Add `import type { IncomeState, ExpenseCommitment } from "@/lib/utils/plan-commitments";` at top. Extend `IncomeEnvelope`:

```ts
export interface IncomeEnvelope {
  entry: PlanningEntryWithRelations;
  total_amount: number;
  assigned_amount: number;
  remaining_amount: number;
  assignments: AssignmentDetail[];
  state: IncomeState;            // NEW — opening-balance seeds reported as "confirmado"
  is_opening_balance: boolean;   // NEW — entry.notes === BALANCE_SEED_NOTES
}
```

Extend `PeriodPlanData` (add to the interface body):

```ts
  saldo_actual: number;          // NEW — live spendable accounts balance, in period currency
  puedo_gastar: number;          // NEW — saldo_actual - comprometido_ahora
  comprometido_ahora: number;    // NEW
  comprometido_cubierto: number; // NEW
  next_income_date: string | null; // NEW
  /** keyed by expense entry id */
  commitments: Record<string, ExpenseCommitment>; // NEW
```

- [ ] **Step 2: Verify it compiles in isolation**

Run: `cd webapp && pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | head -30`
Expected: errors ONLY in `cashflow-planner.ts` (hydrate doesn't yet populate the new fields) — confirms the type change is wired. (Task 5 fixes hydrate.)

- [ ] **Step 3: Commit**

```bash
git add webapp/src/types/cashflow-planner.ts
git commit -m "feat(plan): extend PeriodPlanData with saldo/comprometido/commitments fields"
```

---

## Task 4: Freeze the opening-balance envelope (kill the double-count)

**Files:**
- Modify: `webapp/src/actions/cashflow-planner.ts` (`upsertBalanceEnvelopes`, lines 496-608; overwrite at 552-572)

**Interfaces:**
- Consumes: `BALANCE_SEED_NOTES`.
- Behavior change: existing seed rows keep their **frozen** `amount` (opening balance). Only the **insert** branch sets `amount: balance`. Label/currency may still refresh.

- [ ] **Step 1: Change the update branch to stop overwriting `amount`**

In the `if (existingId) {` branch (≈552-572), remove `amount: balance` from the `.update({...})` payload so the opening balance is frozen at first seed:

```ts
    if (existingId) {
      updatePromises.push(
        supabase
          .from("planning_entries")
          .update({ label, currency_code: account.currency_code }) // ponytail: amount frozen — opening balance, set once on insert
          .eq("id", existingId)
          .eq("user_id", user.id)
          .then(({ error }) => {
            if (error) firstError ??= error.message;
            else updated += 1;
          })
      );
```

Leave the insert branch (574-585) unchanged — new seeds still capture `amount: balance` at creation.

- [ ] **Step 2: Build**

Run: `cd webapp && pnpm build`
Expected: clean.

- [ ] **Step 3: Manual verification (documented, no DB unit harness)**

In the running app: open a period, note the `Saldo · <cuenta>` amount, import/confirm an income that raises the account balance, reload the period. Expected: the `Saldo` envelope amount is UNCHANGED (frozen opening), and `total_income` did not jump by the paycheck twice. Record the before/after in the PR description.

- [ ] **Step 4: Spawn `server-action-reviewer`** on `webapp/src/actions/cashflow-planner.ts` and address any findings.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/actions/cashflow-planner.ts
git commit -m "fix(plan): freeze opening-balance envelope to stop income double-count"
```

---

## Task 5: Wire Saldo actual + states + commitments into hydratePeriodData

**Files:**
- Modify: `webapp/src/actions/cashflow-planner.ts` (`hydratePeriodData`, 70-235; totals 209-220; occurrence reconciliation 148-157)

**Interfaces:**
- Consumes: `deriveIncomeState`, `classifyCommitments`, `CommitmentIncomeRef`, `CommitmentExpenseInput` (Tasks 1-2); `BALANCE_SEED_NOTES`.
- Produces: a fully-populated `PeriodPlanData` with the Task 3 fields.

- [ ] **Step 1: Fetch spendable account balances inside hydrate**

Add `accounts` to the existing parallel fetch in `hydratePeriodData`. Reuse `MAIN_ACCOUNT_TYPES` (defined 481-485) — extract it to module scope if not already. Query:

```ts
const { data: spendAccounts } = await supabase
  .from("accounts")
  .select("current_balance, currency_code, account_type")
  .eq("user_id", userId)
  .in("account_type", MAIN_ACCOUNT_TYPES)
  .eq("is_active", true);
```

- [ ] **Step 2: Compute `saldo_actual` in the period currency**

Reuse the same `getExchangeRate`/conversion already used for entries (mirror the existing per-entry conversion at ~130-146). After the conversion helper is in scope:

```ts
let saldoActual = 0;
for (const a of spendAccounts ?? []) {
  const bal = Number(a.current_balance ?? 0);
  saldoActual += a.currency_code === period.currency_code
    ? bal
    : bal * (await rateFor(a.currency_code)); // use the same rate lookup the entry loop uses
}
```
(Use whatever rate accessor the entry loop already built — do not introduce a second exchange-rate path.)

- [ ] **Step 3: Set `state` + `is_opening_balance` on each income envelope**

Where income envelopes are assembled, add (today as `YYYY-MM-DD` — derive once at top of hydrate, e.g. `const todayISO = new Date().toISOString().slice(0, 10);`):

```ts
const isOpening = env.entry.notes === BALANCE_SEED_NOTES;
const state = isOpening ? "confirmado" : deriveIncomeState(env.entry.status, env.entry.expected_date, todayISO);
// → envelope.state = state; envelope.is_opening_balance = isOpening;
```

- [ ] **Step 4: Build commitment inputs and classify**

```ts
const incomeRefs: CommitmentIncomeRef[] = incomeEnvelopes.map((env) => ({
  entryId: env.entry.id,
  state: env.state,
  expectedDate: env.entry.expected_date,
  isOpeningBalance: env.is_opening_balance,
}));

const assignmentsByExpense = new Map<string, { incomeEntryId: string; amount: number }[]>();
for (const a of assignments) {
  const list = assignmentsByExpense.get(a.expense_entry_id) ?? [];
  list.push({ incomeEntryId: a.income_entry_id, amount: Number(a.assigned_amount) });
  assignmentsByExpense.set(a.expense_entry_id, list);
}

const commitmentInputs: CommitmentExpenseInput[] = expenseEntries
  .filter((e) => e.status !== "COMPLETED" && e.status !== "SKIPPED")
  .map((e) => ({
    entryId: e.id,
    dueDate: e.expected_date,
    unpaidAmount: e.converted_amount,
    assignments: assignmentsByExpense.get(e.id) ?? [],
  }));

const summary = classifyCommitments(commitmentInputs, incomeRefs, saldoActual, todayISO);
```

- [ ] **Step 5: Return the new fields**

Add to the returned `PeriodPlanData` object:

```ts
  saldo_actual: saldoActual,
  puedo_gastar: summary.puedoGastar,
  comprometido_ahora: summary.comprometidoAhora,
  comprometido_cubierto: summary.comprometidoCubierto,
  next_income_date: summary.nextIncomeDate,
  commitments: summary.perExpense,
```

- [ ] **Step 6: Build**

Run: `cd webapp && pnpm build`
Expected: clean (Task 3's type errors resolved).

- [ ] **Step 7: Spawn `server-action-reviewer` + `perf-auditor`** on the changed read path. The accounts fetch is added to an existing parallel block — confirm it doesn't serialize. Address findings.

- [ ] **Step 8: Commit**

```bash
git add webapp/src/actions/cashflow-planner.ts
git commit -m "feat(plan): hydrate saldo_actual, income states, time-aware commitments"
```

---

## Task 6: `confirmIncomeReceived` action (new INFLOW path)

**Files:**
- Modify: `webapp/src/actions/cashflow-planner.ts` (add new exported action near `payPlanningEntry`)

**Interfaces:**
- Mirrors `payPlanningEntry` but for income. Produces:
```ts
export async function confirmIncomeReceived(params: {
  entryId: string;
  existingTransactionId?: string;          // LINK mode
  amount?: number;                         // CREATE mode
  accountId?: string;                      // CREATE mode (target INFLOW account)
  currencyCode?: string;
  label?: string;
}): Promise<ActionResult<{ transactionId: string }>>;
```

- [ ] **Step 1: Implement**

Pattern after `payPlanningEntry` (1167-1419) — auth via `getAuthenticatedClient()`, load the entry (must be `entry_type === "INCOME"`, same user). Two modes:

- **LINK** (`existingTransactionId`): mark entry COMPLETED (`toggleEntryStatus` logic / direct update with `completed_at`), and if `entry.recurring_template_id` delegate to `linkExistingTransactionToOccurrence` (same import `payPlanningEntry` uses).
- **CREATE** (`amount` + `accountId`): insert an **INFLOW** transaction (mirror the OUTFLOW insert at 1295-1312 but `direction: "INFLOW"`, `capture_method: "MANUAL_FORM"`, `idempotency_key` via `computeIdempotencyKey`), update the account balance via `applyAccountBalanceDelta({ direction: "INFLOW", ... })` (mirror 1320-1340), then mark the entry COMPLETED. If `recurring_template_id`, link the new transaction to the occurrence.

Revalidation (copy from `payPlanningEntry`'s standalone tail, 1414-1417):
```ts
updateTag("cashflow-planner");
updateTag("occurrences");
revalidateFinancialViews();
return { success: true, data: { transactionId: txId } };
```

- [ ] **Step 2: Build**

Run: `cd webapp && pnpm build`
Expected: clean.

- [ ] **Step 3: Manual verification**

Confirm an `esperado` income via CREATE → a new INFLOW transaction exists, the account `current_balance` rose by the amount, the entry is COMPLETED, and (if recurring) the occurrence is `paid`. Reload: hero `Saldo actual` reflects the new balance; the income shows `confirmado`.

- [ ] **Step 4: Spawn `server-action-reviewer`** + `import-flow-doctor` (idempotency/occurrence linking) and address findings.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/actions/cashflow-planner.ts
git commit -m "feat(plan): confirmIncomeReceived — record/link a real INFLOW on confirm"
```

---

## Task 7: Confirmation sheet UI (income)

**Files:**
- Create: `webapp/src/components/cashflow-planner/confirm-income-dialog.tsx`

**Interfaces:**
- Consumes: `confirmIncomeReceived` (Task 6), `findCandidateTransactions` (existing, 1072), `PlanAccount`.
- Produces:
```ts
interface ConfirmIncomeDialogProps {
  entry: PlanningEntryWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
  accounts: PlanAccount[]; // spendable accounts (CHECKING/SAVINGS/CASH)
}
```

- [ ] **Step 1: Build the dialog** (model after `pay-expense-dialog.tsx` structure — two modes, but mirrored for income):
  - Title `Confirmar ingreso recibido`. Show entry label + expected date.
  - **Amount** input, prefilled `entry.amount`, editable (this is the deliberate confirmation gate).
  - **Cuenta destino** select from `accounts` (default `entry.account_id` if set, else first CHECKING/SAVINGS).
  - Optional **link** section: `findCandidateTransactions({ entryLabel: entry.label, entryAmount: Number(entry.amount), month })` filtered to INFLOW candidates → pick one → CREATE is skipped, LINK used.
  - Primary button uses `BRASS_BUTTON_CLASS` (consistent with pay dialog). On submit call `confirmIncomeReceived(...)`, `toast` on success/error, `onOpenChange(false)`.
  - Sheet content uses `MOBILE_SHEET_SAFE_AREA_CLASS`.

- [ ] **Step 2: Build**

Run: `cd webapp && pnpm build`
Expected: clean.

- [ ] **Step 3: Spawn `zetas-front-guy`** on the new dialog; address token/variant findings.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/cashflow-planner/confirm-income-dialog.tsx
git commit -m "feat(plan): income confirmation sheet (amount + account + link movement)"
```

---

## Task 8: `PeriodHero` toggle component

**Files:**
- Create: `webapp/src/components/cashflow-planner/period-hero.tsx`

**Interfaces:**
- Consumes: `PeriodPlanData` fields `saldo_actual`, `puedo_gastar`, `comprometido_ahora`, `comprometido_cubierto`, `period`, `currency`.
- Produces: `function PeriodHero({ data }: { data: PeriodPlanData }): JSX.Element` — `"use client"` (toggle state).

- [ ] **Step 1: Build the hero**
  - Local `useState<"gastar" | "comprometido">("gastar")` segmented control (two buttons; active uses `text-z-brass`/brass bg token, inactive muted).
  - Big number: `formatCurrency(data.puedo_gastar, data.currency)` (brass; if `< 0` use `text-z-expense`) OR, when toggled, `formatCurrency(data.comprometido_ahora + data.comprometido_cubierto, data.currency)`.
  - On `comprometido` view show the split: `cuenta ahora` (`text-amber-400`) + `cubierto por próximo ingreso` (`text-z-income`).
  - Split bar (two flex divs): libre vs `comprometido_ahora`, widths from `saldo_actual`. Guard divide-by-zero.
  - Bridge line: `Saldo actual · cuentas reales` → `formatCurrency(data.saldo_actual, data.currency)`.
  - Period name + date range from `data.period`.

- [ ] **Step 2: Build** — `cd webapp && pnpm build` → clean.

- [ ] **Step 3: Spawn `zetas-front-guy`**; address findings.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/cashflow-planner/period-hero.tsx
git commit -m "feat(plan): PeriodHero — Puedo gastar / Comprometido toggle"
```

---

## Task 9: Income card states + Confirmar button + collapse confirmados

**Files:**
- Create: `webapp/src/components/cashflow-planner/settled-group.tsx`
- Modify: `webapp/src/components/cashflow-planner/income-envelope-card.tsx`

**Interfaces:**
- `settled-group.tsx`: `"use client"`, `function SettledGroup({ count, total, currency, label, children }: { count: number; total: number; currency: CurrencyCode; label: string; children: React.ReactNode }): JSX.Element` — collapsed by default (`useState(false)`), header `✓ {count} {label} · {formatCurrency(total, currency)}` + `mostrar ▾` toggle, renders `children` when expanded.
- `income-envelope-card.tsx`: add optional `onConfirm?: (entry: PlanningEntryWithRelations) => void;` prop. Read `envelope.state`.

- [ ] **Step 1: Build `SettledGroup`** per the interface above (dashed border `border-white/6`, `text-z-income` accent on the badge).

- [ ] **Step 2: Update `IncomeEnvelopeCard`**
  - Left-border color by `state`: `confirmado` → `text-z-income` hex, `esperado` → neutral `border-white/6`, `atrasado` → `text-z-expense` hex. (Keep the per-envelope color for the assignment-chip identity; the state drives the left border + chip only.)
  - Add a state chip: `confirmado` → `✓ Confirmado`, `atrasado` → red `Atrasado`. For `esperado`/`atrasado`, render a button `Confirmar recibido` (esperado) / `¿Llegó? Confirmar` (atrasado) calling `onConfirm?.(entry)`. Hide the existing PLANNED↔COMPLETED check toggle when `onConfirm` is provided (confirm replaces it for income).

- [ ] **Step 3: Build** — `cd webapp && pnpm build` → clean.

- [ ] **Step 4: Spawn `zetas-front-guy`**; address findings.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/cashflow-planner/settled-group.tsx webapp/src/components/cashflow-planner/income-envelope-card.tsx
git commit -m "feat(plan): income states + Confirmar action + SettledGroup collapse"
```

---

## Task 10: Expense cuenta-ahora/cubierto tag + Pagar + collapse pagados

**Files:**
- Modify: `webapp/src/components/cashflow-planner/expense-entry-row.tsx`

**Interfaces:**
- Add optional props: `commitment?: ExpenseCommitment;` and `onPay?: (entry: PlanningEntryWithRelations) => void;`.

- [ ] **Step 1: Render the commitment tag**

When `entry.status === "PLANNED"` and a `commitment` is passed, show a small tag: if `commitment.cuentaAhora > 0` → `text-amber-400` chip `cuenta ahora`; else if `commitment.cubierto > 0` → `text-z-income` chip `cubierto`; else if `commitment.sinAsignar > 0` → muted chip `sin asignar`. Place next to the existing `STATUS_BADGE`.

- [ ] **Step 2: Add a `Pagar` action**

Next to `Asignar`, render a `Pagar` button (ghost, Spanish) when `onPay && entry.status === "PLANNED"` → `onPay(entry)`. (Mounting wired in Task 11 so desktop gets the PayExpenseDialog too.)

- [ ] **Step 3: Build** — `cd webapp && pnpm build` → clean.

- [ ] **Step 4: Spawn `zetas-front-guy`**; address findings.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/cashflow-planner/expense-entry-row.tsx
git commit -m "feat(plan): expense cuenta-ahora/cubierto tag + Pagar action"
```

---

## Task 11: Assemble desktop + mobile boards (hero, HOY divider, collapse, tabs, wiring)

**Files:**
- Modify: `webapp/src/components/cashflow-planner/envelope-board.tsx`
- Modify: `webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx`
- Modify: `webapp/src/components/plan/tabs/plan-tab-periodo.tsx`

**Interfaces:**
- Consumes: `PeriodHero`, `SettledGroup`, `ConfirmIncomeDialog`, `PayExpenseDialog`, and the new card/row props.

- [ ] **Step 1: Desktop `EnvelopeBoard`**
  - Mount `<PeriodHero data={data} />` at the top, then a **HOY divider** (a thin row: `Hoy · {formatDate(todayISO)} · quedan N días`), then the existing 2-col grid.
  - **Income column:** split `income_envelopes` into confirmed/settled (`state === "confirmado"` or `is_opening_balance`) vs active (`esperado`/`atrasado`). Render active cards directly; wrap settled ones in `<SettledGroup label="confirmados" .../>`. Pass `onConfirm={openConfirmIncome}` to active income cards.
  - **Expense column:** split `expense_entries` into paid (`status === "COMPLETED"`) vs pending. Wrap paid in `<SettledGroup label="pagados" .../>`. Pass `commitment={data.commitments[entry.id]}` and `onPay={openPay}` to pending rows.
  - Mount `<ConfirmIncomeDialog .../>` and `<PayExpenseDialog .../>` (desktop now gets Pagar). `EnvelopeBoard` currently takes a narrow `accounts` shape — widen its prop to `PlanAccount[]` so the dialogs get balances (update the call site in `plan-tab-periodo.tsx` to pass the already-mapped `accounts`).

- [ ] **Step 2: Mobile `MobilePeriodoView`**
  - Replace the `Neto del mes` hero block (175-200) with `<PeriodHero data={planData} />` (keep `PlanFlowChart` below it).
  - Add a HOY divider.
  - Add an **Ingresos / Gastos tab switcher** (net-new): local `useState<"ingresos" | "gastos">("ingresos")` with two pill buttons; render only the active section (the two sections already exist at 228-273 / 275-319 — gate each on the tab). Tab labels show counts: `Ingresos · {pendientes}` / `Gastos · {formatCurrency(comprometido_ahora,...)}`.
  - Apply the same settled-collapse + `onConfirm`/`onPay`/`commitment` wiring as desktop. `ConfirmIncomeDialog` reuses the existing `accounts: PlanAccount[]`.

- [ ] **Step 3: `plan-tab-periodo.tsx`** — remove/relocate the now-redundant `<PeriodHeader>` (the hero subsumes its totals) and the `<h2>Planear tu dinero</h2>` block if the hero covers it; pass the wide `accounts` to `EnvelopeBoard`.

- [ ] **Step 4: Build** — `cd webapp && pnpm build` → clean.

- [ ] **Step 5: Manual verification (desktop + mobile-web)** — at ~960px and ~380px: hero toggles; HOY divider present; confirmed income + paid expenses collapse and expand; Confirmar opens the sheet and updates Saldo actual; pending expenses show cuenta-ahora/cubierto tags; mobile tabs switch Ingresos/Gastos; tab-bar clearance intact.

- [ ] **Step 6: Spawn `zetas-front-guy` + `perf-auditor`**; address findings.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/components/cashflow-planner/envelope-board.tsx webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx webapp/src/components/plan/tabs/plan-tab-periodo.tsx
git commit -m "feat(plan): living-timeline boards — hero, HOY divider, collapse, mobile tabs"
```

---

## Task 12: Final gates

- [ ] **Step 1:** `cd webapp && pnpm vitest run src/lib/utils/plan-commitments.test.ts` → all pass.
- [ ] **Step 2:** From repo root `pnpm install` (only if deps changed — none expected) then `cd webapp && pnpm build` → clean.
- [ ] **Step 3:** `pnpm audit --audit-level high` (repo root) before PR → no high/critical (fix via overrides if any).
- [ ] **Step 4:** Dry-merge against main: `git fetch origin main && git merge --no-commit --no-ff origin/main`, resolve/inspect, then `git merge --abort`.
- [ ] **Step 5:** Final review sweep — `zetas-front-guy`, `server-action-reviewer`, `perf-auditor` clean.
- [ ] **Step 6:** Open PR from `feat/plan-living-timeline`.

---

## Self-Review

**Spec coverage:** living timeline (Tasks 5,8,11) · Saldo actual live (5) · opening freeze / double-count fix (4) · income states esperado/confirmado/atrasado (1,5,9) · confirm sheet pure-C + INFLOW (6,7) · auto-confirm via import (unchanged — occurrence reconciliation at hydrate 148-157, noted) · assignments persist (unchanged) · time-aware Comprometido + atrasado edge (2) · Puedo gastar (2,8) · toggle hero (8) · HOY divider + collapse both sides (9,10,11) · desktop 2-col + mobile tabs (11) · Vitest money gate (1,2) · review gates (4,5,6,7,8,9,10,11,12). All spec sections map to a task.

**Placeholder scan:** none — pure-logic tasks carry full code+tests; integration/UI tasks carry exact anchors, concrete code, and explicit manual-verification + review-agent steps (DB-bound actions can't be unit-tested without a harness, so they get documented manual checks, consistent with the codebase).

**Type consistency:** `IncomeState`, `ExpenseCommitment`, `CommitmentSummary`, `classifyCommitments`, `deriveIncomeState`, `confirmIncomeReceived`, `PeriodHero`, `SettledGroup`, `ConfirmIncomeDialog` names are used identically across producing and consuming tasks. New `PeriodPlanData` fields (`saldo_actual`, `puedo_gastar`, `comprometido_ahora`, `comprometido_cubierto`, `next_income_date`, `commitments`) and `IncomeEnvelope` fields (`state`, `is_opening_balance`) are defined in Task 3 and consumed in Tasks 5/8/9/10/11 with matching names.
