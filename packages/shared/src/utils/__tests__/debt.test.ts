import { describe, it, expect } from "vitest";
import { monthlyRateFromEA, estimateMonthlyInterest } from "../debt";

describe("monthlyRateFromEA", () => {
  it("converts 0% EA to 0 monthly rate", () => {
    expect(monthlyRateFromEA(0)).toBe(0);
  });

  it("converts 28% EA to correct monthly rate", () => {
    const monthly = monthlyRateFromEA(28);
    expect(monthly).toBeCloseTo(0.020785, 5);
  });

  it("converts 12% EA to correct monthly rate", () => {
    const monthly = monthlyRateFromEA(12);
    expect(monthly).toBeCloseTo(0.009489, 5);
  });

  it("produces lower monthly rate than nominal rate / 12", () => {
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
    const interest = estimateMonthlyInterest(5_000_000, 28);
    expect(interest).toBeCloseTo(103_924, -1);
  });

  it("produces less than the old nominal/12 formula", () => {
    const eaInterest = estimateMonthlyInterest(5_000_000, 28);
    const oldNominal = (5_000_000 * 0.28) / 12;
    expect(eaInterest).toBeLessThan(oldNominal);
  });
});
