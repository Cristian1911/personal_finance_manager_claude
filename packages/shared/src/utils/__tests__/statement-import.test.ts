import { describe, expect, it } from "vitest";
import {
  anchorStatementBalance,
  assignStatementOccurrenceIndexes,
  isManualBalanceAdjustment,
  validateStatementPeriodBalance,
} from "../statement-import";

describe("assignStatementOccurrenceIndexes", () => {
  const baseTx = {
    transactionDate: "2026-06-15",
    amount: 20000,
    rawDescription: "TRANSFERENCIA A NEQUI",
  };

  it("gives distinct indexes to identical rows within one statement", () => {
    const indexes = assignStatementOccurrenceIndexes([
      { ...baseTx, importKey: "0:0" },
      { ...baseTx, importKey: "0:1" },
      { ...baseTx, importKey: "0:2" },
    ]);
    expect(indexes).toEqual([1, 2, 3]);
  });

  it("restarts counting per statement so overlapping statements still dedup", () => {
    const indexes = assignStatementOccurrenceIndexes([
      { ...baseTx, importKey: "0:5" },
      { ...baseTx, importKey: "1:2" }, // same movement, second uploaded statement
    ]);
    expect(indexes).toEqual([1, 1]);
  });

  it("does not conflate rows that differ in date, amount, or description", () => {
    const indexes = assignStatementOccurrenceIndexes([
      { ...baseTx, importKey: "0:0" },
      { ...baseTx, importKey: "0:1", amount: 25000 },
      { ...baseTx, importKey: "0:2", transactionDate: "2026-06-16" },
      { ...baseTx, importKey: "0:3", rawDescription: "PAGO PSE" },
    ]);
    expect(indexes).toEqual([1, 1, 1, 1]);
  });

  it("keys on original_amount when present (installments)", () => {
    const indexes = assignStatementOccurrenceIndexes([
      { ...baseTx, importKey: "0:0", originalAmount: 120000, installmentCurrent: 1 },
      { ...baseTx, importKey: "0:1", originalAmount: 120000, installmentCurrent: 2 },
      { ...baseTx, importKey: "0:2", originalAmount: 120000, installmentCurrent: 1 },
    ]);
    expect(indexes).toEqual([1, 1, 2]);
  });

  it("treats missing importKey as a single shared scope", () => {
    const indexes = assignStatementOccurrenceIndexes([{ ...baseTx }, { ...baseTx }]);
    expect(indexes).toEqual([1, 2]);
  });
});

describe("anchorStatementBalance", () => {
  it("returns the statement final balance when nothing happened after the cutoff", () => {
    const result = anchorStatementBalance({
      finalBalance: 937_000,
      accountType: "SAVINGS",
      postCutoffTransactions: [],
    });
    expect(result).toEqual({ keepExisting: false, balance: 937_000, postCutoffCount: 0 });
  });

  it("replays post-cutoff movements on top of the statement final balance", () => {
    const result = anchorStatementBalance({
      finalBalance: 937_000,
      accountType: "SAVINGS",
      postCutoffTransactions: [
        { amount: 500_000, direction: "OUTFLOW" },
        { amount: 300_000, direction: "OUTFLOW" },
      ],
    });
    expect(result.keepExisting).toBe(false);
    expect(result.balance).toBe(137_000);
    expect(result.postCutoffCount).toBe(2);
  });

  it("keeps the existing balance when a post-cutoff manual adjustment re-anchored it", () => {
    const result = anchorStatementBalance({
      finalBalance: 937_000,
      accountType: "SAVINGS",
      postCutoffTransactions: [
        { amount: 800_000, direction: "OUTFLOW", rawDescription: "Ajuste manual de saldo COP (2026-07-05T10:00:00.000Z)" },
      ],
    });
    expect(result.keepExisting).toBe(true);
    expect(result.balance).toBeNull();
  });
});

describe("validateStatementPeriodBalance", () => {
  it("matches when app transactions walk previous to final balance", () => {
    const result = validateStatementPeriodBalance({
      previousBalance: 1_000_000,
      finalBalance: 937_000,
      accountType: "SAVINGS",
      periodTransactions: [
        { amount: 100_000, direction: "INFLOW" },
        { amount: 163_000, direction: "OUTFLOW" },
      ],
    });
    expect(result.matches).toBe(true);
    expect(result.computedBalance).toBe(937_000);
    expect(result.difference).toBe(0);
  });

  it("flags a positive difference when duplicated inflows inflate the period", () => {
    const result = validateStatementPeriodBalance({
      previousBalance: 1_000_000,
      finalBalance: 937_000,
      accountType: "SAVINGS",
      periodTransactions: [
        { amount: 100_000, direction: "INFLOW" },
        { amount: 100_000, direction: "INFLOW" }, // duplicate
        { amount: 163_000, direction: "OUTFLOW" },
      ],
    });
    expect(result.matches).toBe(false);
    expect(result.difference).toBe(100_000);
  });

  it("tolerates sub-peso rounding drift", () => {
    const result = validateStatementPeriodBalance({
      previousBalance: 100.4,
      finalBalance: 100,
      accountType: "SAVINGS",
      periodTransactions: [],
    });
    expect(result.matches).toBe(true);
  });
});

describe("isManualBalanceAdjustment", () => {
  it("matches the adjustment prefix and rejects everything else", () => {
    expect(isManualBalanceAdjustment("Ajuste manual de saldo COP (2026-07-05)")).toBe(true);
    expect(isManualBalanceAdjustment("PAGO PSE")).toBe(false);
    expect(isManualBalanceAdjustment(null)).toBe(false);
    expect(isManualBalanceAdjustment(undefined)).toBe(false);
  });
});
