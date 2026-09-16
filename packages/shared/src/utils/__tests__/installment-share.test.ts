import { describe, it, expect } from "vitest";
import { estimateInstallmentPlan, describeInstallmentShare, isInstallmentPurchase } from "../installment-share";
import { monthlyRateFromEA } from "../debt";

describe("estimateInstallmentPlan", () => {
  it("splits evenly with no interest when the rate is unknown", () => {
    const plan = estimateInstallmentPlan({ principal: 1_200_000, installmentTotal: 24, eaRatePercent: null });
    expect(plan.interestKnown).toBe(false);
    expect(plan.monthlyPayment).toBe(50_000);
    expect(plan.totalInterest).toBe(0);
    expect(plan.totalCost).toBe(1_200_000);
  });

  it("treats a zero rate as unknown", () => {
    const plan = estimateInstallmentPlan({ principal: 100, installmentTotal: 4, eaRatePercent: 0 });
    expect(plan.interestKnown).toBe(false);
    expect(plan.monthlyPayment).toBe(25);
  });

  it("uses a French annuity for a known EA rate", () => {
    const plan = estimateInstallmentPlan({ principal: 1_200_000, installmentTotal: 24, eaRatePercent: 26 });
    const i = monthlyRateFromEA(26);
    const expectedPayment = (1_200_000 * i) / (1 - Math.pow(1 + i, -24));
    expect(plan.interestKnown).toBe(true);
    expect(plan.monthlyPayment).toBe(Math.round(expectedPayment));
    expect(plan.totalCost).toBe(Math.round(expectedPayment * 24));
    expect(plan.totalInterest).toBe(plan.totalCost - 1_200_000);
    expect(plan.totalInterest).toBeGreaterThan(0);
    expect(plan.monthlyPayment).toBeGreaterThan(50_000);
  });

  it("treats a single cuota (one-time purchase) as price only, no interest", () => {
    const plan = estimateInstallmentPlan({ principal: 1000, installmentTotal: 1, eaRatePercent: 26, decimals: 2 });
    expect(plan.totalCost).toBe(1000);
    expect(plan.totalInterest).toBe(0);
    expect(plan.monthlyPayment).toBe(1000);
    expect(plan.interestKnown).toBe(true);
  });

  it("isInstallmentPurchase only for N > 1", () => {
    expect(isInstallmentPurchase({ installment_total: 1 })).toBe(false);
    expect(isInstallmentPurchase({ installment_total: null })).toBe(false);
    expect(isInstallmentPurchase({ installment_total: 24 })).toBe(true);
  });

  it("returns zeros for invalid inputs", () => {
    expect(estimateInstallmentPlan({ principal: 0, installmentTotal: 12, eaRatePercent: 20 }).totalCost).toBe(0);
    expect(estimateInstallmentPlan({ principal: 500, installmentTotal: 0, eaRatePercent: 20 }).totalCost).toBe(0);
  });
});

describe("describeInstallmentShare", () => {
  it("prorates interest and suggests a per-cuota amount", () => {
    const plan = estimateInstallmentPlan({ principal: 1_000_000, installmentTotal: 10, eaRatePercent: 30 });
    const half = plan.totalCost / 2;
    const b = describeInstallmentShare(plan, half);
    expect(b.shareAmount).toBe(half);
    expect(b.shareInterest + b.sharePrincipal).toBe(half);
    expect(b.shareInterest).toBe(Math.round(plan.totalInterest / 2));
    expect(b.suggestedInstallment).toBe(Math.round(half / 10));
  });

  it("has no interest portion when the plan has none", () => {
    const plan = estimateInstallmentPlan({ principal: 300, installmentTotal: 3, eaRatePercent: null });
    const b = describeInstallmentShare(plan, 150);
    expect(b.shareInterest).toBe(0);
    expect(b.sharePrincipal).toBe(150);
    expect(b.suggestedInstallment).toBe(50);
  });
});
