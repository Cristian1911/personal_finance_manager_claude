# Debt Scenario Planner Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 3-tab debt simulator with a wizard-style scenario planner that supports future cash injections, interactive cascade control, side-by-side scenario comparison, and DB persistence — with correct EA compound interest calculations.

**Architecture:** Three PRs building bottom-up: (1) fix interest math + tighten types in `@zeta/shared`, (2) build the new scenario engine with tests, (3) DB migration + server actions + wizard UI. All calculation logic is pure TypeScript in `@zeta/shared`; the UI computes results client-side via `useMemo`; server actions handle persistence only.

**Tech Stack:** TypeScript, Vitest (new test setup for `@zeta/shared`), Next.js 15 App Router, React `useReducer`, Recharts, shadcn/ui, Supabase (migration + RLS), Zod validation.

**Spec:** `docs/superpowers/specs/2026-03-13-debt-scenario-planner-design.md`

---

## Chunk 1: PR 1 — EA Interest Fix + Type Tightening

This PR has standalone value — all existing debt calculations become more accurate, and loose `string` types become proper `CurrencyCode` enums.

### Task 1: Set up Vitest in `@zeta/shared`

**Files:**
- Create: `packages/shared/vitest.config.ts`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Install Vitest in the shared package**

```bash
cd packages/shared && pnpm add -D vitest
```

- [ ] **Step 2: Create Vitest config**

Create `packages/shared/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to `packages/shared/package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Verify Vitest runs**

```bash
cd packages/shared && pnpm test
```

Expected: 0 tests found, exits cleanly.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/vitest.config.ts packages/shared/package.json pnpm-lock.yaml
git commit -m "chore: set up Vitest in @zeta/shared"
```

---

### Task 2: Add `monthlyRateFromEA()` with tests

**Files:**
- Modify: `packages/shared/src/utils/debt.ts` (add function after `estimateMonthlyInterest`)
- Create: `packages/shared/src/utils/__tests__/debt.test.ts`

- [ ] **Step 1: Write the test file**

Create `packages/shared/src/utils/__tests__/debt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { monthlyRateFromEA, estimateMonthlyInterest } from "../debt";

describe("monthlyRateFromEA", () => {
  it("converts 0% EA to 0 monthly rate", () => {
    expect(monthlyRateFromEA(0)).toBe(0);
  });

  it("converts 28% EA to correct monthly rate", () => {
    // (1 + 0.28)^(1/12) - 1 ≈ 0.020785
    const monthly = monthlyRateFromEA(28);
    expect(monthly).toBeCloseTo(0.020785, 5);
  });

  it("converts 12% EA to correct monthly rate", () => {
    // (1 + 0.12)^(1/12) - 1 ≈ 0.009489
    const monthly = monthlyRateFromEA(12);
    expect(monthly).toBeCloseTo(0.009489, 5);
  });

  it("produces lower monthly rate than nominal rate / 12", () => {
    // EA is the effective annual rate. Converting to monthly via compound
    // gives a LOWER monthly rate than nominal/12 (which overstates).
    // EA monthly = (1.28)^(1/12)-1 ≈ 2.079% < 28/12 ≈ 2.333%
    const eaMonthly = monthlyRateFromEA(28);
    const nominalMonthly = 0.28 / 12;
    expect(eaMonthly).toBeLessThan(nominalMonthly);
  });
});

describe("estimateMonthlyInterest (with EA fix)", () => {
  it("returns 0 for zero balance", () => {
    expect(estimateMonthlyInterest(0, 28)).toBe(0);
  });

  it("returns 0 for null rate", () => {
    expect(estimateMonthlyInterest(5_000_000, null)).toBe(0);
  });

  it("computes correct monthly interest for 5M COP at 28% EA", () => {
    // 5_000_000 * monthlyRateFromEA(28) ≈ 103,924
    const interest = estimateMonthlyInterest(5_000_000, 28);
    expect(interest).toBeCloseTo(103_924, -1); // within ~10 COP
  });

  it("produces less than the old nominal/12 formula", () => {
    // EA is the effective annual rate. Converting to monthly via compound
    // gives a LOWER per-month rate than nominal/12 (which overstated).
    // EA monthly = (1.28)^(1/12)-1 ≈ 2.079% < 28/12 ≈ 2.333%
    const eaInterest = estimateMonthlyInterest(5_000_000, 28);
    const oldNominal = (5_000_000 * 0.28) / 12; // ≈ 116,667
    expect(eaInterest).toBeLessThan(oldNominal);
  });
});
```

- [ ] **Step 2: Run the tests — they should fail**

```bash
cd packages/shared && pnpm test
```

Expected: FAIL — `monthlyRateFromEA` is not exported from `../debt`.

- [ ] **Step 3: Add `monthlyRateFromEA` and update `estimateMonthlyInterest`**

In `packages/shared/src/utils/debt.ts`, add after line 220 (after the `estimateMonthlyInterest` function):

```typescript
/**
 * Convert an annual effective rate (EA) to a monthly effective rate.
 * Colombian banks quote rates as EA (Efectivo Anual).
 * Formula: monthly = (1 + EA/100)^(1/12) - 1
 */
export function monthlyRateFromEA(eaPercent: number): number {
  if (eaPercent <= 0) return 0;
  return Math.pow(1 + eaPercent / 100, 1 / 12) - 1;
}
```

Then update `estimateMonthlyInterest` (currently at line 214-220) to use it:

```typescript
export function estimateMonthlyInterest(
  balance: number,
  annualRate: number | null
): number {
  if (!annualRate || annualRate <= 0 || balance <= 0) return 0;
  return balance * monthlyRateFromEA(annualRate);
}
```

- [ ] **Step 4: Run tests — they should pass**

```bash
cd packages/shared && pnpm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/debt.ts packages/shared/src/utils/__tests__/debt.test.ts
git commit -m "feat: add monthlyRateFromEA and fix estimateMonthlyInterest to use EA compound conversion"
```

---

### Task 3: Update `debt-simulator.ts` to use EA conversion

**Files:**
- Modify: `packages/shared/src/utils/debt-simulator.ts` (lines 95, 203, 224, 279)
- Create: `packages/shared/src/utils/__tests__/debt-simulator.test.ts`

- [ ] **Step 1: Write tests for the existing simulation functions with EA math**

Create `packages/shared/src/utils/__tests__/debt-simulator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  runSimulation,
  simulateSingleAccount,
  allocateLumpSum,
  compareStrategies,
} from "../debt-simulator";
import { monthlyRateFromEA } from "../debt";
import type { DebtAccount } from "../debt";

function makeAccount(overrides: Partial<DebtAccount> = {}): DebtAccount {
  return {
    id: "acc-1",
    name: "Tarjeta Visa",
    type: "CREDIT_CARD",
    balance: 5_000_000,
    creditLimit: 10_000_000,
    interestRate: 28,
    monthlyPayment: 250_000,
    paymentDay: 15,
    cutoffDay: 5,
    currency: "COP",
    color: null,
    institutionName: "Bancolombia",
    currencyBreakdown: null,
    ...overrides,
  };
}

describe("runSimulation (EA interest)", () => {
  it("accrues interest using EA compound rate, not nominal/12", () => {
    const acc = makeAccount({ balance: 1_000_000, interestRate: 28, monthlyPayment: 500_000 });
    const result = runSimulation({
      accounts: [acc],
      extraMonthlyPayment: 0,
      strategy: "avalanche",
    });

    // After month 1: interest = 1_000_000 * monthlyRateFromEA(28)
    const expectedInterest = 1_000_000 * monthlyRateFromEA(28);
    expect(result.timeline[0].interestPaid).toBeCloseTo(expectedInterest, 0);
  });

  it("eventually pays off all debts", () => {
    const acc = makeAccount({ balance: 500_000, monthlyPayment: 100_000 });
    const result = runSimulation({
      accounts: [acc],
      extraMonthlyPayment: 50_000,
      strategy: "avalanche",
    });
    expect(result.totalMonths).toBeLessThan(10);
    expect(result.payoffOrder).toHaveLength(1);
  });
});

describe("allocateLumpSum (EA interest)", () => {
  it("calculates interest savings using EA rate", () => {
    const acc = makeAccount({ balance: 2_000_000, interestRate: 28 });
    const result = allocateLumpSum([acc], 1_000_000, "COP");

    const monthlyBefore = 2_000_000 * monthlyRateFromEA(28);
    const monthlyAfter = 1_000_000 * monthlyRateFromEA(28);

    expect(result.totalMonthlyInterestBefore).toBeCloseTo(monthlyBefore, 0);
    expect(result.totalMonthlyInterestAfter).toBeCloseTo(monthlyAfter, 0);
    expect(result.totalMonthlyInterestSaved).toBeCloseTo(monthlyBefore - monthlyAfter, 0);
  });
});

describe("simulateSingleAccount (EA interest)", () => {
  it("uses EA compound rate for interest accrual", () => {
    const acc = makeAccount({ balance: 1_000_000, interestRate: 28, monthlyPayment: 200_000 });
    const result = simulateSingleAccount(acc, 100_000);

    expect(result.monthsWithExtra).toBeLessThan(result.monthsWithoutExtra);
    expect(result.interestSaved).toBeGreaterThan(0);
  });
});

describe("compareStrategies", () => {
  it("returns baseline with 0 extra payment", () => {
    const accounts = [
      makeAccount({ id: "a1", balance: 500_000, interestRate: 28, monthlyPayment: 100_000 }),
      makeAccount({ id: "a2", balance: 1_000_000, interestRate: 20, monthlyPayment: 150_000 }),
    ];
    const result = compareStrategies(accounts, 200_000);

    expect(result.baseline.totalMonths).toBeGreaterThan(result.snowball.totalMonths);
    expect(result.baseline.totalMonths).toBeGreaterThan(result.avalanche.totalMonths);
    expect(result.bestStrategy).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests — they should fail**

```bash
cd packages/shared && pnpm test
```

Expected: FAIL — interest calculations in `debt-simulator.ts` still use `(rate / 100) / 12`.

- [ ] **Step 3: Update all interest calculations in `debt-simulator.ts`**

Import `monthlyRateFromEA` at the top of `packages/shared/src/utils/debt-simulator.ts`:

```typescript
import { monthlyRateFromEA } from "./debt";
import type { DebtAccount } from "./debt";
```

Then replace the 4 interest calculation sites:

**Line 95** (inside `runSimulation`, accrue interest loop):
```typescript
// OLD: const interest = (balances[a.id] * (rate / 100)) / 12;
// NEW:
const interest = balances[a.id] * monthlyRateFromEA(rate);
```

**Line 203** (inside `allocateLumpSum`, monthlyBefore):
```typescript
// OLD: const monthlyBefore = (a.balance * (rate / 100)) / 12;
// NEW:
const monthlyBefore = a.balance * monthlyRateFromEA(rate);
```

**Line 224** (inside `allocateLumpSum`, monthlyAfter):
```typescript
// OLD: const monthlyAfter = (newBalance * (rate / 100)) / 12;
// NEW:
const monthlyAfter = newBalance * monthlyRateFromEA(rate);
```

**Line 279** (inside `simulateSingleAccount`, inner `simulate`):
```typescript
// OLD: const interest = (balance * (rate / 100)) / 12;
// NEW:
const interest = balance * monthlyRateFromEA(rate);
```

- [ ] **Step 4: Run tests — they should pass**

```bash
cd packages/shared && pnpm test
```

Expected: All tests PASS.

- [ ] **Step 5: Build the webapp to confirm no regressions**

```bash
cd webapp && pnpm build
```

Expected: Clean build. The debt dashboard and simulator both import from `@zeta/shared` so they pick up the fix automatically.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/utils/debt-simulator.ts packages/shared/src/utils/__tests__/debt-simulator.test.ts
git commit -m "feat: update all simulator functions to use EA compound interest"
```

---

### Task 4: Tighten `currency: string` → `CurrencyCode`

**Files:**
- Modify: `packages/shared/src/utils/debt.ts` (interfaces at lines 19, 36, 43)
- Modify: `packages/shared/src/utils/debt-simulator.ts` (interface at line 168, function param at line 189)

- [ ] **Step 1: Update `CurrencyDebt.currency` to `CurrencyCode`**

In `packages/shared/src/utils/debt.ts`, add the import and update the interface:

```typescript
// At top, add CurrencyCode to the import:
import type { Account, CurrencyCode } from "../types/domain";

// Line 19: change currency: string → currency: CurrencyCode
export interface CurrencyDebt {
  currency: CurrencyCode;
  // ... rest unchanged
}
```

- [ ] **Step 2: Update `DebtAccount.currency` to `CurrencyCode`**

```typescript
// Line 36: change currency: string → currency: CurrencyCode
export interface DebtAccount {
  // ... other fields unchanged
  currency: CurrencyCode;
  // ...
}
```

- [ ] **Step 3: Update `DebtByCurrency.currency` to `CurrencyCode`**

```typescript
// Line 43: change currency: string → currency: CurrencyCode
export interface DebtByCurrency {
  currency: CurrencyCode;
  // ...
}
```

- [ ] **Step 4: Update `LumpSumAllocation.currency` in `debt-simulator.ts`**

In `packages/shared/src/utils/debt-simulator.ts`:

```typescript
// Add import at top:
import { monthlyRateFromEA } from "./debt";
import type { DebtAccount, CurrencyCode } from "./debt";

// Line 168: change currency: string → currency: CurrencyCode
export interface LumpSumAllocation {
  // ...
  currency: CurrencyCode;
  // ...
}

// Line 189: change currency?: string → currency?: CurrencyCode
export function allocateLumpSum(
  accounts: DebtAccount[],
  lumpSum: number,
  currency?: CurrencyCode
): LumpSumResult {
```

- [ ] **Step 5: Fix `extractDebtAccounts` currency assignment**

In `packages/shared/src/utils/debt.ts`, the `extractDebtAccounts` function assigns `currency: a.currency_code`. The `Account` type's `currency_code` field comes from the database and is already typed as `Database["public"]["Enums"]["currency_code"]` which equals `CurrencyCode`. Verify this compiles — if `a.currency_code` is already `CurrencyCode`, no cast needed. If it's `string`, add `as CurrencyCode`.

Also in the multi-currency breakdown loop (line 148-154), `currency` is a `string` key from `Object.keys(balances)`. This needs a cast:

```typescript
breakdown.push({
  currency: currency as CurrencyCode,
  // ...
});
```

- [ ] **Step 6: Build to check for type errors**

```bash
cd webapp && pnpm build
```

Expected: May surface `as CurrencyCode` casts elsewhere that are now unnecessary, or new type errors where `string` is assigned to `CurrencyCode`. Fix any that appear.

- [ ] **Step 7: Run shared tests**

```bash
cd packages/shared && pnpm test
```

Expected: All tests PASS (tests use `"COP"` which is a valid `CurrencyCode` literal).

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/utils/debt.ts packages/shared/src/utils/debt-simulator.ts
git commit -m "refactor: tighten currency fields from string to CurrencyCode in shared debt types"
```

---

### Task 5: Delete dead-code local copies

**Files:**
- Delete: `webapp/src/lib/utils/debt.ts`
- Delete: `webapp/src/lib/utils/debt-simulator.ts`

- [ ] **Step 1: Verify nothing imports from the local copies**

```bash
cd webapp && grep -r "from.*lib/utils/debt" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Expected: No results (everything imports from `@zeta/shared`).

- [ ] **Step 2: Delete the files**

```bash
rm webapp/src/lib/utils/debt.ts webapp/src/lib/utils/debt-simulator.ts
```

- [ ] **Step 3: Build to confirm nothing breaks**

```bash
cd webapp && pnpm build
```

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add -u webapp/src/lib/utils/debt.ts webapp/src/lib/utils/debt-simulator.ts
git commit -m "chore: delete dead-code local copies of debt utils (already in @zeta/shared)"
```

---

## Chunk 2: PR 2 — Scenario Engine + Types + Validators

### Task 6: Add scenario types to `@zeta/shared`

**Files:**
- Create: `packages/shared/src/utils/scenario-types.ts`
- Modify: `packages/shared/src/index.ts` (add export)

- [ ] **Step 1: Create the types file**

Create `packages/shared/src/utils/scenario-types.ts`:

```typescript
import type { CurrencyCode } from "../types/domain";
import type { DebtAccount } from "./debt";

export type ScenarioStrategy = "snowball" | "avalanche" | "custom";

export interface CashEntry {
  id: string;
  amount: number;
  month: string; // "YYYY-MM"
  label?: string;
  currency: CurrencyCode;
  recurring?: { months: number };
}

export interface ManualOverride {
  month: string;
  cashEntryId: string;
  accountId: string;
  amount: number;
}

export interface CascadeRedirect {
  fromAccountId: string;
  toAccountId: string;
}

export interface ScenarioAllocations {
  manualOverrides: ManualOverride[];
  cascadeRedirects: CascadeRedirect[];
  customPriority?: string[];
}

export interface ScenarioEvent {
  type: "cash_injection" | "account_paid_off" | "cascade_redirect";
  description: string;
  accountId?: string;
  amount?: number;
  fromAccountId?: string;
  toAccountId?: string;
  freedAmount?: number;
}

export interface ScenarioMonthAccount {
  accountId: string;
  balanceBefore: number;
  interestAccrued: number;
  minimumPaymentApplied: number;
  extraPaymentApplied: number;
  cascadePaymentApplied: number;
  balanceAfter: number;
  paidOff: boolean;
}

export interface ScenarioMonth {
  month: number;
  calendarMonth: string; // "YYYY-MM"
  totalBalance: number;
  cumulativeInterest: number;
  accounts: ScenarioMonthAccount[];
  events: ScenarioEvent[];
}

export interface ScenarioPayoffEntry {
  accountId: string;
  accountName: string;
  month: number;
  calendarMonth: string;
}

export interface ScenarioResult {
  totalMonths: number;
  totalInterestPaid: number;
  totalAmountPaid: number;
  debtFreeDate: string;
  payoffOrder: ScenarioPayoffEntry[];
  timeline: ScenarioMonth[];
}

export interface ScenarioInput {
  accounts: DebtAccount[];
  cashEntries: CashEntry[];
  strategy: ScenarioStrategy;
  allocations: ScenarioAllocations;
  startMonth: string;
}
```

- [ ] **Step 2: Export from index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from "./utils/scenario-types";
```

- [ ] **Step 3: Build**

```bash
cd webapp && pnpm build
```

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/utils/scenario-types.ts packages/shared/src/index.ts
git commit -m "feat: add scenario planner types to @zeta/shared"
```

---

### Task 7: Implement `expandCashEntries()` with tests

**Files:**
- Create: `packages/shared/src/utils/scenario-engine.ts`
- Create: `packages/shared/src/utils/__tests__/scenario-engine.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/shared/src/utils/__tests__/scenario-engine.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { expandCashEntries } from "../scenario-engine";
import type { CashEntry } from "../scenario-types";

describe("expandCashEntries", () => {
  it("returns non-recurring entries unchanged", () => {
    const entries: CashEntry[] = [
      { id: "e1", amount: 2_000_000, month: "2026-04", currency: "COP" },
    ];
    const result = expandCashEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].month).toBe("2026-04");
  });

  it("expands a recurring entry into individual months", () => {
    const entries: CashEntry[] = [
      { id: "e1", amount: 500_000, month: "2026-04", currency: "COP", recurring: { months: 3 } },
    ];
    const result = expandCashEntries(entries);
    expect(result).toHaveLength(3);
    expect(result[0].month).toBe("2026-04");
    expect(result[1].month).toBe("2026-05");
    expect(result[2].month).toBe("2026-06");
    // Each expanded entry should NOT have recurring
    expect(result[0].recurring).toBeUndefined();
  });

  it("handles year boundary correctly", () => {
    const entries: CashEntry[] = [
      { id: "e1", amount: 100_000, month: "2026-11", currency: "COP", recurring: { months: 3 } },
    ];
    const result = expandCashEntries(entries);
    expect(result[0].month).toBe("2026-11");
    expect(result[1].month).toBe("2026-12");
    expect(result[2].month).toBe("2027-01");
  });

  it("preserves label across expanded entries", () => {
    const entries: CashEntry[] = [
      { id: "e1", amount: 500_000, month: "2026-04", label: "Freelance", currency: "COP", recurring: { months: 2 } },
    ];
    const result = expandCashEntries(entries);
    expect(result[0].label).toBe("Freelance");
    expect(result[1].label).toBe("Freelance");
  });

  it("mixes recurring and non-recurring entries", () => {
    const entries: CashEntry[] = [
      { id: "e1", amount: 2_000_000, month: "2026-04", currency: "COP" },
      { id: "e2", amount: 500_000, month: "2026-04", currency: "COP", recurring: { months: 2 } },
    ];
    const result = expandCashEntries(entries);
    expect(result).toHaveLength(3); // 1 + 2
  });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
cd packages/shared && pnpm test -- scenario-engine
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `expandCashEntries`**

Create `packages/shared/src/utils/scenario-engine.ts`:

```typescript
/**
 * Debt scenario planning engine.
 * Builds on the existing simulation functions with support for:
 * - Time-sequenced cash injections
 * - Manual allocation overrides
 * - Interactive cascade control
 * - Calendar-month timeline
 */

import type { DebtAccount } from "./debt";
import { monthlyRateFromEA } from "./debt";
import type {
  CashEntry,
  ScenarioInput,
  ScenarioResult,
  ScenarioMonth,
  ScenarioEvent,
  ScenarioAllocations,
  ScenarioStrategy,
  ScenarioMonthAccount,
  ScenarioPayoffEntry,
} from "./scenario-types";

/**
 * Expand recurring CashEntry items into individual monthly entries.
 * Call this before passing entries to runScenario().
 */
export function expandCashEntries(entries: CashEntry[]): CashEntry[] {
  const result: CashEntry[] = [];

  for (const entry of entries) {
    if (!entry.recurring || entry.recurring.months <= 1) {
      // Non-recurring or single month — pass through without recurring field
      const { recurring, ...rest } = entry;
      result.push(rest);
      continue;
    }

    const [yearStr, monthStr] = entry.month.split("-");
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10);

    for (let i = 0; i < entry.recurring.months; i++) {
      const m = String(month).padStart(2, "0");
      result.push({
        id: `${entry.id}-${i}`,
        amount: entry.amount,
        month: `${year}-${m}`,
        label: entry.label,
        currency: entry.currency,
      });

      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
  }

  return result;
}
```

- [ ] **Step 4: Run test — should pass**

```bash
cd packages/shared && pnpm test -- scenario-engine
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/scenario-engine.ts packages/shared/src/utils/__tests__/scenario-engine.test.ts
git commit -m "feat: add expandCashEntries utility for recurring cash entry expansion"
```

---

### Task 8: Implement currency-aware `getMinimumPayment()`

This is extracted as a module-level exported function so the scenario engine can use it.

**Files:**
- Modify: `packages/shared/src/utils/scenario-engine.ts` (add function)
- Modify: `packages/shared/src/utils/__tests__/scenario-engine.test.ts` (add tests)

- [ ] **Step 1: Write tests**

Add to `packages/shared/src/utils/__tests__/scenario-engine.test.ts`:

```typescript
import { expandCashEntries, getMinPayment } from "../scenario-engine";
import type { DebtAccount } from "../debt";

function makeAccount(overrides: Partial<DebtAccount> = {}): DebtAccount {
  return {
    id: "acc-1",
    name: "Tarjeta Visa",
    type: "CREDIT_CARD",
    balance: 5_000_000,
    creditLimit: 10_000_000,
    interestRate: 28,
    monthlyPayment: null,
    paymentDay: 15,
    cutoffDay: 5,
    currency: "COP",
    color: null,
    institutionName: null,
    currencyBreakdown: null,
    ...overrides,
  };
}

describe("getMinPayment", () => {
  it("uses monthlyPayment when set", () => {
    const acc = makeAccount({ monthlyPayment: 300_000 });
    expect(getMinPayment(acc)).toBe(300_000);
  });

  it("falls back to 5% of balance for COP", () => {
    const acc = makeAccount({ balance: 2_000_000, monthlyPayment: null, currency: "COP" });
    // 5% of 2M = 100,000 > floor of 50,000
    expect(getMinPayment(acc)).toBe(100_000);
  });

  it("uses COP floor of 50,000 when 5% is less", () => {
    const acc = makeAccount({ balance: 500_000, monthlyPayment: null, currency: "COP" });
    // 5% of 500K = 25,000 < floor of 50,000
    expect(getMinPayment(acc)).toBe(50_000);
  });

  it("uses USD floor of 25 when 5% is less", () => {
    const acc = makeAccount({ balance: 200, monthlyPayment: null, currency: "USD" });
    // 5% of 200 = 10 < floor of 25
    expect(getMinPayment(acc)).toBe(25);
  });

  it("uses 5% for USD when balance is high enough", () => {
    const acc = makeAccount({ balance: 1_000, monthlyPayment: null, currency: "USD" });
    // 5% of 1000 = 50 > floor of 25
    expect(getMinPayment(acc)).toBe(50);
  });
});
```

- [ ] **Step 2: Run — should fail**

```bash
cd packages/shared && pnpm test -- scenario-engine
```

Expected: FAIL — `getMinPayment` not exported.

- [ ] **Step 3: Implement `getMinPayment`**

Add to `packages/shared/src/utils/scenario-engine.ts`:

```typescript
const MIN_PAYMENT_RATE = 0.05;
const MIN_PAYMENT_FLOORS: Record<string, number> = {
  COP: 50_000,
  USD: 25,
  EUR: 25,
  BRL: 100,
  MXN: 500,
  PEN: 50,
  CLP: 15_000,
  ARS: 5_000,
};
const DEFAULT_FLOOR = 50_000;

/**
 * Get the minimum monthly payment for an account.
 * Uses the account's monthlyPayment if set, otherwise falls back to
 * 5% of balance with a currency-aware floor.
 */
export function getMinPayment(account: DebtAccount): number {
  if (account.monthlyPayment && account.monthlyPayment > 0) {
    return account.monthlyPayment;
  }
  const floor = MIN_PAYMENT_FLOORS[account.currency] ?? DEFAULT_FLOOR;
  return Math.max(account.balance * MIN_PAYMENT_RATE, floor);
}
```

- [ ] **Step 4: Run — should pass**

```bash
cd packages/shared && pnpm test -- scenario-engine
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/scenario-engine.ts packages/shared/src/utils/__tests__/scenario-engine.test.ts
git commit -m "feat: add currency-aware getMinPayment for scenario engine"
```

---

### Task 9: Implement `runScenario()` — core algorithm

This is the most complex task. The algorithm is described in the spec under "Algorithm (per-month loop, max 360 months)".

**Files:**
- Modify: `packages/shared/src/utils/scenario-engine.ts`
- Modify: `packages/shared/src/utils/__tests__/scenario-engine.test.ts`

- [ ] **Step 1: Write tests for `runScenario`**

Add to the test file:

```typescript
import { expandCashEntries, getMinPayment, runScenario } from "../scenario-engine";
import { monthlyRateFromEA } from "../debt";

describe("runScenario", () => {
  const accounts: DebtAccount[] = [
    makeAccount({ id: "visa", name: "Visa", balance: 2_000_000, interestRate: 28, monthlyPayment: 150_000 }),
    makeAccount({ id: "master", name: "Master", balance: 3_000_000, interestRate: 22, monthlyPayment: 200_000 }),
  ];

  it("with no cash entries, only pays minimums", () => {
    const result = runScenario({
      accounts,
      cashEntries: [],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    expect(result.totalMonths).toBeGreaterThan(0);
    expect(result.timeline[0].calendarMonth).toBe("2026-04");
    expect(result.debtFreeDate).toBeDefined();
  });

  it("cash injection reduces total months vs baseline", () => {
    const baseline = runScenario({
      accounts,
      cashEntries: [],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    const withCash = runScenario({
      accounts,
      cashEntries: [
        { id: "e1", amount: 2_000_000, month: "2026-05", currency: "COP" },
      ],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    expect(withCash.totalMonths).toBeLessThan(baseline.totalMonths);
    expect(withCash.totalInterestPaid).toBeLessThan(baseline.totalInterestPaid);
  });

  it("avalanche prioritizes highest rate account", () => {
    const result = runScenario({
      accounts,
      cashEntries: [
        { id: "e1", amount: 1_000_000, month: "2026-04", currency: "COP" },
      ],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    // Visa (28%) should get paid off before Master (22%)
    const visaPayoff = result.payoffOrder.find((p) => p.accountId === "visa");
    const masterPayoff = result.payoffOrder.find((p) => p.accountId === "master");
    expect(visaPayoff!.month).toBeLessThanOrEqual(masterPayoff!.month);
  });

  it("snowball prioritizes lowest balance account", () => {
    const result = runScenario({
      accounts,
      cashEntries: [
        { id: "e1", amount: 1_000_000, month: "2026-04", currency: "COP" },
      ],
      strategy: "snowball",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    // Visa (2M, lower balance) should get paid off before Master (3M)
    const visaPayoff = result.payoffOrder.find((p) => p.accountId === "visa");
    const masterPayoff = result.payoffOrder.find((p) => p.accountId === "master");
    expect(visaPayoff!.month).toBeLessThanOrEqual(masterPayoff!.month);
  });

  it("records cash injection events", () => {
    const result = runScenario({
      accounts,
      cashEntries: [
        { id: "e1", amount: 2_000_000, month: "2026-05", label: "Prima", currency: "COP" },
      ],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    // Month 2 = 2026-05
    const month2 = result.timeline.find((m) => m.calendarMonth === "2026-05");
    const injectionEvent = month2?.events.find((e) => e.type === "cash_injection");
    expect(injectionEvent).toBeDefined();
    expect(injectionEvent!.amount).toBe(2_000_000);
  });

  it("records cascade events when an account is paid off", () => {
    // Give Visa a small balance so it gets paid off quickly
    const smallVisa = makeAccount({ id: "visa", name: "Visa", balance: 200_000, interestRate: 28, monthlyPayment: 150_000 });
    const result = runScenario({
      accounts: [smallVisa, accounts[1]],
      cashEntries: [
        { id: "e1", amount: 500_000, month: "2026-04", currency: "COP" },
      ],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    const payoffEvent = result.timeline.flatMap((m) => m.events).find(
      (e) => e.type === "account_paid_off" && e.accountId === "visa"
    );
    expect(payoffEvent).toBeDefined();
  });

  it("respects manual overrides", () => {
    const result = runScenario({
      accounts,
      cashEntries: [
        { id: "e1", amount: 1_000_000, month: "2026-04", currency: "COP" },
      ],
      strategy: "avalanche",
      allocations: {
        manualOverrides: [
          { month: "2026-04", cashEntryId: "e1", accountId: "master", amount: 1_000_000 },
        ],
        cascadeRedirects: [],
      },
      startMonth: "2026-04",
    });

    // Master should have received the 1M override in month 1
    const month1 = result.timeline[0];
    const masterDetail = month1.accounts.find((a) => a.accountId === "master");
    expect(masterDetail!.extraPaymentApplied).toBe(1_000_000);
  });

  it("respects cascade redirects", () => {
    const smallVisa = makeAccount({ id: "visa", name: "Visa", balance: 100_000, interestRate: 28, monthlyPayment: 150_000 });
    const result = runScenario({
      accounts: [smallVisa, accounts[1]],
      cashEntries: [
        { id: "e1", amount: 500_000, month: "2026-04", currency: "COP" },
      ],
      strategy: "avalanche",
      allocations: {
        manualOverrides: [],
        cascadeRedirects: [
          { fromAccountId: "visa", toAccountId: "master" },
        ],
      },
      startMonth: "2026-04",
    });

    // Visa pays off quickly → its freed minimum goes to Master (via redirect)
    const cascadeEvent = result.timeline.flatMap((m) => m.events).find(
      (e) => e.type === "cascade_redirect" && e.fromAccountId === "visa"
    );
    expect(cascadeEvent).toBeDefined();
    expect(cascadeEvent!.toAccountId).toBe("master");
  });

  it("timeline uses correct calendar months", () => {
    const result = runScenario({
      accounts: [makeAccount({ balance: 500_000, monthlyPayment: 200_000 })],
      cashEntries: [],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-11",
    });

    expect(result.timeline[0].calendarMonth).toBe("2026-11");
    if (result.timeline.length > 1) {
      expect(result.timeline[1].calendarMonth).toBe("2026-12");
    }
    if (result.timeline.length > 2) {
      expect(result.timeline[2].calendarMonth).toBe("2027-01");
    }
  });
});
```

- [ ] **Step 2: Run tests — should fail**

```bash
cd packages/shared && pnpm test -- scenario-engine
```

Expected: FAIL — `runScenario` not exported.

- [ ] **Step 3: Implement `runScenario`**

Add to `packages/shared/src/utils/scenario-engine.ts`:

```typescript
const MAX_MONTHS = 360;

/**
 * Advance a "YYYY-MM" string by `offset` months.
 */
function advanceMonth(startMonth: string, offset: number): string {
  const [y, m] = startMonth.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + offset;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

/**
 * Get the priority account for extra/cascade payments based on strategy.
 */
function getScenarioPriority(
  balances: Record<string, number>,
  accounts: DebtAccount[],
  strategy: ScenarioStrategy,
  customPriority?: string[]
): string | null {
  const active = accounts.filter((a) => (balances[a.id] ?? 0) > 0.01);
  if (active.length === 0) return null;

  if (strategy === "custom" && customPriority) {
    for (const id of customPriority) {
      if ((balances[id] ?? 0) > 0.01) return id;
    }
    return null;
  }

  if (strategy === "snowball") {
    active.sort((a, b) => (balances[a.id] ?? 0) - (balances[b.id] ?? 0));
  } else {
    // avalanche (default)
    active.sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
  }
  return active[0].id;
}

function formatAmount(amount: number, currency: string): string {
  const symbol = currency === "USD" || currency === "EUR" ? currency + " " : "$";
  return symbol + Math.round(amount).toLocaleString("es-CO");
}

/**
 * Run a full scenario simulation with cash entries, manual overrides,
 * and cascade control.
 */
export function runScenario(input: ScenarioInput): ScenarioResult {
  const { accounts, cashEntries, strategy, allocations, startMonth } = input;

  const currency = accounts[0]?.currency ?? "COP";

  // Initialize balances
  const balances: Record<string, number> = {};
  for (const a of accounts) {
    balances[a.id] = a.balance;
  }

  const timeline: ScenarioMonth[] = [];
  const payoffOrder: ScenarioPayoffEntry[] = [];
  let cumulativeInterest = 0;
  let totalAmountPaid = 0;
  const paidOffAccounts = new Set<string>();

  // Group cash entries by month for O(1) lookup
  const cashByMonth = new Map<string, CashEntry[]>();
  for (const ce of cashEntries) {
    const existing = cashByMonth.get(ce.month) ?? [];
    existing.push(ce);
    cashByMonth.set(ce.month, existing);
  }

  for (let monthIdx = 0; monthIdx < MAX_MONTHS; monthIdx++) {
    const totalBefore = Object.values(balances).reduce((s, b) => s + Math.max(b, 0), 0);
    if (totalBefore <= 0.01) break;

    const calendarMonth = advanceMonth(startMonth, monthIdx);
    const monthNum = monthIdx + 1;
    const events: ScenarioEvent[] = [];
    const accountDetails: ScenarioMonthAccount[] = [];

    // Track per-account payments for this month
    const monthPayments: Record<string, { minimum: number; extra: number; cascade: number }> = {};
    for (const a of accounts) {
      monthPayments[a.id] = { minimum: 0, extra: 0, cascade: 0 };
    }

    // Snapshot balances before
    const balancesBefore: Record<string, number> = {};
    const interestAccrued: Record<string, number> = {};
    for (const a of accounts) {
      balancesBefore[a.id] = balances[a.id];
      interestAccrued[a.id] = 0;
    }

    // 1. Accrue interest
    let monthInterest = 0;
    for (const a of accounts) {
      if (balances[a.id] <= 0.01) continue;
      const rate = a.interestRate ?? 0;
      const interest = balances[a.id] * monthlyRateFromEA(rate);
      balances[a.id] += interest;
      interestAccrued[a.id] = interest;
      monthInterest += interest;
    }
    // Update balancesBefore to post-interest (for accurate tracking)
    for (const a of accounts) {
      balancesBefore[a.id] = balances[a.id];
    }

    // 2. Pay minimums — track freed minimums
    let freedMinimums = 0;
    const newlyPaidOff: string[] = [];

    for (const a of accounts) {
      if (paidOffAccounts.has(a.id) || balances[a.id] <= 0.01) {
        if (paidOffAccounts.has(a.id)) {
          freedMinimums += getMinPayment(a);
        }
        continue;
      }

      const minPay = Math.min(getMinPayment(a), balances[a.id]);
      balances[a.id] -= minPay;
      monthPayments[a.id].minimum = minPay;
      totalAmountPaid += minPay;

      if (balances[a.id] <= 0.01) {
        balances[a.id] = 0;
        paidOffAccounts.add(a.id);
        newlyPaidOff.push(a.id);
        payoffOrder.push({
          accountId: a.id,
          accountName: a.name,
          month: monthNum,
          calendarMonth,
        });
        events.push({
          type: "account_paid_off",
          description: `${a.name} liquidada`,
          accountId: a.id,
        });
        freedMinimums += getMinPayment(a);
      }
    }

    // 3. Apply cash entries for this month
    const monthCash = cashByMonth.get(calendarMonth) ?? [];
    let unallocatedCash = 0;

    for (const ce of monthCash) {
      events.push({
        type: "cash_injection",
        description: ce.label
          ? `Inyección de ${formatAmount(ce.amount, currency)} (${ce.label})`
          : `Inyección de ${formatAmount(ce.amount, currency)}`,
        amount: ce.amount,
      });

      // Check manual overrides for this cash entry
      const override = allocations.manualOverrides.find(
        (o) => o.month === calendarMonth && o.cashEntryId === ce.id
      );

      if (override) {
        const targetBal = balances[override.accountId] ?? 0;
        if (targetBal > 0.01) {
          const payment = Math.min(override.amount, targetBal);
          balances[override.accountId] -= payment;
          monthPayments[override.accountId].extra += payment;
          totalAmountPaid += payment;
          unallocatedCash += ce.amount - payment;

          if (balances[override.accountId] <= 0.01) {
            balances[override.accountId] = 0;
            if (!paidOffAccounts.has(override.accountId)) {
              paidOffAccounts.add(override.accountId);
              newlyPaidOff.push(override.accountId);
              const acct = accounts.find((a) => a.id === override.accountId)!;
              payoffOrder.push({
                accountId: override.accountId,
                accountName: acct.name,
                month: monthNum,
                calendarMonth,
              });
              events.push({
                type: "account_paid_off",
                description: `${acct.name} liquidada`,
                accountId: override.accountId,
              });
              freedMinimums += getMinPayment(acct);
            }
          }
        } else {
          unallocatedCash += ce.amount;
        }
      } else {
        unallocatedCash += ce.amount;
      }
    }

    // Distribute unallocated cash by strategy
    let pool = unallocatedCash;
    while (pool > 0.01) {
      const priorityId = getScenarioPriority(balances, accounts, strategy, allocations.customPriority);
      if (!priorityId) break;

      const payment = Math.min(pool, balances[priorityId]);
      balances[priorityId] -= payment;
      pool -= payment;
      monthPayments[priorityId].extra += payment;
      totalAmountPaid += payment;

      if (balances[priorityId] <= 0.01) {
        balances[priorityId] = 0;
        if (!paidOffAccounts.has(priorityId)) {
          paidOffAccounts.add(priorityId);
          newlyPaidOff.push(priorityId);
          const acct = accounts.find((a) => a.id === priorityId)!;
          payoffOrder.push({
            accountId: priorityId,
            accountName: acct.name,
            month: monthNum,
            calendarMonth,
          });
          events.push({
            type: "account_paid_off",
            description: `${acct.name} liquidada`,
            accountId: priorityId,
          });
          freedMinimums += getMinPayment(acct);
        }
      }
    }

    // 4. Apply freed minimums (cascade)
    let cascadePool = freedMinimums;
    while (cascadePool > 0.01) {
      // Check cascade redirects first
      let targetId: string | null = null;
      for (const redirect of allocations.cascadeRedirects) {
        if (paidOffAccounts.has(redirect.fromAccountId) && (balances[redirect.toAccountId] ?? 0) > 0.01) {
          targetId = redirect.toAccountId;
          const fromAcct = accounts.find((a) => a.id === redirect.fromAccountId)!;
          const toAcct = accounts.find((a) => a.id === redirect.toAccountId)!;
          events.push({
            type: "cascade_redirect",
            description: `${formatAmount(Math.min(cascadePool, balances[targetId]), currency)} liberados de ${fromAcct.name} → redirigidos a ${toAcct.name}`,
            fromAccountId: redirect.fromAccountId,
            toAccountId: redirect.toAccountId,
            freedAmount: Math.min(cascadePool, balances[targetId]),
          });
          break;
        }
      }

      if (!targetId) {
        targetId = getScenarioPriority(balances, accounts, strategy, allocations.customPriority);
      }
      if (!targetId) break;

      const payment = Math.min(cascadePool, balances[targetId]);
      balances[targetId] -= payment;
      cascadePool -= payment;
      monthPayments[targetId].cascade += payment;
      totalAmountPaid += payment;

      if (balances[targetId] <= 0.01) {
        balances[targetId] = 0;
        if (!paidOffAccounts.has(targetId)) {
          paidOffAccounts.add(targetId);
          const acct = accounts.find((a) => a.id === targetId)!;
          payoffOrder.push({
            accountId: targetId,
            accountName: acct.name,
            month: monthNum,
            calendarMonth,
          });
          events.push({
            type: "account_paid_off",
            description: `${acct.name} liquidada`,
            accountId: targetId,
          });
        }
      }
    }

    // 5. Build month snapshot
    cumulativeInterest += monthInterest;

    for (const a of accounts) {
      accountDetails.push({
        accountId: a.id,
        balanceBefore: balancesBefore[a.id],
        interestAccrued: interestAccrued[a.id],
        minimumPaymentApplied: monthPayments[a.id].minimum,
        extraPaymentApplied: monthPayments[a.id].extra,
        cascadePaymentApplied: monthPayments[a.id].cascade,
        balanceAfter: Math.max(balances[a.id], 0),
        paidOff: paidOffAccounts.has(a.id),
      });
    }

    timeline.push({
      month: monthNum,
      calendarMonth,
      totalBalance: Object.values(balances).reduce((s, b) => s + Math.max(b, 0), 0),
      cumulativeInterest,
      accounts: accountDetails,
      events,
    });

    if (Object.values(balances).every((b) => b <= 0.01)) break;
  }

  return {
    totalMonths: timeline.length,
    totalInterestPaid: cumulativeInterest,
    totalAmountPaid,
    debtFreeDate: timeline.length > 0 ? timeline[timeline.length - 1].calendarMonth : startMonth,
    payoffOrder,
    timeline,
  };
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
cd packages/shared && pnpm test -- scenario-engine
```

Expected: All PASS.

- [ ] **Step 5: Export from index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from "./utils/scenario-engine";
```

- [ ] **Step 6: Build**

```bash
cd webapp && pnpm build
```

Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/utils/scenario-engine.ts packages/shared/src/utils/__tests__/scenario-engine.test.ts packages/shared/src/index.ts
git commit -m "feat: implement runScenario engine with cascade control and manual overrides"
```

---

### Task 10: Add Zod validators for scenarios

**Files:**
- Create: `webapp/src/lib/validators/scenario.ts`

- [ ] **Step 1: Create the validator file**

Create `webapp/src/lib/validators/scenario.ts`:

```typescript
import { z } from "zod";

const currencyEnum = z.enum(["COP", "BRL", "MXN", "USD", "EUR", "PEN", "CLP", "ARS"]);

export const cashEntrySchema = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-/i),
  amount: z.number().positive(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  label: z.string().optional(),
  currency: currencyEnum,
  recurring: z.object({ months: z.number().int().positive() }).optional(),
});

export const scenarioAllocationsSchema = z.object({
  manualOverrides: z.array(z.object({
    month: z.string(),
    cashEntryId: z.string(),
    accountId: z.string(),
    amount: z.number().positive(),
  })).default([]),
  cascadeRedirects: z.array(z.object({
    fromAccountId: z.string(),
    toAccountId: z.string(),
  })).default([]),
  customPriority: z.array(z.string()).optional(),
});

const snapshotAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["CREDIT_CARD", "LOAN"]),
  balance: z.number(),
  currency: currencyEnum,
  interestRate: z.number().nullable(),
  monthlyPayment: z.number().nullable(),
  creditLimit: z.number().nullable(),
  paymentDay: z.number().nullable(),
  cutoffDay: z.number().nullable(),
  color: z.string().nullable(),
  institutionName: z.string().nullable(),
  currencyBreakdown: z.any().nullable(),
});

const scenarioResultSchema = z.object({
  totalMonths: z.number(),
  totalInterestPaid: z.number(),
  totalAmountPaid: z.number(),
  debtFreeDate: z.string(),
  payoffOrder: z.array(z.any()),
  timeline: z.array(z.any()),
});

export const saveScenarioSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-/i).optional(),
  name: z.string().min(1).max(100).optional(),
  cashEntries: z.array(cashEntrySchema).min(1),
  strategy: z.enum(["snowball", "avalanche", "custom"]),
  allocations: scenarioAllocationsSchema,
  snapshotAccounts: z.array(snapshotAccountSchema).min(1),
  results: scenarioResultSchema,
});

export type SaveScenarioInput = z.infer<typeof saveScenarioSchema>;
```

- [ ] **Step 2: Build to verify imports resolve**

```bash
cd webapp && pnpm build
```

Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/lib/validators/scenario.ts
git commit -m "feat: add Zod validators for debt scenario persistence"
```

---

## Chunk 3: PR 3 — DB Migration + Server Actions + Wizard UI

### Task 11: Create Supabase migration

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_create_debt_scenarios.sql` (use `npx supabase migration new`)

- [ ] **Step 1: Create migration file**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && npx supabase migration new create_debt_scenarios
```

This creates a timestamped file in `supabase/migrations/`.

- [ ] **Step 2: Write the migration SQL**

Paste into the created file:

```sql
create table debt_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,

  cash_entries jsonb not null,
  strategy text not null default 'avalanche',
  allocations jsonb not null default '{}',

  snapshot_accounts jsonb not null,

  results jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_debt_scenarios_updated_at
  before update on debt_scenarios
  for each row execute function update_updated_at_column();

alter table debt_scenarios enable row level security;

create policy "Users manage own scenarios"
  on debt_scenarios for all
  using ((select auth.uid()) = user_id);

create index idx_debt_scenarios_user on debt_scenarios(user_id, updated_at desc);
```

- [ ] **Step 3: Push migration**

```bash
npx supabase db push
```

Expected: Migration applied successfully.

- [ ] **Step 4: Regenerate types**

```bash
npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > packages/shared/src/types/database.ts
```

Verify `export type Json =` header is intact in the output file.

- [ ] **Step 5: Build to verify types**

```bash
cd webapp && pnpm build
```

Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*create_debt_scenarios* packages/shared/src/types/database.ts
git commit -m "feat: create debt_scenarios table with RLS and updated_at trigger"
```

---

### Task 12: Create server actions

**Files:**
- Create: `webapp/src/actions/scenarios.ts`

- [ ] **Step 1: Create the server actions file**

Create `webapp/src/actions/scenarios.ts`:

```typescript
"use server";

import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { saveScenarioSchema, type SaveScenarioInput } from "@/lib/validators/scenario";
import type { ActionResult } from "@/types/actions";

interface DebtScenario {
  id: string;
  name: string | null;
  cash_entries: unknown;
  strategy: string;
  allocations: unknown;
  snapshot_accounts: unknown;
  results: unknown;
  created_at: string;
  updated_at: string;
}

export async function getScenarios(): Promise<DebtScenario[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data, error } = await supabase
    .from("debt_scenarios")
    .select("*")
    .eq("user_id", user.id)
    .not("name", "is", null)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch scenarios:", error);
    return [];
  }

  return data ?? [];
}

export async function getScenario(id: string): Promise<DebtScenario | null> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return null;

  const { data, error } = await supabase
    .from("debt_scenarios")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return data;
}

export async function saveScenario(
  input: SaveScenarioInput
): Promise<ActionResult<DebtScenario>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = saveScenarioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const data = parsed.data;
  const row = {
    user_id: user.id,
    name: data.name ?? null,
    cash_entries: data.cashEntries,
    strategy: data.strategy,
    allocations: data.allocations,
    snapshot_accounts: data.snapshotAccounts,
    results: data.results,
  };

  if (data.id) {
    // Update existing
    const { data: updated, error } = await supabase
      .from("debt_scenarios")
      .update(row)
      .eq("id", data.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: "No se pudo actualizar el escenario" };
    }
    return { success: true, data: updated };
  } else {
    // Create new
    const { data: created, error } = await supabase
      .from("debt_scenarios")
      .insert(row)
      .select()
      .single();

    if (error) {
      return { success: false, error: "No se pudo guardar el escenario" };
    }
    return { success: true, data: created };
  }
}

export async function deleteScenario(id: string): Promise<ActionResult<void>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("debt_scenarios")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: "No se pudo eliminar el escenario" };
  }
  return { success: true, data: undefined };
}
```

- [ ] **Step 2: Build**

```bash
cd webapp && pnpm build
```

Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/scenarios.ts
git commit -m "feat: add CRUD server actions for debt scenarios"
```

---

### Task 13: Create planner page and main component shell

**Files:**
- Create: `webapp/src/app/(dashboard)/deudas/planificador/page.tsx`
- Create: `webapp/src/components/debt/scenario-planner.tsx`
- Create: `webapp/src/components/debt/planner/cash-step.tsx` (placeholder)
- Create: `webapp/src/components/debt/planner/allocate-step.tsx` (placeholder)
- Create: `webapp/src/components/debt/planner/compare-step.tsx` (placeholder)
- Create: `webapp/src/components/debt/planner/detail-step.tsx` (placeholder)

- [ ] **Step 1: Create the RSC page**

Create `webapp/src/app/(dashboard)/deudas/planificador/page.tsx`:

```typescript
import { getDebtOverview } from "@/actions/debt";
import { getPreferredCurrency } from "@/actions/profile";
import { getScenarios } from "@/actions/scenarios";
import { ScenarioPlanner } from "@/components/debt/scenario-planner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function PlanificadorPage() {
  const currency = await getPreferredCurrency();
  const overview = await getDebtOverview(currency);
  const activeDebts = overview.accounts.filter((a) => a.balance > 0);
  const savedScenarios = await getScenarios();

  if (activeDebts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/deudas">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Planificador de Pagos</h1>
            <p className="text-muted-foreground">
              Crea planes para pagar tus deudas más rápido
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground mb-2">
            No tienes deudas activas para planificar.
          </p>
          <Link href="/deudas" className="text-primary hover:underline text-sm">
            Volver a Deudas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/deudas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Planificador de Pagos</h1>
          <p className="text-muted-foreground">
            Crea planes para pagar tus deudas más rápido
          </p>
        </div>
      </div>
      <ScenarioPlanner
        accounts={activeDebts}
        currency={currency}
        savedScenarios={savedScenarios}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the main planner component with useReducer**

Create `webapp/src/components/debt/scenario-planner.tsx`:

```typescript
"use client";

import { useReducer, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type DebtAccount,
  type CashEntry,
  type ScenarioAllocations,
  type ScenarioStrategy,
  type ScenarioResult,
  runScenario,
  expandCashEntries,
} from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";
import { CashStep } from "./planner/cash-step";
import { AllocateStep } from "./planner/allocate-step";
import { CompareStep } from "./planner/compare-step";
import { DetailStep } from "./planner/detail-step";

export interface ScenarioState {
  name: string;
  strategy: ScenarioStrategy;
  allocations: ScenarioAllocations;
}

export interface PlannerState {
  cashEntries: CashEntry[];
  scenarios: ScenarioState[];
  activeScenarioIndex: number;
  savedScenarioId: string | null;
  isDirty: boolean;
}

export type PlannerAction =
  | { type: "SET_CASH_ENTRIES"; entries: CashEntry[] }
  | { type: "ADD_CASH_ENTRY"; entry: CashEntry }
  | { type: "REMOVE_CASH_ENTRY"; id: string }
  | { type: "UPDATE_SCENARIO"; index: number; state: Partial<ScenarioState> }
  | { type: "ADD_SCENARIO" }
  | { type: "REMOVE_SCENARIO"; index: number }
  | { type: "SET_ACTIVE_SCENARIO"; index: number }
  | { type: "MARK_SAVED"; id: string }
  | { type: "LOAD_STATE"; state: PlannerState };

function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case "SET_CASH_ENTRIES":
      return { ...state, cashEntries: action.entries, isDirty: true };
    case "ADD_CASH_ENTRY":
      return { ...state, cashEntries: [...state.cashEntries, action.entry], isDirty: true };
    case "REMOVE_CASH_ENTRY":
      return {
        ...state,
        cashEntries: state.cashEntries.filter((e) => e.id !== action.id),
        isDirty: true,
      };
    case "UPDATE_SCENARIO":
      return {
        ...state,
        scenarios: state.scenarios.map((s, i) =>
          i === action.index ? { ...s, ...action.state } : s
        ),
        isDirty: true,
      };
    case "ADD_SCENARIO":
      if (state.scenarios.length >= 3) return state;
      return {
        ...state,
        scenarios: [
          ...state.scenarios,
          {
            name: `Plan ${String.fromCharCode(65 + state.scenarios.length)}`,
            strategy: "avalanche",
            allocations: { manualOverrides: [], cascadeRedirects: [] },
          },
        ],
        activeScenarioIndex: state.scenarios.length,
        isDirty: true,
      };
    case "REMOVE_SCENARIO":
      if (state.scenarios.length <= 1) return state;
      return {
        ...state,
        scenarios: state.scenarios.filter((_, i) => i !== action.index),
        activeScenarioIndex: Math.min(state.activeScenarioIndex, state.scenarios.length - 2),
        isDirty: true,
      };
    case "SET_ACTIVE_SCENARIO":
      return { ...state, activeScenarioIndex: action.index };
    case "MARK_SAVED":
      return { ...state, savedScenarioId: action.id, isDirty: false };
    case "LOAD_STATE":
      return action.state;
    default:
      return state;
  }
}

const initialState: PlannerState = {
  cashEntries: [],
  scenarios: [
    {
      name: "Plan A",
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
    },
  ],
  activeScenarioIndex: 0,
  savedScenarioId: null,
  isDirty: false,
};

interface Props {
  accounts: DebtAccount[];
  currency?: CurrencyCode;
  savedScenarios: unknown[];
}

export function ScenarioPlanner({ accounts, currency }: Props) {
  const [state, dispatch] = useReducer(plannerReducer, initialState);

  // Compute results for all scenarios
  const results = useMemo<Record<number, ScenarioResult>>(() => {
    const now = new Date();
    const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const expanded = expandCashEntries(state.cashEntries);
    const r: Record<number, ScenarioResult> = {};

    for (let i = 0; i < state.scenarios.length; i++) {
      const scenario = state.scenarios[i];
      r[i] = runScenario({
        accounts,
        cashEntries: expanded,
        strategy: scenario.strategy,
        allocations: scenario.allocations,
        startMonth,
      });
    }

    return r;
  }, [accounts, state.cashEntries, state.scenarios]);

  // Baseline: no extra payments
  const baseline = useMemo<ScenarioResult>(() => {
    const now = new Date();
    const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return runScenario({
      accounts,
      cashEntries: [],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth,
    });
  }, [accounts]);

  return (
    <Tabs defaultValue="cash" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="cash">Tu efectivo</TabsTrigger>
        <TabsTrigger value="allocate">Asignar</TabsTrigger>
        <TabsTrigger value="compare">Comparar</TabsTrigger>
        <TabsTrigger value="detail">Detalle</TabsTrigger>
      </TabsList>

      <TabsContent value="cash">
        <CashStep
          accounts={accounts}
          cashEntries={state.cashEntries}
          currency={currency}
          dispatch={dispatch}
        />
      </TabsContent>

      <TabsContent value="allocate">
        <AllocateStep
          accounts={accounts}
          scenario={state.scenarios[state.activeScenarioIndex]}
          scenarioIndex={state.activeScenarioIndex}
          result={results[state.activeScenarioIndex]}
          dispatch={dispatch}
        />
      </TabsContent>

      <TabsContent value="compare">
        <CompareStep
          accounts={accounts}
          scenarios={state.scenarios}
          results={results}
          baseline={baseline}
          currency={currency}
          dispatch={dispatch}
        />
      </TabsContent>

      <TabsContent value="detail">
        <DetailStep
          accounts={accounts}
          scenarios={state.scenarios}
          results={results}
          baseline={baseline}
          currency={currency}
        />
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 3: Create placeholder step components**

Each step gets a minimal placeholder that compiles. These will be fleshed out in Tasks 14-17.

Create `webapp/src/components/debt/planner/cash-step.tsx`:

```typescript
"use client";

import type { DebtAccount, CashEntry } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";
import type { PlannerAction } from "../scenario-planner";

interface Props {
  accounts: DebtAccount[];
  cashEntries: CashEntry[];
  currency?: CurrencyCode;
  dispatch: React.Dispatch<PlannerAction>;
}

export function CashStep({ accounts, cashEntries, currency, dispatch }: Props) {
  return (
    <div className="text-muted-foreground text-sm p-8 text-center">
      Paso 1: Tu efectivo — en construcción
    </div>
  );
}
```

Create `webapp/src/components/debt/planner/allocate-step.tsx`:

```typescript
"use client";

import type { DebtAccount, ScenarioResult } from "@zeta/shared";
import type { PlannerAction, ScenarioState } from "../scenario-planner";

interface Props {
  accounts: DebtAccount[];
  scenario: ScenarioState;
  scenarioIndex: number;
  result: ScenarioResult | undefined;
  dispatch: React.Dispatch<PlannerAction>;
}

export function AllocateStep({ accounts, scenario, result, dispatch }: Props) {
  return (
    <div className="text-muted-foreground text-sm p-8 text-center">
      Paso 2: Asignar pagos — en construcción
    </div>
  );
}
```

Create `webapp/src/components/debt/planner/compare-step.tsx`:

```typescript
"use client";

import type { DebtAccount, ScenarioResult } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";
import type { PlannerAction, ScenarioState } from "../scenario-planner";

interface Props {
  accounts: DebtAccount[];
  scenarios: ScenarioState[];
  results: Record<number, ScenarioResult>;
  baseline: ScenarioResult;
  currency?: CurrencyCode;
  dispatch: React.Dispatch<PlannerAction>;
}

export function CompareStep({ scenarios, results, baseline }: Props) {
  return (
    <div className="text-muted-foreground text-sm p-8 text-center">
      Paso 3: Comparar — en construcción
    </div>
  );
}
```

Create `webapp/src/components/debt/planner/detail-step.tsx`:

```typescript
"use client";

import type { DebtAccount, ScenarioResult } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";
import type { ScenarioState } from "../scenario-planner";

interface Props {
  accounts: DebtAccount[];
  scenarios: ScenarioState[];
  results: Record<number, ScenarioResult>;
  baseline: ScenarioResult;
  currency?: CurrencyCode;
}

export function DetailStep({ scenarios, results, baseline }: Props) {
  return (
    <div className="text-muted-foreground text-sm p-8 text-center">
      Paso 4: Detalle — en construcción
    </div>
  );
}
```

- [ ] **Step 4: Build**

```bash
cd webapp && pnpm build
```

Expected: Clean build. The page renders with 4 tabs and placeholder content.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/app/(dashboard)/deudas/planificador/ webapp/src/components/debt/scenario-planner.tsx webapp/src/components/debt/planner/
git commit -m "feat: scaffold planner page, wizard shell with useReducer, placeholder steps"
```

---

### Task 14: Implement Cash Step (Step 1)

**Files:**
- Modify: `webapp/src/components/debt/planner/cash-step.tsx`

This is the first real wizard step. Users add cash entries with amount, month, optional label, and optional recurrence.

- [ ] **Step 1: Implement the full Cash Step UI**

The component should have:
- A list of current cash entries as editable cards
- An "Agregar" button that adds a new blank entry
- Each entry has: amount (CurrencyInput), month (month picker), label (text input), recurring toggle
- A "quick add" shortcut: amount + "cada mes por N meses"
- A sidebar/top section showing current debt summary for context
- The dispatch is used to add/remove/update entries

This is a UI-heavy task. The implementer should follow existing patterns from the import wizard (`webapp/src/components/import/`) for form layout and use shadcn/ui components (Card, Input, Button, Select). All labels in Spanish.

- [ ] **Step 2: Build and visually test**

```bash
cd webapp && pnpm build && pnpm dev
```

Navigate to `/deudas/planificador`, verify the cash step renders and entries can be added/removed.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/debt/planner/cash-step.tsx
git commit -m "feat: implement Cash Step — add/remove/edit cash entries with recurrence"
```

---

### Task 15: Implement Allocate Step (Step 2)

**Files:**
- Modify: `webapp/src/components/debt/planner/allocate-step.tsx`

- [ ] **Step 1: Implement the Allocate Step UI**

The component should have:
- Strategy selector (Bola de Nieve / Avalancha / Personalizado)
- For "Personalizado": a sortable list of accounts to set priority order
- Account list showing each account's projected balance trajectory (using the `result` prop)
- Manual override UI: for each month that has a cash entry, allow pinning it to a specific account
- Cascade control: for each account, allow setting where freed payments go when it's paid off
- Visual indicators for cascade connections

Use the `result` from `runScenario()` (passed as prop) to show projected outcomes as the user changes allocation settings.

- [ ] **Step 2: Build and visually test**

```bash
cd webapp && pnpm build && pnpm dev
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/debt/planner/allocate-step.tsx
git commit -m "feat: implement Allocate Step — strategy selection, manual overrides, cascade control"
```

---

### Task 16: Implement Compare Step (Step 3)

**Files:**
- Modify: `webapp/src/components/debt/planner/compare-step.tsx`

- [ ] **Step 1: Implement the Compare Step UI**

The component should have:
- "Agregar plan" button to create Plan B / Plan C (max 3)
- Summary comparison table: columns per scenario showing total months, interest, amount paid, payoff order
- Overlay area chart (Recharts) with all scenarios + baseline (dashed line)
- Delta callout showing savings between plans
- "Recomendado" badge on the best scenario
- Baseline always included as reference

Follow the chart patterns already established in `debt-simulator.tsx` (gradient fills, custom tooltips, ChartContainer).

- [ ] **Step 2: Build and visually test**

```bash
cd webapp && pnpm build && pnpm dev
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/debt/planner/compare-step.tsx
git commit -m "feat: implement Compare Step — side-by-side scenario comparison with charts"
```

---

### Task 17: Implement Detail Step (Step 4)

**Files:**
- Modify: `webapp/src/components/debt/planner/detail-step.tsx`

- [ ] **Step 1: Implement the Detail Step UI**

The component should have:
- Scenario selector (dropdown or tabs to switch between plans)
- Month-by-month table: rows = months, columns = each account's payment/interest/balance
- Cascade events highlighted inline with colored indicators and Spanish descriptions
- Cash injection months highlighted with source label
- Per-account area chart (selectable)
- Summary cards: total interest, total months, payoff order with calendar dates, interest saved vs baseline

- [ ] **Step 2: Build and visually test**

```bash
cd webapp && pnpm build && pnpm dev
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/debt/planner/detail-step.tsx
git commit -m "feat: implement Detail Step — month-by-month timeline with cascade visualization"
```

---

### Task 18: Add scenario persistence (save/load/delete)

**Files:**
- Create: `webapp/src/components/debt/planner/scenario-manager.tsx`
- Modify: `webapp/src/components/debt/scenario-planner.tsx`

- [ ] **Step 1: Create ScenarioManager component**

A panel (could be a sidebar, dialog, or section within the planner) that:
- Shows a "Guardar plan" button (triggers save dialog with name input)
- Lists saved scenarios (from `savedScenarios` prop)
- Each saved scenario has: name, strategy, months to debt-free, last updated
- "Cargar" button loads a saved scenario into the planner state
- "Eliminar" button deletes (with confirmation)
- Calls `saveScenario`, `deleteScenario` server actions

- [ ] **Step 2: Integrate into ScenarioPlanner**

Add the ScenarioManager to the planner layout. Wire up save/load/delete to the reducer dispatch.

- [ ] **Step 3: Build and test save/load cycle**

```bash
cd webapp && pnpm build && pnpm dev
```

Create a scenario, save it, refresh, load it back.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/debt/planner/scenario-manager.tsx webapp/src/components/debt/scenario-planner.tsx
git commit -m "feat: add scenario save/load/delete with server persistence"
```

---

### Task 19: Dashboard integration + route redirect

**Files:**
- Modify: `webapp/src/app/(dashboard)/deudas/page.tsx`
- Create: `webapp/src/app/(dashboard)/deudas/simulador/page.tsx` (redirect)

- [ ] **Step 1: Update dashboard button**

In `webapp/src/app/(dashboard)/deudas/page.tsx`, change the simulator button:

```typescript
// OLD:
<Link href="/deudas/simulador">
  <Calculator className="h-4 w-4 mr-2" />
  Simulador de pago
</Link>

// NEW:
<Link href="/deudas/planificador">
  <Calculator className="h-4 w-4 mr-2" />
  Planificador de pagos
</Link>
```

- [ ] **Step 2: Add redirect from old route**

Replace `webapp/src/app/(dashboard)/deudas/simulador/page.tsx` with a redirect:

```typescript
import { redirect } from "next/navigation";

export default function SimuladorRedirect() {
  redirect("/deudas/planificador");
}
```

- [ ] **Step 3: Build**

```bash
cd webapp && pnpm build
```

Expected: Clean build. Navigating to `/deudas/simulador` redirects to `/deudas/planificador`.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/app/(dashboard)/deudas/page.tsx webapp/src/app/(dashboard)/deudas/simulador/page.tsx
git commit -m "feat: update dashboard link to planificador and redirect old simulador route"
```

---

### Task 20: Final verification

- [ ] **Step 1: Run all shared package tests**

```bash
cd packages/shared && pnpm test
```

Expected: All PASS.

- [ ] **Step 2: Full production build**

```bash
cd webapp && pnpm build
```

Expected: Clean build, no type errors.

- [ ] **Step 3: Manual smoke test**

1. Navigate to `/deudas` — button says "Planificador de pagos"
2. Navigate to `/deudas/simulador` — redirects to `/deudas/planificador`
3. Add cash entries in Step 1
4. Configure allocation in Step 2
5. Add Plan B in Step 3, compare results
6. View month-by-month detail in Step 4
7. Save a scenario, refresh, load it back
8. Delete a scenario

- [ ] **Step 4: Commit any final fixes and tag**

```bash
git add -A && git commit -m "fix: address smoke test feedback"
```
