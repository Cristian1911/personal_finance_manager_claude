import { describe, expect, it } from "vitest";
import { computeRitmo, deriveRitmoStatus, type RitmoInput } from "../ritmo";

function days(from: string, count: number, perDay = 0): { date: string; expense: number }[] {
  const out: { date: string; expense: number }[] = [];
  const start = new Date(`${from}T12:00:00`);
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push({
      date: d.toISOString().slice(0, 10),
      expense: perDay,
    });
  }
  return out;
}

describe("computeRitmo", () => {
  it("returns the basic month-end window when no next-income is provided", () => {
    const input: RitmoInput = {
      today: "2026-05-21",
      endOfMonth: "2026-05-31",
      liquidBalance: 2_000_000,
      pendingObligations: 200_000,
      dailyOutflows: days("2026-05-01", 21, 50_000),
    };
    const r = computeRitmo(input);

    expect(r.windowEndDate).toBe("2026-05-31");
    expect(r.daysRemaining).toBe(11);
    expect(r.daysElapsed).toBe(21);
    expect(r.daysInMonth).toBe(31);
    expect(r.availableTotal).toBe(1_800_000);
    expect(r.availablePerDay).toBe(Math.round(1_800_000 / 11));
    expect(r.spentMonth).toBe(50_000 * 21);
  });

  it("respects an in-window next-income date by shortening the runway window", () => {
    const input: RitmoInput = {
      today: "2026-05-21",
      endOfMonth: "2026-05-31",
      liquidBalance: 500_000,
      nextIncomeDate: "2026-05-26",
      nextIncomeAmount: 2_000_000,
      pendingObligations: 0,
      dailyOutflows: days("2026-05-01", 21, 30_000),
    };
    const r = computeRitmo(input);

    expect(r.windowEndDate).toBe("2026-05-26");
    expect(r.daysRemaining).toBe(6);
    expect(r.availableTotal).toBe(500_000);
    expect(r.availablePerDay).toBe(Math.round(500_000 / 6));
  });

  it("falls back to end-of-month when nextIncomeDate is in the past", () => {
    const input: RitmoInput = {
      today: "2026-05-21",
      endOfMonth: "2026-05-31",
      liquidBalance: 500_000,
      nextIncomeDate: "2026-05-15", // already past
      pendingObligations: 0,
      dailyOutflows: days("2026-05-01", 21, 0),
    };
    const r = computeRitmo(input);
    expect(r.windowEndDate).toBe("2026-05-31");
  });

  it("clamps allowedToday at zero when today's spending already exceeded the daily budget", () => {
    const outflows = days("2026-05-01", 21, 0);
    outflows[20] = { date: "2026-05-21", expense: 999_999 }; // big spend today
    const input: RitmoInput = {
      today: "2026-05-21",
      endOfMonth: "2026-05-31",
      liquidBalance: 1_000_000,
      pendingObligations: 0,
      dailyOutflows: outflows,
    };
    const r = computeRitmo(input);
    expect(r.allowedToday).toBe(0);
    expect(r.spentToday).toBe(999_999);
  });

  it("computes spentFraction as spent / (spent + available)", () => {
    const input: RitmoInput = {
      today: "2026-05-15",
      endOfMonth: "2026-05-31",
      liquidBalance: 700_000,
      pendingObligations: 0,
      dailyOutflows: days("2026-05-01", 15, 20_000), // 300k spent
    };
    const r = computeRitmo(input);
    expect(r.spentMonth).toBe(300_000);
    expect(r.periodBudget).toBe(1_000_000); // 300k spent + 700k available
    expect(r.spentFraction).toBeCloseTo(0.3, 5);
  });

  it("surfaces a negative availableTotal when pending obligations exceed liquid balance", () => {
    const input: RitmoInput = {
      today: "2026-05-21",
      endOfMonth: "2026-05-31",
      liquidBalance: 58_000,
      pendingObligations: 217_516,
      dailyOutflows: days("2026-05-01", 21, 0),
    };
    const r = computeRitmo(input);

    // availableTotal is signed so the UI can render "Disponible: −$159.516".
    expect(r.availableTotal).toBe(-159_516);
    // Daily allowance is clamped at zero so we never say "spend -$N per day".
    expect(r.availablePerDay).toBe(0);
    // Progress bar pegs at 100% — caller is fully overspent for the period.
    expect(r.spentFraction).toBe(1);
  });

  it("can exceed 1.0 on spentFraction when the user has overspent", () => {
    const input: RitmoInput = {
      today: "2026-05-25",
      endOfMonth: "2026-05-31",
      liquidBalance: 0,
      pendingObligations: 0,
      dailyOutflows: days("2026-05-01", 25, 50_000), // 1.25M spent, 0 available
    };
    const r = computeRitmo(input);
    expect(r.availableTotal).toBe(0);
    expect(r.periodBudget).toBe(1_250_000);
    expect(r.spentFraction).toBe(1);
  });

  it("classifies daily buckets relative to month-to-date average", () => {
    const outflows = [
      { date: "2026-05-01", expense: 10_000 },  // low: 25% of avg
      { date: "2026-05-02", expense: 40_000 },  // med
      { date: "2026-05-03", expense: 100_000 }, // high: 250% of avg
      { date: "2026-05-04", expense: 0 },       // none
    ];
    const input: RitmoInput = {
      today: "2026-05-04",
      endOfMonth: "2026-05-31",
      liquidBalance: 1_000_000,
      pendingObligations: 0,
      dailyOutflows: outflows,
    };
    const r = computeRitmo(input);

    // avg = 37,500 over 4 days
    expect(r.calendar[0].bucket).toBe("low");
    expect(r.calendar[1].bucket).toBe("med");
    expect(r.calendar[2].bucket).toBe("high");
    expect(r.calendar[3].bucket).toBe("none");
  });

  it("marks today + future flags on the calendar entries", () => {
    const input: RitmoInput = {
      today: "2026-05-21",
      endOfMonth: "2026-05-31",
      liquidBalance: 1_000_000,
      pendingObligations: 0,
      dailyOutflows: [
        { date: "2026-05-20", expense: 30_000 },
        { date: "2026-05-21", expense: 50_000 },
        { date: "2026-05-22", expense: 0 },
      ],
    };
    const r = computeRitmo(input);
    expect(r.calendar[0]).toMatchObject({ date: "2026-05-20", isToday: false, isFuture: false });
    expect(r.calendar[1]).toMatchObject({ date: "2026-05-21", isToday: true, isFuture: false });
    expect(r.calendar[2]).toMatchObject({ date: "2026-05-22", isToday: false, isFuture: true });
  });

  it("never divides by zero on empty months", () => {
    const input: RitmoInput = {
      today: "2026-05-01",
      endOfMonth: "2026-05-31",
      liquidBalance: 1_000_000,
      pendingObligations: 0,
      dailyOutflows: [],
    };
    const r = computeRitmo(input);
    expect(Number.isFinite(r.availablePerDay)).toBe(true);
    expect(Number.isFinite(r.spentFraction)).toBe(true);
  });
});

describe("deriveRitmoStatus", () => {
  const base = {
    availableTotal: 1_000_000,
    spentToday: 0,
    availablePerDay: 100_000,
  };

  it("returns te-pasaste when the period balance is negative", () => {
    expect(
      deriveRitmoStatus({ ...base, availableTotal: -1, spentFraction: 0 }),
    ).toEqual({ tone: "debt", label: "Te pasaste", state: "te-pasaste" });
  });

  it("returns te-pasaste when today's spend exceeds the daily allowance", () => {
    expect(
      deriveRitmoStatus({ ...base, spentToday: 150_000, spentFraction: 0 }),
    ).toEqual({ tone: "debt", label: "Te pasaste", state: "te-pasaste" });
  });

  it("returns cerca at 75% of the period budget", () => {
    expect(deriveRitmoStatus({ ...base, spentFraction: 0.75 })).toEqual({
      tone: "alert",
      label: "Cerca del límite",
      state: "cerca",
    });
  });

  it("returns vas-bien below the 75% threshold", () => {
    expect(deriveRitmoStatus({ ...base, spentFraction: 0.74 })).toEqual({
      tone: "income",
      label: "Vas bien",
      state: "vas-bien",
    });
  });
});
