import { describe, expect, it } from "vitest";
import {
  calendarDayDiff,
  DEBT_PAYMENT_COVER_LOOKAHEAD_DAYS,
  debtPaymentCoversOccurrence,
  isDebtPaymentInCoverWindow,
  merchantNameSimilarity,
  occurrenceAmountMatches,
  occurrenceIdentityScore,
  pickCoveredDebtOccurrence,
  scoreOccurrenceCandidate,
} from "../occurrence-matching";

const ANTHROPIC = "82010ef0-78de-461c-9aab-2182986b0c2d";
const OTHER = "6b31c44e-290f-440a-af03-8626ab113b7e";

describe("occurrenceAmountMatches", () => {
  it("unanchored is near-exact (1%)", () => {
    expect(occurrenceAmountMatches(219_591.28, 219_591, false)).toBe(true);
    expect(occurrenceAmountMatches(219_591.28, 3_646_525, false)).toBe(false);
  });

  it("anchored band absorbs a 6% drift, unanchored does not", () => {
    expect(occurrenceAmountMatches(71306.4, 67156.4, true)).toBe(true);
    expect(occurrenceAmountMatches(71306.4, 67156.4, false)).toBe(false);
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

describe("merchantNameSimilarity", () => {
  it("finds the shared merchant token through punctuation and filler", () => {
    expect(merchantNameSimilarity("Claude La Maria", "ANTHROPIC* CLAUDE SUB")).toBe(0.5);
    // "Claude.Ai Subscription" reduces to the single identity token CLAUDE
    // (AI is too short, SUBSCRIPTION is filler), and that token is shared.
    expect(merchantNameSimilarity("Claude La Maria", "Claude.Ai Subscription")).toBe(1);
  });

  it("is zero for unrelated merchants and empty input", () => {
    expect(merchantNameSimilarity("Claude La Maria", "PAGO CAC*DROGUERIA MEDIPAL")).toBe(0);
    expect(merchantNameSimilarity("", "ANTHROPIC")).toBe(0);
    expect(merchantNameSimilarity("Pago", "Compra")).toBe(0);
  });
});

describe("occurrenceIdentityScore", () => {
  const rules = [
    { pattern: "claude.ai subscription", match_type: "contains" as const },
    { pattern: "Anthropic", match_type: "contains" as const },
  ];

  it("same destinatario is a full match", () => {
    expect(
      occurrenceIdentityScore({
        txDestinatarioId: ANTHROPIC,
        templateDestinatarioId: ANTHROPIC,
        txDescription: "whatever",
        templateName: "Claude La Maria",
      }),
    ).toBe(1);
  });

  it("a different known destinatario is evidence against the link", () => {
    expect(
      occurrenceIdentityScore({
        txDestinatarioId: OTHER,
        templateDestinatarioId: ANTHROPIC,
        txDescription: "Anthropic* Claude Sub",
        templateName: "Claude La Maria",
      }),
    ).toBe(0);
  });

  it("an unassigned transaction that hits the destinatario's pattern is a full match", () => {
    expect(
      occurrenceIdentityScore({
        txDestinatarioId: null,
        templateDestinatarioId: ANTHROPIC,
        txDescription: "ANTHROPIC* CLAUDE SUB",
        templateName: "Claude La Maria",
        templateRules: rules,
      }),
    ).toBe(1);
  });

  it("tests exact rules field by field, never against the concatenation", () => {
    const exact = [{ pattern: "NETFLIX", match_type: "exact" as const }];
    expect(
      occurrenceIdentityScore({
        txDestinatarioId: null,
        templateDestinatarioId: ANTHROPIC,
        txDescription: ["NETFLIX", "Netflix"],
        templateName: "Netflix familiar",
        templateRules: exact,
      }),
    ).toBe(1);
    expect(
      occurrenceIdentityScore({
        txDestinatarioId: null,
        templateDestinatarioId: ANTHROPIC,
        txDescription: ["NETFLIX.COM", "Netflix Inc"],
        templateName: "Streaming",
        templateRules: exact,
      }),
    ).toBe(0);
  });

  it("falls back to name overlap when nothing is anchored", () => {
    expect(
      occurrenceIdentityScore({
        txDestinatarioId: null,
        templateDestinatarioId: null,
        txDescription: "Anthropic* Claude Sub",
        templateName: "Claude La Maria",
      }),
    ).toBe(0.5);
  });
});

describe("scoreOccurrenceCandidate", () => {
  it("ranks last cycle's charge from the tracked merchant above an unrelated nearby charge", () => {
    // Occurrence: Claude La Maria, 71,306 expected on 2026-08-06.
    const anthropicLastCycle = scoreOccurrenceCandidate({
      dayDiff: calendarDayDiff("2026-07-06", "2026-08-06"),
      expectedAmount: 71306.4,
      amount: 67156.4,
      identity: 1,
    });
    const unrelatedPago = scoreOccurrenceCandidate({
      dayDiff: calendarDayDiff("2026-07-28", "2026-08-06"),
      expectedAmount: 71306.4,
      amount: 50971,
      identity: 0,
    });
    expect(anthropicLastCycle).toBeGreaterThan(unrelatedPago);
  });

  it("the real charge on the due date scores near 1", () => {
    const score = scoreOccurrenceCandidate({
      dayDiff: 0,
      expectedAmount: 71306.4,
      amount: 71306.4,
      identity: 1,
    });
    expect(score).toBeCloseTo(1, 5);
  });

  it("amount still separates two templates sharing one destinatario", () => {
    // Both Claude templates anchor to Anthropic; only the amount tells them apart.
    const sister = scoreOccurrenceCandidate({ dayDiff: 0, expectedAmount: 71306.4, amount: 67156.4, identity: 1 });
    const own = scoreOccurrenceCandidate({ dayDiff: 0, expectedAmount: 333493, amount: 67156.4, identity: 1 });
    expect(sister).toBeGreaterThan(own);
  });

  it("never exceeds 1 or drops below 0", () => {
    expect(scoreOccurrenceCandidate({ dayDiff: 400, expectedAmount: 1, amount: 900, identity: 5 })).toBe(0.3);
    expect(scoreOccurrenceCandidate({ dayDiff: 0, expectedAmount: 0, amount: 1, identity: -1 })).toBe(0.4);
  });
});

describe("calendarDayDiff", () => {
  it("counts whole days regardless of order", () => {
    expect(calendarDayDiff("2026-08-06", "2026-07-06")).toBe(31);
    expect(calendarDayDiff("2026-07-06", "2026-08-06")).toBe(31);
    expect(calendarDayDiff("2026-08-06", "2026-08-06")).toBe(0);
  });
});
