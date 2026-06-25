import { expect, test } from "vitest";
import { anomalies } from "./anomalies";
import type { AnalyticsConfig, AnalyticsTx } from "./types";

const cfg: AnalyticsConfig = {
  months: ["2026-03", "2026-04", "2026-05", "2026-06"],
  debtAccountIds: new Set(),
  categoryMeta: new Map([["c1", { nameEs: "Compras", color: "#E8875A", expenseType: "variable", budgetTarget: null }]]),
  destinatarioMeta: new Map(),
};
const tx = (amount: number, month: string): AnalyticsTx => ({
  amount,
  direction: "OUTFLOW",
  date: `${month}-15`,
  categoryId: "c1",
  destinatarioId: null,
  accountId: "a",
  expenseType: "variable",
});

test("flags a month >= max(2.5x trailing mean, mean+2sigma)", () => {
  // baseline ~100 for 3 months, then a 400 spike (4x)
  const out = anomalies([tx(100, "2026-03"), tx(100, "2026-04"), tx(100, "2026-05"), tx(400, "2026-06")], cfg);
  expect(out).toHaveLength(1);
  expect(out[0].month).toBe("2026-06");
  expect(out[0].multiple).toBeCloseTo(4);
});

test("does not flag steady spending", () => {
  const out = anomalies([tx(100, "2026-03"), tx(105, "2026-04"), tx(95, "2026-05"), tx(102, "2026-06")], cfg);
  expect(out).toHaveLength(0);
});
