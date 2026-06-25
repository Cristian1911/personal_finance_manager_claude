import { expect, test } from "vitest";
import { fixedVsVariable } from "./fixed-variable";
import type { AnalyticsConfig, AnalyticsTx } from "./types";

const cfg: AnalyticsConfig = {
  months: ["2026-05", "2026-06"],
  debtAccountIds: new Set(),
  categoryMeta: new Map(),
  destinatarioMeta: new Map(),
};
const tx = (o: Partial<AnalyticsTx>): AnalyticsTx => ({
  amount: 0,
  direction: "OUTFLOW",
  date: "2026-06-01",
  categoryId: null,
  destinatarioId: null,
  accountId: "a",
  expenseType: "variable",
  ...o,
});

test("splits fixed/variable, treats null expenseType as variable, trends variable", () => {
  const r = fixedVsVariable(
    [
      tx({ amount: 1000, expenseType: "fixed" }),
      tx({ amount: 400, date: "2026-05-01", expenseType: "variable" }),
      tx({ amount: 600, date: "2026-06-01", expenseType: null }), // null → variable
    ],
    cfg,
  );
  expect(r.fixed).toBe(1000);
  expect(r.variable).toBe(1000);
  expect(r.variableSeries).toEqual([400, 600]);
  expect(r.variableMoM).toBe(50);
});
