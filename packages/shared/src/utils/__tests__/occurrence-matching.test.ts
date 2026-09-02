import { describe, expect, it } from "vitest";
import {
  DEBT_PAYMENT_COVER_LOOKAHEAD_DAYS,
  debtPaymentCoversOccurrence,
  isDebtPaymentInCoverWindow,
  occurrenceAmountMatches,
  pickCoveredDebtOccurrence,
} from "../occurrence-matching";

describe("occurrenceAmountMatches", () => {
  it("unanchored is near-exact (1%)", () => {
    expect(occurrenceAmountMatches(219_591.28, 219_591, false)).toBe(true);
    expect(occurrenceAmountMatches(219_591.28, 3_646_525, false)).toBe(false);
  });
});

describe("debtPaymentCoversOccurrence", () => {
  it("a payment at or above the minimum covers it", () => {
    expect(debtPaymentCoversOccurrence(219_591.28, 3_646_525)).toBe(true);
    expect(debtPaymentCoversOccurrence(219_591.28, 219_591.28)).toBe(true);
  });

  it("a rounded payment a few cents short still covers", () => {
    expect(debtPaymentCoversOccurrence(219_591.28, 219_591)).toBe(true);
  });

  it("a payment below the minimum does not cover", () => {
    expect(debtPaymentCoversOccurrence(219_591.28, 200_000)).toBe(false);
    expect(debtPaymentCoversOccurrence(0, 100)).toBe(false);
    expect(debtPaymentCoversOccurrence(100, 0)).toBe(false);
  });
});

describe("isDebtPaymentInCoverWindow", () => {
  const due = "2026-09-01";

  it("accepts a payment right after the cut (Nu: Aug 17/18 for Sep 1)", () => {
    expect(isDebtPaymentInCoverWindow(due, "2026-08-17")).toBe(true);
    expect(isDebtPaymentInCoverWindow(due, "2026-08-18")).toBe(true);
  });

  it("accepts the due date and the regular ±3 tail after it", () => {
    expect(isDebtPaymentInCoverWindow(due, "2026-09-01")).toBe(true);
    expect(isDebtPaymentInCoverWindow(due, "2026-09-04")).toBe(true);
    expect(isDebtPaymentInCoverWindow(due, "2026-09-05")).toBe(false);
  });

  it("rejects a payment from the previous cycle", () => {
    expect(DEBT_PAYMENT_COVER_LOOKAHEAD_DAYS).toBe(21);
    expect(isDebtPaymentInCoverWindow(due, "2026-08-11")).toBe(true);
    expect(isDebtPaymentInCoverWindow(due, "2026-08-10")).toBe(false);
  });
});

describe("pickCoveredDebtOccurrence", () => {
  const sep1 = { id: "sep1", occurrenceDate: "2026-09-01", expectedAmount: 219_591.28 };
  const oct1 = { id: "oct1", occurrenceDate: "2026-10-01", expectedAmount: 219_591.28 };

  it("picks the next due occurrence the payment covers", () => {
    expect(pickCoveredDebtOccurrence("2026-08-18", 3_646_525, [oct1, sep1])).toBe(sep1);
  });

  it("ignores occurrences outside the window", () => {
    expect(pickCoveredDebtOccurrence("2026-09-20", 3_646_525, [sep1])).toBeNull();
    expect(pickCoveredDebtOccurrence("2026-09-20", 3_646_525, [sep1, oct1])).toBe(oct1);
  });

  it("returns null when the payment is below the minimum", () => {
    expect(pickCoveredDebtOccurrence("2026-08-18", 100_000, [sep1])).toBeNull();
  });
});
