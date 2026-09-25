import { describe, expect, it } from "vitest";
import {
  computeForeignDebtCost,
  computeRangeStats,
  nextPaymentDate,
} from "@/lib/debt/usd-debt-insights";

const history = [
  { date: "2026-09-21", rate: 3400 },
  { date: "2026-09-22", rate: 3350 },
  { date: "2026-09-23", rate: 3300 },
  { date: "2026-09-24", rate: 3250 },
  { date: "2026-09-25", rate: 3200 },
];

describe("computeRangeStats", () => {
  it("finds min/max, percentile and cheap timing", () => {
    const stats = computeRangeStats(history, 3200, 3300)!;
    expect(stats.min).toEqual({ date: "2026-09-25", rate: 3200 });
    expect(stats.max).toEqual({ date: "2026-09-21", rate: 3400 });
    expect(stats.percentile).toBe(0);
    expect(stats.timing).toBe("barato");
  });

  it("flags expensive days vs the 30-day average", () => {
    expect(computeRangeStats(history, 3400, 3300)!.timing).toBe("caro");
    expect(computeRangeStats(history, 3310, 3300)!.timing).toBe("normal");
  });

  it("needs at least two points", () => {
    expect(computeRangeStats(history.slice(0, 1), 3200, null)).toBeNull();
  });
});

describe("computeForeignDebtCost", () => {
  it("compares paying today against the average", () => {
    const stats = computeRangeStats(history, 3200, 3300);
    const cost = computeForeignDebtCost(1000, 3200, stats);
    expect(cost.atToday).toBe(3_200_000);
    expect(cost.vsAvg30d).toBe(-100_000);
    expect(cost.per100).toBe(100_000);
    expect(cost.atMax).toBe(3_400_000);
  });
});

describe("nextPaymentDate", () => {
  it("returns this month when the day hasn't passed", () => {
    expect(nextPaymentDate(28, "2026-09-25")).toBe("2026-09-28");
    expect(nextPaymentDate(25, "2026-09-25")).toBe("2026-09-25");
  });

  it("rolls to next month and clamps to month length", () => {
    expect(nextPaymentDate(10, "2026-09-25")).toBe("2026-10-10");
    expect(nextPaymentDate(31, "2026-09-25")).toBe("2026-09-30");
    expect(nextPaymentDate(31, "2027-01-31")).toBe("2027-01-31");
    expect(nextPaymentDate(30, "2027-01-31")).toBe("2027-02-28");
  });
});
