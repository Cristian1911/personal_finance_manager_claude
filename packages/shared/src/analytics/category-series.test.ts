import { describe, expect, test } from "vitest";
import { categorySeries, movers } from "./category-series";
import type { AnalyticsConfig, AnalyticsTx } from "./types";

const cfg: AnalyticsConfig = {
  months: ["2026-05", "2026-06"],
  debtAccountIds: new Set(),
  categoryMeta: new Map([
    ["c1", { nameEs: "Comida", color: "#E8875A", expenseType: "variable", budgetTarget: null }],
    ["c2", { nameEs: "Transporte", color: "#768053", expenseType: "variable", budgetTarget: null }],
  ]),
  destinatarioMeta: new Map(),
};
const tx = (o: Partial<AnalyticsTx>): AnalyticsTx => ({
  amount: 0,
  direction: "OUTFLOW",
  date: "2026-06-01",
  categoryId: "c1",
  destinatarioId: null,
  accountId: "a",
  expenseType: "variable",
  ...o,
});

describe("categorySeries", () => {
  test("buckets OUTFLOW by category and month, ignores INFLOW, sorts by total desc", () => {
    const rows = [
      tx({ amount: 100, date: "2026-05-10", categoryId: "c1" }),
      tx({ amount: 150, date: "2026-06-12", categoryId: "c1" }),
      tx({ amount: 999, date: "2026-06-12", categoryId: "c1", direction: "INFLOW" }),
      tx({ amount: 300, date: "2026-06-01", categoryId: "c2" }),
    ];
    const out = categorySeries(rows, cfg);
    expect(out.map((c) => c.categoryId)).toEqual(["c2", "c1"]); // 300 > 250
    const comida = out.find((c) => c.categoryId === "c1")!;
    expect(comida.monthly).toEqual([100, 150]);
    expect(comida.total).toBe(250);
    expect(comida.momPct).toBe(50);
  });

  test("momPct is null when previous month is zero", () => {
    const out = categorySeries([tx({ amount: 50, date: "2026-06-05", categoryId: "c1" })], cfg);
    expect(out[0].momPct).toBeNull();
  });
});

describe("movers", () => {
  test("returns largest absolute MoM deltas first", () => {
    const series = categorySeries(
      [
        tx({ amount: 100, date: "2026-05-01", categoryId: "c1" }),
        tx({ amount: 120, date: "2026-06-01", categoryId: "c1" }), // +20%
        tx({ amount: 100, date: "2026-05-01", categoryId: "c2" }),
        tx({ amount: 50, date: "2026-06-01", categoryId: "c2" }), // -50%
      ],
      cfg,
    );
    const m = movers(series);
    expect(m[0].categoryId).toBe("c2");
    expect(m[0].deltaPct).toBe(-50);
  });
});
