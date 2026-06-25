import { expect, test } from "vitest";
import { budgetAdherenceSeries } from "./budget-adherence";
import type { AnalyticsConfig, AnalyticsTx } from "./types";

const cfg: AnalyticsConfig = {
  months: ["2026-05", "2026-06"],
  debtAccountIds: new Set(),
  categoryMeta: new Map([
    ["c1", { nameEs: "Restaurantes", color: "#937844", expenseType: "variable", budgetTarget: 100 }],
    ["c2", { nameEs: "Sin meta", color: "#768053", expenseType: "variable", budgetTarget: null }],
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

test("counts months within/exceeded vs target; skips categories with no budget", () => {
  const out = budgetAdherenceSeries(
    [
      tx({ amount: 80, date: "2026-05-01", categoryId: "c1" }), // within (<=100)
      tx({ amount: 150, date: "2026-06-01", categoryId: "c1" }), // exceeded
      tx({ amount: 500, date: "2026-06-01", categoryId: "c2" }), // no budget → skipped
    ],
    cfg,
  );
  expect(out).toHaveLength(1);
  expect(out[0].categoryId).toBe("c1");
  expect(out[0].monthsWithin).toBe(1);
  expect(out[0].monthsExceeded).toBe(1);
});
