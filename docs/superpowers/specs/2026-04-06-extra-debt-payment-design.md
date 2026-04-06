# Extra Debt Payment — One-Time Allocation

## Summary

A new mode on the `/deudas` page for allocating a lump sum of money across selected debts as a one-time extra payment. Opens as a sheet/drawer from a "Tengo plata extra" button. Suggests optimal allocation (highest rate first), allows manual overrides, shows full impact preview (interest saved + payoff simulation), and optionally records transfer transactions.

## Motivation

The existing planner (`/deudas/planificador`) models long-term payoff strategies with recurring cash entries. This feature addresses a different moment: money just came in, and the user wants to make a quick tactical decision about which debts to pay down right now.

## UI Flow

### Trigger

A button/card on the `/deudas` page — visible when there are active debts (balance > 0). Positioned below the hero/quick stats area. Available on both mobile and desktop.

Opens a **bottom sheet (mobile) / side sheet (desktop)**.

### Sheet Layout — Single Scrollable View

**Zone 1: Amount & Source**
- Large currency-formatted amount input
- Source account dropdown (filtered to non-debt accounts)
- Soft warning if amount > source account balance (not blocking — user may have untracked cash)

**Zone 2: Allocation**
- List of debt accounts with checkboxes (all checked by default)
- Each row shows: account name, interest rate, current balance, allocated amount (editable input)
- Unchecking an account redistributes its allocation among remaining selected accounts
- Editing an amount locks it; remaining auto-distributes among unlocked accounts
- "Resetear" link to undo all manual overrides and re-run auto-allocation

**Zone 3: Impact Preview**
- Appears once amount > 0 and at least one debt is selected
- Two summary cards:
  - **Ahorro inmediato**: monthly interest before vs. after, delta highlighted
  - **Proyeccion**: months to debt-free before vs. after, total interest saved over life of debts
- Numbers only, no charts — keep it compact

**Footer**
- "Aplicar pagos" (brass/primary) — records transfers, closes sheet, shows success toast
- "Cerrar" (ghost) — dismisses without action

## Allocation Engine

New pure function in `@zeta/shared`:

```typescript
function allocateExtraPayment(input: {
  totalAmount: number;
  accounts: DebtAccount[];
  selectedIds: string[];
  manualOverrides?: Map<string, number>; // accountId -> locked amount
}): ExtraPaymentAllocation[]

interface ExtraPaymentAllocation {
  accountId: string;
  accountName: string;
  interestRate: number;
  currentBalance: number;
  allocatedAmount: number;
  newBalance: number;
  locked: boolean; // user manually set this amount
}
```

**Algorithm**:
1. Filter to selected accounts only
2. Subtract all manually locked amounts from the available total
3. Sort remaining (unlocked) accounts by interest rate descending (avalanche)
4. Allocate sequentially: cap each at its current balance, pass remainder to next
5. Return allocation array

## Impact Calculation

New pure function in `@zeta/shared`:

```typescript
function computeExtraPaymentImpact(input: {
  accounts: DebtAccount[];
  allocations: ExtraPaymentAllocation[];
}): ExtraPaymentImpact

interface ExtraPaymentImpact {
  monthlyInterestBefore: number;
  monthlyInterestAfter: number;
  monthlyInterestSaved: number;
  monthsToDebtFreeBefore: number;
  monthsToDebtFreeAfter: number;
  monthsSaved: number;
  totalInterestSavedOverLife: number;
}
```

**How**:
- Monthly interest: uses `estimateMonthlyInterest()` on old vs. new balances
- Payoff simulation: runs `runScenario()` twice (current balances vs. post-payment balances, minimums only, no extra cash entries) and compares `totalMonths` and `totalInterestPaid`

## Server Action: `applyExtraDebtPayment()`

```typescript
async function applyExtraDebtPayment(input: {
  sourceAccountId: string;
  allocations: Array<{ accountId: string; amount: number }>;
  description?: string;
}): Promise<ActionResult<{ applied: number; totalPaid: number }>>
```

**Behavior**:
- Auth via `getAuthenticatedClient()`
- Validates all account IDs belong to user, amounts > 0
- For each allocation: creates **two transactions** (existing transfer pattern):
  1. OUTFLOW on source account: `category_id = TRANSFER_CATEGORY_ID`, description "Transferencia a {debtName} - Pago extra"
  2. INFLOW on debt account: `category_id = DEBT_PAYMENT_CATEGORY_ID`, description "Abono deuda desde {sourceName} - Pago extra"
- Idempotency key: computed from sourceAccountId + debtAccountId + amount + date
- Revalidates tags: `"debt"`, `"accounts"`, `"dashboard:hero"`, `"dashboard:accounts"`
- Returns count of applied payments and total amount

**No new database tables** — uses existing transactions table and transfer patterns.

## File Plan

| Layer | File | Purpose |
|-------|------|---------|
| Shared | `packages/shared/src/utils/extra-payment.ts` | `allocateExtraPayment()` + `computeExtraPaymentImpact()` |
| Shared | `packages/shared/src/utils/extra-payment.test.ts` | Unit tests for allocation + impact |
| Shared | `packages/shared/src/index.ts` | Export new functions |
| Action | `webapp/src/actions/extra-payment.ts` | `applyExtraDebtPayment()` server action |
| Component | `webapp/src/components/debt/extra-payment-sheet.tsx` | Main sheet component with all three zones |
| Page | `webapp/src/app/(dashboard)/deudas/page.tsx` | Add trigger button + render sheet |

## Scope Exclusions

- No recurring/scheduled extra payments (that's what the planner is for)
- No new database tables or migrations
- No changes to the existing planner or scenario engine API
- No charts in the impact preview — numbers only
