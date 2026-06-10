import { describe, it, expect } from "vitest";
import { computeDebtTrend, detectExtraPayments } from "../debt-trend";

describe("computeDebtTrend", () => {
  it("returns mejorando when cuota dropped more than 5%", () => {
    const r = computeDebtTrend(900_000, 1_000_000);
    expect(r.status).toBe("mejorando");
    expect(r.deltaPct).toBeCloseTo(-10);
  });

  it("returns mejorando at exactly -5%", () => {
    expect(computeDebtTrend(950_000, 1_000_000).status).toBe("mejorando");
  });

  it("returns estable for flat cuota", () => {
    const r = computeDebtTrend(1_000_000, 1_000_000);
    expect(r.status).toBe("estable");
    expect(r.deltaPct).toBe(0);
  });

  it("returns estable at exactly +10%", () => {
    expect(computeDebtTrend(1_100_000, 1_000_000).status).toBe("estable");
  });

  it("returns mes_pesado above +10%", () => {
    const r = computeDebtTrend(1_120_000, 1_000_000);
    expect(r.status).toBe("mes_pesado");
    expect(r.deltaPct).toBeCloseTo(12);
  });

  it("returns nulls when previous period is missing or zero (never guess)", () => {
    expect(computeDebtTrend(1_000_000, null)).toEqual({ deltaPct: null, status: null });
    expect(computeDebtTrend(1_000_000, 0)).toEqual({ deltaPct: null, status: null });
    expect(computeDebtTrend(null, 1_000_000)).toEqual({ deltaPct: null, status: null });
  });
});

describe("detectExtraPayments", () => {
  const expected = [
    { accountId: "cc-1", cuota: 500_000 },
    { accountId: "loan-1", cuota: 700_000 },
  ];

  it("counts payments made after the cuota was already covered", () => {
    const r = detectExtraPayments(
      [
        { accountId: "cc-1", amount: 500_000, date: "2026-06-02" },
        { accountId: "cc-1", amount: 300_000, date: "2026-06-15" }, // extra
        { accountId: "loan-1", amount: 700_000, date: "2026-06-05" },
      ],
      expected
    );
    expect(r.count).toBe(1);
    expect(r.totalExtra).toBe(300_000);
  });

  it("sorts by date before deciding which payment is extra", () => {
    const r = detectExtraPayments(
      [
        { accountId: "cc-1", amount: 300_000, date: "2026-06-15" },
        { accountId: "cc-1", amount: 500_000, date: "2026-06-02" },
      ],
      expected
    );
    expect(r.count).toBe(1); // the June 15 payment is the extra one
  });

  it("reports zero when payments only cover the cuota", () => {
    const r = detectExtraPayments(
      [{ accountId: "cc-1", amount: 500_000, date: "2026-06-02" }],
      expected
    );
    expect(r).toEqual({ count: 0, totalExtra: 0 });
  });

  it("treats any payment as extra when the account has no expected cuota", () => {
    const r = detectExtraPayments(
      [{ accountId: "cc-2", amount: 200_000, date: "2026-06-03" }],
      expected
    );
    expect(r.count).toBe(1);
    expect(r.totalExtra).toBe(200_000);
  });

  it("handles empty inputs", () => {
    expect(detectExtraPayments([], expected)).toEqual({ count: 0, totalExtra: 0 });
    expect(detectExtraPayments([], [])).toEqual({ count: 0, totalExtra: 0 });
  });
});
