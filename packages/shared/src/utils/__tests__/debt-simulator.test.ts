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
