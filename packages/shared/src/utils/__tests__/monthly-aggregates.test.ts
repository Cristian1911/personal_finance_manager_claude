import { describe, expect, it } from "vitest";
import {
  computeMonthlyAggregates,
  type AggregatableTransaction,
} from "../monthly-aggregates";

function tx(overrides: Partial<AggregatableTransaction>): AggregatableTransaction {
  return {
    amount: 0,
    direction: "OUTFLOW",
    account_id: "acct-checking",
    category_id: "cat-food",
    is_excluded: false,
    reconciled_into_transaction_id: null,
    transaction_date: "2026-05-15",
    ...overrides,
  };
}

const debtAccountIds = new Set(["acct-credit-card", "acct-loan"]);

describe("computeMonthlyAggregates", () => {
  it("counts only non-excluded, non-reconciled rows", () => {
    const rows: AggregatableTransaction[] = [
      tx({ amount: 100, direction: "OUTFLOW" }),
      tx({ amount: 50, direction: "OUTFLOW", is_excluded: true }),
      tx({ amount: 75, direction: "OUTFLOW", reconciled_into_transaction_id: "other" }),
      // SQLite returns is_excluded as 0/1, not boolean — accept both.
      tx({ amount: 25, direction: "OUTFLOW", is_excluded: 1 }),
    ];

    const result = computeMonthlyAggregates(rows, { debtAccountIds });
    expect(result.count).toBe(1);
    expect(result.totalOutflow).toBe(100);
  });

  it("excludes INFLOWs into debt accounts from totalInflow but still counts them", () => {
    const rows: AggregatableTransaction[] = [
      tx({ amount: 1000, direction: "INFLOW", account_id: "acct-checking" }),
      tx({ amount: 500, direction: "INFLOW", account_id: "acct-credit-card" }),
      tx({ amount: 300, direction: "INFLOW", account_id: "acct-loan" }),
    ];

    const result = computeMonthlyAggregates(rows, { debtAccountIds });
    expect(result.totalInflow).toBe(1000);
    expect(result.count).toBe(3);
  });

  it("counts uncategorized only on OUTFLOWs", () => {
    const rows: AggregatableTransaction[] = [
      tx({ direction: "OUTFLOW", category_id: null }),
      tx({ direction: "OUTFLOW", category_id: "cat-food" }),
      tx({ direction: "INFLOW", category_id: null }),
    ];

    const result = computeMonthlyAggregates(rows, { debtAccountIds });
    expect(result.uncategorizedCount).toBe(1);
  });

  it("builds daysByDate sorted ascending with debt-INFLOW exclusion baked in", () => {
    const rows: AggregatableTransaction[] = [
      tx({ amount: 100, direction: "OUTFLOW", transaction_date: "2026-05-15" }),
      tx({ amount: 500, direction: "INFLOW", transaction_date: "2026-05-15", account_id: "acct-checking" }),
      tx({ amount: 200, direction: "INFLOW", transaction_date: "2026-05-15", account_id: "acct-credit-card" }),
      tx({ amount: 50, direction: "OUTFLOW", transaction_date: "2026-05-01" }),
    ];

    const result = computeMonthlyAggregates(rows, { debtAccountIds });
    expect(result.daysByDate).toEqual([
      { date: "2026-05-01", income: 0, expense: 50 },
      { date: "2026-05-15", income: 500, expense: 100 },
    ]);
  });

  it("withDaysByDate: false skips the per-day buckets", () => {
    const rows = [tx({ amount: 100, direction: "OUTFLOW" })];
    const result = computeMonthlyAggregates(rows, {
      debtAccountIds,
      withDaysByDate: false,
    });
    expect(result.daysByDate).toEqual([]);
    expect(result.count).toBe(1);
    expect(result.totalOutflow).toBe(100);
  });

  it("empty input returns zeros", () => {
    const result = computeMonthlyAggregates([], { debtAccountIds });
    expect(result).toEqual({
      count: 0,
      totalInflow: 0,
      totalOutflow: 0,
      uncategorizedCount: 0,
      daysByDate: [],
    });
  });
});

// flow_class is deliberately NOT honoured by computeMonthlyAggregates yet — see
// the comment in monthly-aggregates.ts. Turning it on requires the column in
// both the webapp slim select and the mobile SQLite projection, or the same
// Movimientos screen reports two different totals depending on whether a filter
// is active. The tests for that behaviour land with the change that wires both.
describe("flow_class is not honoured yet", () => {
  const base = {
    account_id: "acct",
    category_id: "cat",
    is_excluded: false,
    reconciled_into_transaction_id: null,
    transaction_date: "2026-04-10",
  };

  it("a row carrying flow_class still follows the debtAccountIds heuristic", () => {
    const r = computeMonthlyAggregates(
      [{ ...base, amount: 2024211, direction: "OUTFLOW", flow_class: "DEBT_PAYMENT" }],
      { debtAccountIds: new Set(), withDaysByDate: false },
    );
    expect(r.totalOutflow).toBe(2024211);
  });
});
