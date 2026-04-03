import { describe, it, expect } from "vitest";
import { computeDebtStats } from "../debt-stats";
import { makeAccount } from "./helpers";

const cc1 = makeAccount({
  id: "cc1", name: "Nu", type: "CREDIT_CARD",
  balance: 3_000_000, creditLimit: 8_000_000, interestRate: 28,
  monthlyPayment: 890_000, paymentDay: 15,
});
const cc2 = makeAccount({
  id: "cc2", name: "Falabella", type: "CREDIT_CARD",
  balance: 5_000_000, creditLimit: 6_000_000, interestRate: 42.5,
  monthlyPayment: 450_000, paymentDay: 20,
});
const loan1 = makeAccount({
  id: "loan1", name: "Bancolombia", type: "LOAN",
  balance: 6_200_000, creditLimit: 18_000_000, interestRate: 18,
  monthlyPayment: 650_000, paymentDay: 5,
});

describe("computeDebtStats", () => {
  const stats = computeDebtStats([cc1, cc2, loan1]);

  it("computes totalMonthlyPayment across all accounts", () => {
    expect(stats.totalMonthlyPayment).toBe(890_000 + 450_000 + 650_000);
  });

  it("finds highest payment account", () => {
    expect(stats.highestPayment.accountName).toBe("Nu");
    expect(stats.highestPayment.amount).toBe(890_000);
  });

  it("finds highest rate account", () => {
    expect(stats.highestRate.accountName).toBe("Falabella");
    expect(stats.highestRate.rate).toBe(42.5);
  });

  it("finds next upcoming payment", () => {
    expect(stats.nextPayment).not.toBeNull();
    expect(stats.nextPayment!.accountName).toBeDefined();
    expect(stats.nextPayment!.daysUntil).toBeGreaterThanOrEqual(0);
  });

  it("computes credit card totals", () => {
    expect(stats.creditCards.monthlyPayment).toBe(890_000 + 450_000);
    expect(stats.creditCards.count).toBe(2);
    expect(stats.creditCards.monthlyInterest).toBeGreaterThan(0);
  });

  it("computes loan totals", () => {
    expect(stats.loans.monthlyPayment).toBe(650_000);
    expect(stats.loans.count).toBe(1);
  });

  it("computes loan progress when creditLimit is available", () => {
    expect(stats.loans.progress).not.toBeNull();
    expect(stats.loans.progress!.percentage).toBeCloseTo(
      (1 - 6_200_000 / 18_000_000) * 100, 0
    );
  });

  it("computes loan remaining months estimate", () => {
    expect(stats.loans.remainingMonths).not.toBeNull();
    expect(stats.loans.remainingMonths!.months).toBe(
      Math.ceil(6_200_000 / 650_000)
    );
  });

  it("returns per-account breakdowns for popovers", () => {
    expect(stats.allByPayment).toHaveLength(3);
    expect(stats.allByPayment[0].amount).toBeGreaterThanOrEqual(
      stats.allByPayment[1].amount
    );
    expect(stats.allByRate).toHaveLength(3);
    expect(stats.allByRate[0].rate).toBeGreaterThanOrEqual(
      stats.allByRate[1].rate
    );
  });
});

describe("computeDebtStats edge cases", () => {
  it("returns null for loans progress when creditLimit is null", () => {
    const loan = makeAccount({
      type: "LOAN", balance: 5_000_000, creditLimit: null,
      monthlyPayment: 500_000,
    });
    const stats = computeDebtStats([loan]);
    expect(stats.loans.progress).toBeNull();
  });

  it("returns null for loan remaining months when monthlyPayment is null", () => {
    const loan = makeAccount({
      type: "LOAN", balance: 5_000_000, monthlyPayment: null,
    });
    const stats = computeDebtStats([loan]);
    expect(stats.loans.remainingMonths).toBeNull();
  });

  it("hides nextPayment when no account has paymentDay", () => {
    const acc = makeAccount({ paymentDay: null });
    const stats = computeDebtStats([acc]);
    expect(stats.nextPayment).toBeNull();
  });

  it("handles empty accounts array", () => {
    const stats = computeDebtStats([]);
    expect(stats.totalMonthlyPayment).toBe(0);
    expect(stats.highestPayment.amount).toBe(0);
    expect(stats.creditCards.count).toBe(0);
    expect(stats.loans.count).toBe(0);
  });

  it("handles accounts with zero balance", () => {
    const acc = makeAccount({ balance: 0, monthlyPayment: 0 });
    const stats = computeDebtStats([acc]);
    expect(stats.totalMonthlyPayment).toBe(0);
  });
});
