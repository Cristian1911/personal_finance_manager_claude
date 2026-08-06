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

// ─────────────────────────────────────────────────────────────────
// flow_class takes precedence over the account-type heuristic
// ─────────────────────────────────────────────────────────────────
describe("flow_class support", () => {
  const base = {
    account_id: "acct",
    category_id: "cat",
    is_excluded: false,
    reconciled_into_transaction_id: null,
    transaction_date: "2026-04-10",
  };

  it("a loan disbursed into a liquid account is not income", () => {
    // The account is a savings account, so debtAccountIds cannot catch this.
    // Before flow_class, $22.441.478 of new debt was reported as income.
    const r = computeMonthlyAggregates(
      [{ ...base, amount: 22441478, direction: "INFLOW", flow_class: "DEBT_DRAWDOWN" }],
      { debtAccountIds: new Set(), withDaysByDate: false },
    );
    expect(r.totalInflow).toBe(0);
  });

  it("a card payment is not spending", () => {
    const r = computeMonthlyAggregates(
      [{ ...base, amount: 2024211, direction: "OUTFLOW", flow_class: "DEBT_PAYMENT" }],
      { debtAccountIds: new Set(), withDaysByDate: false },
    );
    expect(r.totalOutflow).toBe(0);
    expect(r.uncategorizedCount).toBe(0);
  });

  it("a user override beats the machine verdict", () => {
    const r = computeMonthlyAggregates(
      [
        {
          ...base,
          amount: 500000,
          direction: "OUTFLOW",
          flow_class: "SPEND",
          flow_class_override: "SELF_TRANSFER",
        },
      ],
      { debtAccountIds: new Set(), withDaysByDate: false },
    );
    expect(r.totalOutflow).toBe(0);
  });

  it("rows without flow_class keep the old debtAccountIds behaviour", () => {
    const r = computeMonthlyAggregates(
      [
        { ...base, account_id: "debt", amount: 100, direction: "INFLOW" },
        { ...base, amount: 200, direction: "INFLOW" },
        { ...base, amount: 50, direction: "OUTFLOW" },
      ],
      { debtAccountIds: new Set(["debt"]), withDaysByDate: false },
    );
    expect(r.totalInflow).toBe(200);
    expect(r.totalOutflow).toBe(50);
  });

  it("daily buckets honour flow_class too", () => {
    const r = computeMonthlyAggregates(
      [
        { ...base, amount: 900, direction: "OUTFLOW", flow_class: "DEBT_PAYMENT" },
        { ...base, amount: 100, direction: "OUTFLOW", flow_class: "SPEND" },
      ],
      { debtAccountIds: new Set(), withDaysByDate: true },
    );
    expect(r.daysByDate).toEqual([{ date: "2026-04-10", income: 0, expense: 100 }]);
  });
});
