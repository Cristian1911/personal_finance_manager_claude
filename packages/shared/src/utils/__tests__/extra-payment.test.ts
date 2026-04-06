import { describe, it, expect } from "vitest";
import { allocateExtraPayment, computeExtraPaymentImpact } from "../extra-payment";
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
