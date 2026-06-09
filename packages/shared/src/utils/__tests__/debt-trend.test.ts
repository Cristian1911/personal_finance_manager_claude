import { describe, it, expect } from "vitest";
import { computeDebtTrend } from "../debt-trend";

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
