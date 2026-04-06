# Extra Debt Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Tengo plata extra" sheet on the debt page that lets users allocate a lump sum across selected debts, preview the impact (interest saved + payoff simulation), and optionally record the payments as transfer transactions.

**Architecture:** Pure allocation + impact functions in `@zeta/shared` (tested first), a server action in `webapp/src/actions/` that creates transfer transaction pairs using existing `persistTransaction` + `adjustBalancesForTransactionChanges` patterns, and a single client component sheet with three zones (amount/source, allocation, impact preview).

**Tech Stack:** TypeScript, React 19, Next.js 15 Server Actions, `@zeta/shared` pure functions, shadcn/ui Sheet, Supabase via `getAuthenticatedClient()`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/shared/src/utils/extra-payment.ts` | `allocateExtraPayment()` + `computeExtraPaymentImpact()` pure functions |
| `packages/shared/src/utils/__tests__/extra-payment.test.ts` | Unit tests for allocation and impact |
| `packages/shared/src/index.ts` | Re-export new module |
| `webapp/src/actions/extra-payment.ts` | `applyExtraDebtPayment()` server action + `getNonDebtAccounts()` data loader |
| `webapp/src/components/debt/extra-payment-sheet.tsx` | Client component: sheet with all 3 zones + footer |
| `webapp/src/app/(dashboard)/deudas/page.tsx` | Add trigger button + pass data to sheet |

---

### Task 1: Allocation Engine — Pure Function

**Files:**
- Create: `packages/shared/src/utils/extra-payment.ts`
- Create: `packages/shared/src/utils/__tests__/extra-payment.test.ts`

- [ ] **Step 1: Write failing tests for `allocateExtraPayment()`**

Create `packages/shared/src/utils/__tests__/extra-payment.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { allocateExtraPayment } from "../extra-payment";
import type { DebtAccount } from "../debt";

const makeAccount = (
  overrides: Partial<DebtAccount> & { id: string; balance: number }
): DebtAccount => ({
  name: overrides.id,
  type: "CREDIT_CARD",
  creditLimit: null,
  interestRate: null,
  monthlyPayment: null,
  paymentDay: null,
  cutoffDay: null,
  currency: "COP",
  color: null,
  institutionName: null,
  currencyBreakdown: null,
  loanAmount: null,
  ...overrides,
});

const accounts: DebtAccount[] = [
  makeAccount({ id: "a", balance: 5_000_000, interestRate: 28 }),
  makeAccount({ id: "b", balance: 3_000_000, interestRate: 45 }),
  makeAccount({ id: "c", balance: 1_000_000, interestRate: 32 }),
];

describe("allocateExtraPayment", () => {
  it("allocates by highest rate first (avalanche)", () => {
    const result = allocateExtraPayment({
      totalAmount: 4_000_000,
      accounts,
      selectedIds: ["a", "b", "c"],
    });

    // b has highest rate (45%), gets first 3M (its full balance)
    expect(result.find((r) => r.accountId === "b")!.allocatedAmount).toBe(3_000_000);
    // c has next highest rate (32%), gets remaining 1M (its full balance)
    expect(result.find((r) => r.accountId === "c")!.allocatedAmount).toBe(1_000_000);
    // a gets nothing (no money left)
    expect(result.find((r) => r.accountId === "a")!.allocatedAmount).toBe(0);
  });

  it("caps allocation at account balance", () => {
    const result = allocateExtraPayment({
      totalAmount: 20_000_000,
      accounts,
      selectedIds: ["a", "b", "c"],
    });

    expect(result.find((r) => r.accountId === "a")!.allocatedAmount).toBe(5_000_000);
    expect(result.find((r) => r.accountId === "b")!.allocatedAmount).toBe(3_000_000);
    expect(result.find((r) => r.accountId === "c")!.allocatedAmount).toBe(1_000_000);
  });

  it("only allocates to selected accounts", () => {
    const result = allocateExtraPayment({
      totalAmount: 4_000_000,
      accounts,
      selectedIds: ["a", "c"],
    });

    // c (32%) > a (28%) in rate
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.accountId === "c")!.allocatedAmount).toBe(1_000_000);
    expect(result.find((r) => r.accountId === "a")!.allocatedAmount).toBe(3_000_000);
  });

  it("respects manual overrides and distributes remainder", () => {
    const result = allocateExtraPayment({
      totalAmount: 4_000_000,
      accounts,
      selectedIds: ["a", "b", "c"],
      manualOverrides: new Map([["a", 2_000_000]]),
    });

    // a is locked at 2M
    const aResult = result.find((r) => r.accountId === "a")!;
    expect(aResult.allocatedAmount).toBe(2_000_000);
    expect(aResult.locked).toBe(true);

    // Remaining 2M goes to b (highest rate among unlocked)
    expect(result.find((r) => r.accountId === "b")!.allocatedAmount).toBe(2_000_000);
    expect(result.find((r) => r.accountId === "c")!.allocatedAmount).toBe(0);
  });

  it("returns correct newBalance for each account", () => {
    const result = allocateExtraPayment({
      totalAmount: 3_000_000,
      accounts,
      selectedIds: ["b"],
    });

    const bResult = result.find((r) => r.accountId === "b")!;
    expect(bResult.newBalance).toBe(0);
    expect(bResult.currentBalance).toBe(3_000_000);
  });

  it("handles zero total amount", () => {
    const result = allocateExtraPayment({
      totalAmount: 0,
      accounts,
      selectedIds: ["a", "b"],
    });

    for (const r of result) {
      expect(r.allocatedAmount).toBe(0);
      expect(r.newBalance).toBe(r.currentBalance);
    }
  });

  it("handles empty selection", () => {
    const result = allocateExtraPayment({
      totalAmount: 1_000_000,
      accounts,
      selectedIds: [],
    });

    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/shared && pnpm vitest run src/utils/__tests__/extra-payment.test.ts`
Expected: FAIL — module `../extra-payment` not found.

- [ ] **Step 3: Implement `allocateExtraPayment()`**

Create `packages/shared/src/utils/extra-payment.ts`:

```typescript
import type { DebtAccount } from "./debt";

export interface ExtraPaymentAllocation {
  accountId: string;
  accountName: string;
  interestRate: number;
  currentBalance: number;
  allocatedAmount: number;
  newBalance: number;
  locked: boolean;
}

/**
 * Allocate a lump sum across selected debt accounts using avalanche strategy
 * (highest interest rate first). Respects manual overrides (locked amounts).
 */
export function allocateExtraPayment(input: {
  totalAmount: number;
  accounts: DebtAccount[];
  selectedIds: string[];
  manualOverrides?: Map<string, number>;
}): ExtraPaymentAllocation[] {
  const { totalAmount, accounts, selectedIds, manualOverrides } = input;

  const selected = accounts.filter((a) => selectedIds.includes(a.id));
  if (selected.length === 0) return [];

  // Subtract locked amounts from available pool
  let available = totalAmount;
  const lockedAmounts = new Map<string, number>();

  if (manualOverrides) {
    for (const [accountId, amount] of manualOverrides) {
      if (selectedIds.includes(accountId)) {
        const account = selected.find((a) => a.id === accountId);
        if (account) {
          const capped = Math.min(amount, account.balance);
          lockedAmounts.set(accountId, capped);
          available -= capped;
        }
      }
    }
  }

  available = Math.max(available, 0);

  // Sort unlocked accounts by interest rate descending (avalanche)
  const unlocked = selected
    .filter((a) => !lockedAmounts.has(a.id))
    .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));

  // Allocate remaining pool to unlocked accounts
  const allocations = new Map<string, number>();
  let pool = available;

  for (const account of unlocked) {
    if (pool <= 0) {
      allocations.set(account.id, 0);
      continue;
    }
    const payment = Math.min(pool, account.balance);
    allocations.set(account.id, payment);
    pool -= payment;
  }

  // Build result array
  return selected.map((account) => {
    const locked = lockedAmounts.has(account.id);
    const allocatedAmount = locked
      ? lockedAmounts.get(account.id)!
      : (allocations.get(account.id) ?? 0);

    return {
      accountId: account.id,
      accountName: account.name,
      interestRate: account.interestRate ?? 0,
      currentBalance: account.balance,
      allocatedAmount,
      newBalance: account.balance - allocatedAmount,
      locked,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/shared && pnpm vitest run src/utils/__tests__/extra-payment.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/extra-payment.ts packages/shared/src/utils/__tests__/extra-payment.test.ts
git commit -m "feat: add allocateExtraPayment pure function with tests"
```

---

### Task 2: Impact Calculation — Pure Function

**Files:**
- Modify: `packages/shared/src/utils/extra-payment.ts`
- Modify: `packages/shared/src/utils/__tests__/extra-payment.test.ts`

- [ ] **Step 1: Write failing tests for `computeExtraPaymentImpact()`**

Append to `packages/shared/src/utils/__tests__/extra-payment.test.ts`:

```typescript
import { computeExtraPaymentImpact } from "../extra-payment";

// Reuse `accounts` and `makeAccount` from Task 1

describe("computeExtraPaymentImpact", () => {
  it("calculates monthly interest saved", () => {
    const allocations = [
      {
        accountId: "b",
        accountName: "b",
        interestRate: 45,
        currentBalance: 3_000_000,
        allocatedAmount: 3_000_000,
        newBalance: 0,
        locked: false,
      },
    ];

    const impact = computeExtraPaymentImpact({
      accounts,
      allocations,
    });

    // b had 45% EA → monthly rate ~3.13% → ~$93,900/month interest
    // After paying off, that interest drops to 0
    expect(impact.monthlyInterestSaved).toBeGreaterThan(90_000);
    expect(impact.monthlyInterestAfter).toBeLessThan(impact.monthlyInterestBefore);
  });

  it("calculates payoff simulation deltas", () => {
    const allocations = [
      {
        accountId: "b",
        accountName: "b",
        interestRate: 45,
        currentBalance: 3_000_000,
        allocatedAmount: 3_000_000,
        newBalance: 0,
        locked: false,
      },
    ];

    const impact = computeExtraPaymentImpact({
      accounts,
      allocations,
    });

    expect(impact.monthsSaved).toBeGreaterThan(0);
    expect(impact.totalInterestSavedOverLife).toBeGreaterThan(0);
    expect(impact.monthsToDebtFreeAfter).toBeLessThan(impact.monthsToDebtFreeBefore);
  });

  it("returns zeros when no allocation changes balances", () => {
    const allocations = [
      {
        accountId: "a",
        accountName: "a",
        interestRate: 28,
        currentBalance: 5_000_000,
        allocatedAmount: 0,
        newBalance: 5_000_000,
        locked: false,
      },
    ];

    const impact = computeExtraPaymentImpact({
      accounts,
      allocations,
    });

    expect(impact.monthlyInterestSaved).toBe(0);
    expect(impact.monthsSaved).toBe(0);
    expect(impact.totalInterestSavedOverLife).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/shared && pnpm vitest run src/utils/__tests__/extra-payment.test.ts`
Expected: FAIL — `computeExtraPaymentImpact` is not exported.

- [ ] **Step 3: Implement `computeExtraPaymentImpact()`**

Append to `packages/shared/src/utils/extra-payment.ts`:

```typescript
import { estimateMonthlyInterest } from "./debt";
import { runScenario } from "./scenario-engine";
import type { ScenarioAllocations } from "./scenario-types";

export interface ExtraPaymentImpact {
  monthlyInterestBefore: number;
  monthlyInterestAfter: number;
  monthlyInterestSaved: number;
  monthsToDebtFreeBefore: number;
  monthsToDebtFreeAfter: number;
  monthsSaved: number;
  totalInterestSavedOverLife: number;
}

/**
 * Compute the full impact of an extra payment allocation.
 * Uses estimateMonthlyInterest for immediate savings and
 * runScenario for payoff simulation comparison.
 */
export function computeExtraPaymentImpact(input: {
  accounts: DebtAccount[];
  allocations: ExtraPaymentAllocation[];
}): ExtraPaymentImpact {
  const { accounts, allocations } = input;

  // Build a map of allocated amounts by accountId
  const allocationMap = new Map(
    allocations.map((a) => [a.accountId, a.allocatedAmount])
  );

  // Monthly interest: before vs. after
  let monthlyInterestBefore = 0;
  let monthlyInterestAfter = 0;

  for (const account of accounts) {
    const interest = estimateMonthlyInterest(account.balance, account.interestRate);
    monthlyInterestBefore += interest;

    const allocated = allocationMap.get(account.id) ?? 0;
    const newBalance = account.balance - allocated;
    monthlyInterestAfter += estimateMonthlyInterest(newBalance, account.interestRate);
  }

  const monthlyInterestSaved = monthlyInterestBefore - monthlyInterestAfter;

  // Payoff simulation: current balances vs. post-payment balances
  const now = new Date();
  const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const emptyAllocations: ScenarioAllocations = {
    manualOverrides: [],
    cascadeRedirects: [],
  };

  const activeAccounts = accounts.filter((a) => a.balance > 0);
  if (activeAccounts.length === 0) {
    return {
      monthlyInterestBefore: 0,
      monthlyInterestAfter: 0,
      monthlyInterestSaved: 0,
      monthsToDebtFreeBefore: 0,
      monthsToDebtFreeAfter: 0,
      monthsSaved: 0,
      totalInterestSavedOverLife: 0,
    };
  }

  // Before: minimums only on current balances
  const resultBefore = runScenario({
    accounts: activeAccounts,
    cashEntries: [],
    strategy: "avalanche",
    allocations: emptyAllocations,
    startMonth,
  });

  // After: minimums only on post-payment balances
  const accountsAfter = activeAccounts
    .map((a) => {
      const allocated = allocationMap.get(a.id) ?? 0;
      const newBalance = a.balance - allocated;
      if (newBalance <= 0) return null;
      return { ...a, balance: newBalance };
    })
    .filter((a): a is DebtAccount => a !== null);

  const resultAfter = accountsAfter.length > 0
    ? runScenario({
        accounts: accountsAfter,
        cashEntries: [],
        strategy: "avalanche",
        allocations: emptyAllocations,
        startMonth,
      })
    : { totalMonths: 0, totalInterestPaid: 0 };

  return {
    monthlyInterestBefore,
    monthlyInterestAfter,
    monthlyInterestSaved,
    monthsToDebtFreeBefore: resultBefore.totalMonths,
    monthsToDebtFreeAfter: resultAfter.totalMonths,
    monthsSaved: resultBefore.totalMonths - resultAfter.totalMonths,
    totalInterestSavedOverLife: resultBefore.totalInterestPaid - resultAfter.totalInterestPaid,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/shared && pnpm vitest run src/utils/__tests__/extra-payment.test.ts`
Expected: All 10 tests PASS.

- [ ] **Step 5: Export from shared index and commit**

Add to `packages/shared/src/index.ts`:
```typescript
export * from "./utils/extra-payment";
```

```bash
git add packages/shared/src/utils/extra-payment.ts packages/shared/src/utils/__tests__/extra-payment.test.ts packages/shared/src/index.ts
git commit -m "feat: add computeExtraPaymentImpact with payoff simulation"
```

---

### Task 3: Server Action — Apply Extra Debt Payment

**Files:**
- Create: `webapp/src/actions/extra-payment.ts`

- [ ] **Step 1: Create `getNonDebtAccounts()` data loader**

This is needed by the sheet to populate the source account dropdown.

Create `webapp/src/actions/extra-payment.ts`:

```typescript
"use server";

import { revalidateTag } from "next/cache";
import {
  TRANSFER_CATEGORY_ID,
  DEBT_PAYMENT_CATEGORY_ID,
  computeIdempotencyKey,
} from "@zeta/shared";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import {
  applyAccountBalanceDelta,
} from "@/lib/utils/account-balance";
import type { ActionResult } from "@/types/actions";

type SourceAccount = {
  id: string;
  name: string;
  current_balance: number;
  currency_code: string;
  account_type: string;
};

export async function getNonDebtAccounts(): Promise<SourceAccount[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data } = await supabase
    .from("accounts")
    .select("id, name, current_balance, currency_code, account_type")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .not("account_type", "in", "(CREDIT_CARD,LOAN)")
    .order("name");

  return (data ?? []) as SourceAccount[];
}
```

- [ ] **Step 2: Implement `applyExtraDebtPayment()` server action**

Append to `webapp/src/actions/extra-payment.ts`:

```typescript
type DebtPaymentAllocation = {
  accountId: string;
  accountName: string;
  amount: number;
};

type ApplyResult = {
  applied: number;
  totalPaid: number;
};

export async function applyExtraDebtPayment(input: {
  sourceAccountId: string;
  sourceAccountName: string;
  allocations: DebtPaymentAllocation[];
  description?: string;
}): Promise<ActionResult<ApplyResult>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { sourceAccountId, sourceAccountName, allocations, description } = input;
  const label = description?.trim() || "Pago extra";
  const today = new Date().toISOString().split("T")[0];

  // Validate all accounts belong to user
  const allAccountIds = [sourceAccountId, ...allocations.map((a) => a.accountId)];
  const { data: accountRows, error: accountError } = await supabase
    .from("accounts")
    .select("id, name, account_type, current_balance")
    .eq("user_id", user.id)
    .in("id", allAccountIds);

  if (accountError || !accountRows) {
    return { success: false, error: "No se pudieron verificar las cuentas." };
  }

  const accountMap = new Map(accountRows.map((a) => [a.id, a]));

  if (!accountMap.has(sourceAccountId)) {
    return { success: false, error: "Cuenta origen no encontrada." };
  }

  let applied = 0;
  let totalPaid = 0;

  for (const allocation of allocations) {
    if (allocation.amount <= 0) continue;

    const debtAccount = accountMap.get(allocation.accountId);
    if (!debtAccount) continue;

    const sourceDesc = `Transferencia a ${allocation.accountName} - ${label}`;
    const debtDesc = `Abono deuda desde ${sourceAccountName} - ${label}`;

    // Idempotency keys
    const sourceIdempotency = await computeIdempotencyKey({
      provider: "MANUAL",
      transactionDate: today,
      amount: allocation.amount,
      rawDescription: sourceDesc,
    });

    const debtIdempotency = await computeIdempotencyKey({
      provider: "MANUAL",
      transactionDate: today,
      amount: allocation.amount,
      rawDescription: debtDesc,
    });

    // 1. OUTFLOW on source account
    const { error: sourceError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: sourceAccountId,
        amount: allocation.amount,
        currency_code: debtAccount.account_type === "CREDIT_CARD" || debtAccount.account_type === "LOAN"
          ? accountMap.get(sourceAccountId)!.currency_code
          : "COP",
        direction: "OUTFLOW",
        transaction_date: today,
        raw_description: sourceDesc,
        clean_description: sourceDesc,
        merchant_name: `Transferencia a ${allocation.accountName}`,
        category_id: TRANSFER_CATEGORY_ID,
        provider: "MANUAL",
        capture_method: "MANUAL_FORM",
        idempotency_key: sourceIdempotency,
        categorization_source: "SYSTEM_DEFAULT",
      });

    if (sourceError) {
      if (sourceError.code === "23505") continue; // Skip duplicate
      return { success: false, error: `Error al registrar pago: ${sourceError.message}` };
    }

    // 2. INFLOW on debt account
    const { error: debtError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: allocation.accountId,
        amount: allocation.amount,
        currency_code: accountMap.get(sourceAccountId)!.currency_code,
        direction: "INFLOW",
        transaction_date: today,
        raw_description: debtDesc,
        clean_description: debtDesc,
        merchant_name: label,
        category_id: DEBT_PAYMENT_CATEGORY_ID,
        provider: "MANUAL",
        capture_method: "MANUAL_FORM",
        idempotency_key: debtIdempotency,
        categorization_source: "SYSTEM_DEFAULT",
      });

    if (debtError) {
      if (debtError.code === "23505") continue;
      return { success: false, error: `Error al registrar abono: ${debtError.message}` };
    }

    // 3. Update balances
    const sourceAccount = accountMap.get(sourceAccountId)!;
    const newSourceBalance = applyAccountBalanceDelta({
      currentBalance: sourceAccount.current_balance,
      accountType: sourceAccount.account_type,
      direction: "OUTFLOW",
      amount: allocation.amount,
    });

    await supabase
      .from("accounts")
      .update({ current_balance: newSourceBalance })
      .eq("id", sourceAccountId)
      .eq("user_id", user.id);

    sourceAccount.current_balance = newSourceBalance;

    const newDebtBalance = applyAccountBalanceDelta({
      currentBalance: debtAccount.current_balance,
      accountType: debtAccount.account_type,
      direction: "INFLOW",
      amount: allocation.amount,
    });

    await supabase
      .from("accounts")
      .update({ current_balance: newDebtBalance })
      .eq("id", allocation.accountId)
      .eq("user_id", user.id);

    debtAccount.current_balance = newDebtBalance;

    applied++;
    totalPaid += allocation.amount;
  }

  // Revalidate all financial views
  revalidateTag("accounts", "zeta");
  revalidateTag("dashboard:accounts", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
  revalidateTag("dashboard:cashflow", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  revalidateTag("debt", "zeta");
  revalidateTag("budgets", "zeta");

  return { success: true, data: { applied, totalPaid } };
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd webapp && pnpm build`
Expected: Clean build (no type errors from the new action).

- [ ] **Step 4: Commit**

```bash
git add webapp/src/actions/extra-payment.ts
git commit -m "feat: add applyExtraDebtPayment server action with transfer pairs"
```

---

### Task 4: Sheet UI Component

**Files:**
- Create: `webapp/src/components/debt/extra-payment-sheet.tsx`

- [ ] **Step 1: Create the sheet component**

Create `webapp/src/components/debt/extra-payment-sheet.tsx`:

```typescript
"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { Banknote, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  allocateExtraPayment,
  computeExtraPaymentImpact,
  type DebtAccount,
  type ExtraPaymentAllocation,
  type ExtraPaymentImpact,
} from "@zeta/shared";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/currency";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { applyExtraDebtPayment } from "@/actions/extra-payment";
import type { CurrencyCode } from "@/types/domain";

type SourceAccount = {
  id: string;
  name: string;
  current_balance: number;
  currency_code: string;
};

interface ExtraPaymentSheetProps {
  debtAccounts: DebtAccount[];
  sourceAccounts: SourceAccount[];
  currency: CurrencyCode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExtraPaymentSheet({
  debtAccounts,
  sourceAccounts,
  currency,
  open,
  onOpenChange,
}: ExtraPaymentSheetProps) {
  const [totalAmount, setTotalAmount] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(debtAccounts.filter((a) => a.balance > 0).map((a) => a.id))
  );
  const [manualOverrides, setManualOverrides] = useState<Map<string, number>>(new Map());
  const [isPending, startTransition] = useTransition();

  const parsedAmount = useMemo(() => {
    const num = parseFloat(totalAmount.replace(/[^0-9.]/g, ""));
    return Number.isFinite(num) && num > 0 ? num : 0;
  }, [totalAmount]);

  const allocations = useMemo(() => {
    if (parsedAmount <= 0 || selectedIds.size === 0) return [];
    return allocateExtraPayment({
      totalAmount: parsedAmount,
      accounts: debtAccounts,
      selectedIds: [...selectedIds],
      manualOverrides: manualOverrides.size > 0 ? manualOverrides : undefined,
    });
  }, [parsedAmount, debtAccounts, selectedIds, manualOverrides]);

  const impact: ExtraPaymentImpact | null = useMemo(() => {
    if (allocations.length === 0 || parsedAmount <= 0) return null;
    return computeExtraPaymentImpact({ accounts: debtAccounts, allocations });
  }, [debtAccounts, allocations, parsedAmount]);

  const selectedSource = sourceAccounts.find((a) => a.id === sourceAccountId);
  const exceedsSourceBalance =
    selectedSource && parsedAmount > selectedSource.current_balance;

  const handleToggleAccount = useCallback((accountId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(accountId);
      else next.delete(accountId);
      return next;
    });
    // Remove manual override if unchecked
    if (!checked) {
      setManualOverrides((prev) => {
        const next = new Map(prev);
        next.delete(accountId);
        return next;
      });
    }
  }, []);

  const handleManualAmount = useCallback((accountId: string, value: string) => {
    const num = parseFloat(value.replace(/[^0-9.]/g, ""));
    setManualOverrides((prev) => {
      const next = new Map(prev);
      if (Number.isFinite(num) && num > 0) {
        next.set(accountId, num);
      } else {
        next.delete(accountId);
      }
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setManualOverrides(new Map());
  }, []);

  const handleApply = () => {
    if (!sourceAccountId || allocations.length === 0) return;

    startTransition(async () => {
      const result = await applyExtraDebtPayment({
        sourceAccountId,
        sourceAccountName: selectedSource?.name ?? "",
        allocations: allocations
          .filter((a) => a.allocatedAmount > 0)
          .map((a) => ({
            accountId: a.accountId,
            accountName: a.accountName,
            amount: a.allocatedAmount,
          })),
      });

      if (result.success) {
        toast.success(
          `${result.data.applied} pago${result.data.applied > 1 ? "s" : ""} registrado${result.data.applied > 1 ? "s" : ""} por ${formatCurrency(result.data.totalPaid, currency)}`
        );
        onOpenChange(false);
        // Reset state
        setTotalAmount("");
        setSourceAccountId("");
        setManualOverrides(new Map());
      } else {
        toast.error(result.error);
      }
    });
  };

  const activeDebts = debtAccounts.filter((a) => a.balance > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Pago extra de deuda</SheetTitle>
          <SheetDescription>
            Distribuye dinero extra entre tus deudas y ve el impacto.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          {/* ── Zone 1: Amount & Source ── */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="extra-amount">Monto disponible</Label>
              <Input
                id="extra-amount"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="text-lg font-semibold mt-1"
              />
            </div>

            <div>
              <Label htmlFor="source-account">Cuenta origen</Label>
              <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                <SelectTrigger id="source-account" className="mt-1">
                  <SelectValue placeholder="Selecciona cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {sourceAccounts.map((acct) => (
                    <SelectItem key={acct.id} value={acct.id}>
                      {acct.name} ({formatCurrency(acct.current_balance, acct.currency_code as CurrencyCode)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {exceedsSourceBalance && (
                <p className="text-xs text-amber-600 mt-1">
                  El monto supera el saldo de esta cuenta.
                </p>
              )}
            </div>
          </div>

          {/* ── Zone 2: Allocation ── */}
          {parsedAmount > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Distribución</h3>
                {manualOverrides.size > 0 && (
                  <button
                    onClick={handleReset}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <RotateCcw className="size-3" />
                    Resetear
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {activeDebts.map((account) => {
                  const alloc = allocations.find((a) => a.accountId === account.id);
                  const isSelected = selectedIds.has(account.id);

                  return (
                    <div
                      key={account.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleToggleAccount(account.id, checked === true)
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium truncate">
                            {account.name}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {account.interestRate
                              ? `${account.interestRate.toFixed(1)}% EA`
                              : "Sin tasa"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Saldo: {formatCurrency(account.balance, currency)}
                        </div>
                      </div>
                      {isSelected && (
                        <Input
                          type="text"
                          inputMode="numeric"
                          className="w-28 text-right text-sm"
                          value={
                            manualOverrides.has(account.id)
                              ? String(manualOverrides.get(account.id))
                              : alloc
                                ? String(Math.round(alloc.allocatedAmount))
                                : "0"
                          }
                          onChange={(e) => handleManualAmount(account.id, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Zone 3: Impact Preview ── */}
          {impact && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Impacto</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Ahorro mensual en intereses</p>
                  <p className="text-lg font-semibold text-emerald-600">
                    {formatCurrency(impact.monthlyInterestSaved, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(impact.monthlyInterestBefore, currency)} →{" "}
                    {formatCurrency(impact.monthlyInterestAfter, currency)}
                  </p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Meses menos de deuda</p>
                  <p className="text-lg font-semibold text-emerald-600">
                    {impact.monthsSaved > 0 ? `-${impact.monthsSaved}` : "0"} meses
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {impact.monthsToDebtFreeBefore} → {impact.monthsToDebtFreeAfter} meses
                  </p>
                </div>
              </div>
              {impact.totalInterestSavedOverLife > 0 && (
                <p className="text-sm text-emerald-600 font-medium text-center">
                  Te ahorras {formatCurrency(impact.totalInterestSavedOverLife, currency)} en intereses totales
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <SheetFooter>
          <Button
            onClick={handleApply}
            disabled={
              isPending ||
              parsedAmount <= 0 ||
              !sourceAccountId ||
              allocations.filter((a) => a.allocatedAmount > 0).length === 0
            }
            className={BRASS_BUTTON_CLASS}
          >
            {isPending ? (
              "Registrando..."
            ) : (
              <>
                <Check className="size-4" />
                Aplicar pagos
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={GHOST_BUTTON_CLASS}
          >
            Cerrar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd webapp && pnpm build`
Expected: Clean build. Component is not mounted yet, but types should all resolve.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/debt/extra-payment-sheet.tsx
git commit -m "feat: add ExtraPaymentSheet UI component"
```

---

### Task 5: Wire Sheet into Debt Page

**Files:**
- Modify: `webapp/src/app/(dashboard)/deudas/page.tsx`

- [ ] **Step 1: Create a client wrapper for the trigger button + sheet**

The sheet is a client component, but the debt page is a server component. We need a thin client wrapper that holds the open/close state and renders the trigger button + sheet.

Add a new file `webapp/src/components/debt/extra-payment-trigger.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExtraPaymentSheet } from "./extra-payment-sheet";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import type { DebtAccount } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

type SourceAccount = {
  id: string;
  name: string;
  current_balance: number;
  currency_code: string;
};

interface ExtraPaymentTriggerProps {
  debtAccounts: DebtAccount[];
  sourceAccounts: SourceAccount[];
  currency: CurrencyCode;
}

export function ExtraPaymentTrigger({
  debtAccounts,
  sourceAccounts,
  currency,
}: ExtraPaymentTriggerProps) {
  const [open, setOpen] = useState(false);

  const hasActiveDebt = debtAccounts.some((a) => a.balance > 0);
  if (!hasActiveDebt) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)} className={BRASS_BUTTON_CLASS}>
        <Banknote className="size-4" />
        Tengo plata extra
      </Button>
      <ExtraPaymentSheet
        debtAccounts={debtAccounts}
        sourceAccounts={sourceAccounts}
        currency={currency}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
```

- [ ] **Step 2: Modify the debt page to fetch source accounts and render trigger**

In `webapp/src/app/(dashboard)/deudas/page.tsx`:

Add import at top:
```typescript
import { getNonDebtAccounts } from "@/actions/extra-payment";
import { ExtraPaymentTrigger } from "@/components/debt/extra-payment-trigger";
```

In `DesktopDebtSection`, add `getNonDebtAccounts()` to the parallel fetch:
```typescript
const [overview, incomeEstimate, exchangeRateResult, sourceAccounts] = await Promise.all([
  getDebtOverview(currency),
  getEstimatedIncome(currency, month),
  getExchangeRate("USD" as CurrencyCode, currency).catch(() => null),
  getNonDebtAccounts(),
]);
```

Render the trigger after `DebtQuickStats` (before `SalaryBar`):
```typescript
<ExtraPaymentTrigger
  debtAccounts={overview.accounts}
  sourceAccounts={sourceAccounts}
  currency={currency}
/>
```

In `MobileDebtSection`, add `getNonDebtAccounts()` to the parallel fetch:
```typescript
const [overview, incomeEstimate, sourceAccounts] = await Promise.all([
  getDebtOverview(currency),
  getEstimatedIncome(currency, month),
  getNonDebtAccounts(),
]);
```

Pass `sourceAccounts` to `DeudasRoot` (it will forward to the trigger). Alternatively, render the trigger directly above `DeudasRoot`:
```typescript
<ExtraPaymentTrigger
  debtAccounts={overview.accounts}
  sourceAccounts={sourceAccounts}
  currency={currency}
/>
<DeudasRoot
  stats={stats}
  overview={overview}
  salaryBreakdown={salaryBreakdown}
  currency={currency}
/>
```

- [ ] **Step 3: Build verification**

Run: `cd webapp && pnpm build`
Expected: Clean build, no type errors.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/debt/extra-payment-trigger.tsx webapp/src/app/\(dashboard\)/deudas/page.tsx
git commit -m "feat: wire extra payment sheet into debt page"
```

---

### Task 6: Final Build Gate + Cleanup

- [ ] **Step 1: Run full test suite**

Run: `cd packages/shared && pnpm vitest run`
Expected: All tests pass, including the new extra-payment tests.

- [ ] **Step 2: Run production build**

Run: `cd webapp && pnpm build`
Expected: Clean build, zero errors.

- [ ] **Step 3: Manual smoke test checklist**

Verify by running `cd webapp && pnpm dev` and navigating to `/deudas`:
1. "Tengo plata extra" button appears when there are active debts
2. Sheet opens, shows amount input and source account dropdown
3. Entering an amount shows allocation rows with checkboxes
4. Unchecking an account redistributes its amount
5. Editing an amount locks it, remainder redistributes
6. "Resetear" clears overrides
7. Impact preview shows interest saved and months saved
8. "Aplicar pagos" creates transactions and shows success toast
9. Sheet closes, page refreshes with updated balances

- [ ] **Step 4: Final commit if any adjustments were made**

```bash
git add -u
git commit -m "chore: final polish for extra debt payment feature"
```
