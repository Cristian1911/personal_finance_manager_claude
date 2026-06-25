import { expect, test } from "vitest";
import { incomeVsExpenseSeries, savingsRateSeries } from "./cashflow";
import type { AnalyticsConfig, AnalyticsTx } from "./types";

const cfg: AnalyticsConfig = {
  months: ["2026-06"],
  debtAccountIds: new Set(["debtAcct"]),
  categoryMeta: new Map(),
  destinatarioMeta: new Map(),
};
const tx = (o: Partial<AnalyticsTx>): AnalyticsTx => ({
  amount: 0,
  direction: "OUTFLOW",
  date: "2026-06-01",
  categoryId: null,
  destinatarioId: null,
  accountId: "checking",
  expenseType: null,
  ...o,
});

test("income excludes INFLOW to debt accounts", () => {
  const rows = [
    tx({ amount: 1000, direction: "INFLOW", accountId: "checking" }), // income
    tx({ amount: 500, direction: "INFLOW", accountId: "debtAcct" }), // debt payment — NOT income
    tx({ amount: 200, direction: "OUTFLOW", accountId: "checking" }), // expense
  ];
  const [p] = incomeVsExpenseSeries(rows, cfg);
  expect(p.income).toBe(1000);
  expect(p.expense).toBe(200);
  expect(p.net).toBe(800);
});

test("savings rate = (income - expense) / income, null when income is 0", () => {
  const withIncome = savingsRateSeries(
    [
      tx({ amount: 1000, direction: "INFLOW", accountId: "checking" }),
      tx({ amount: 250, direction: "OUTFLOW", accountId: "checking" }),
    ],
    cfg,
  );
  expect(withIncome[0].rate).toBeCloseTo(0.75);

  const noIncome = savingsRateSeries([tx({ amount: 100, direction: "OUTFLOW" })], cfg);
  expect(noIncome[0].rate).toBeNull();
});
