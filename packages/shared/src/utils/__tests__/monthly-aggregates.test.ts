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

describe("flow_class decides, with the old heuristic as fallback", () => {
  const base = {
    account_id: "acct",
    category_id: "cat",
    is_excluded: false,
    reconciled_into_transaction_id: null,
    transaction_date: "2026-04-10",
  };

  it("a debt payment is not spend, whatever account it sits on", () => {
    const r = computeMonthlyAggregates(
      [{ ...base, amount: 2024211, direction: "OUTFLOW", flow_class: "DEBT_PAYMENT" }],
      { debtAccountIds: new Set(), withDaysByDate: false },
    );
    expect(r.totalOutflow).toBe(0);
  });

  it("a loan disbursement into savings is not income", () => {
    const r = computeMonthlyAggregates(
      [{ ...base, amount: 22441478, direction: "INFLOW", flow_class: "DEBT_DRAWDOWN" }],
      { debtAccountIds: new Set(), withDaysByDate: false },
    );
    expect(r.totalInflow).toBe(0);
  });

  it("a user correction wins over the machine verdict", () => {
    const r = computeMonthlyAggregates(
      [{
        ...base,
        amount: 50000,
        direction: "OUTFLOW",
        flow_class: "SELF_TRANSFER",
        flow_class_override: "SPEND",
      }],
      { debtAccountIds: new Set(), withDaysByDate: false },
    );
    expect(r.totalOutflow).toBe(50000);
  });

  // Rows written before flow_class existed, and every row of a user whose
  // backfill has not run, must keep behaving exactly as they do today.
  it("falls back to debtAccountIds when the row carries no class", () => {
    const rows = [{ ...base, amount: 300000, direction: "INFLOW" as const }];
    expect(
      computeMonthlyAggregates(rows, {
        debtAccountIds: new Set(["acct"]),
        withDaysByDate: false,
      }).totalInflow,
    ).toBe(0);
    expect(
      computeMonthlyAggregates(rows, {
        debtAccountIds: new Set(),
        withDaysByDate: false,
      }).totalInflow,
    ).toBe(300000);
  });
});
