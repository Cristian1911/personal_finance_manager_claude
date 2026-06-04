import { describe, it, expect } from "vitest";
import { buildWeeklyDigest, type WeeklyDigestInput } from "../weekly-digest";

const base: WeeklyDigestInput = {
  currency: "COP",
  thisWeekSpent: 200_000,
  lastWeekSpent: 200_000,
  topCategory: { name: "Restaurantes", amount: 80_000 },
  monthlyBudget: 2_000_000,
  monthSpentSoFar: 500_000, // pace by day 10/30 would be ~666k → within pace
  dayOfMonth: 10,
  daysInMonth: 30,
  upcomingPayments: [{ label: "Claro", amount: 89_900, dueDate: "2026-06-02" }],
  upcomingTotal: 89_900,
};

describe("buildWeeklyDigest", () => {
  it("computes the week-over-week spend delta", () => {
    const d = buildWeeklyDigest({ ...base, thisWeekSpent: 230_000, lastWeekSpent: 200_000 });
    expect(d.spentDeltaPct).toBe(15);
    expect(d.pushBody).toContain("más");
  });

  it("reports a decrease as 'menos'", () => {
    const d = buildWeeklyDigest({ ...base, thisWeekSpent: 180_000, lastWeekSpent: 200_000 });
    expect(d.spentDeltaPct).toBe(-10);
    expect(d.pushBody).toContain("menos");
    expect(d.verdict).toBe("on_track");
  });

  it("returns null delta + no comparison clause when there is no prior week", () => {
    const d = buildWeeklyDigest({ ...base, lastWeekSpent: 0 });
    expect(d.spentDeltaPct).toBeNull();
    expect(d.pushBody).not.toContain("semana pasada");
  });

  it("flags 'over' when month spend exceeds the monthly budget", () => {
    const d = buildWeeklyDigest({ ...base, monthSpentSoFar: 2_500_000 });
    expect(d.verdict).toBe("over");
    expect(d.emoji).toBeTruthy();
  });

  it("flags 'watch' on a sharp week-over-week jump even if under budget", () => {
    const d = buildWeeklyDigest({ ...base, thisWeekSpent: 300_000, lastWeekSpent: 200_000 });
    expect(d.verdict).toBe("watch");
  });

  it("flags 'watch' when month spend is ahead of the daily pace", () => {
    const d = buildWeeklyDigest({ ...base, monthSpentSoFar: 900_000 }); // > pace*1.1 (~733k)
    expect(d.verdict).toBe("watch");
  });

  it("omits the budget line when there is no budget, and verdict ignores pace", () => {
    const d = buildWeeklyDigest({ ...base, monthlyBudget: 0, monthSpentSoFar: 0, thisWeekSpent: 180_000 });
    expect(d.lines.some((l) => l.toLowerCase().includes("este mes"))).toBe(false);
    expect(d.verdict).toBe("on_track");
  });

  it("includes top-category and upcoming-payment lines when present", () => {
    const d = buildWeeklyDigest(base);
    expect(d.lines.some((l) => l.includes("Restaurantes"))).toBe(true);
    expect(d.lines.some((l) => l.toLowerCase().includes("próximos"))).toBe(true);
  });

  it("omits top-category and upcoming lines when absent", () => {
    const d = buildWeeklyDigest({ ...base, topCategory: null, upcomingPayments: [], upcomingTotal: 0 });
    expect(d.lines.some((l) => l.includes("Restaurantes"))).toBe(false);
    expect(d.lines.some((l) => l.toLowerCase().includes("próximos"))).toBe(false);
  });

  it("always includes the spend amount in the push body", () => {
    const d = buildWeeklyDigest(base);
    expect(d.pushBody).toContain("200.000");
    expect(d.title).toBeTruthy();
  });
});
