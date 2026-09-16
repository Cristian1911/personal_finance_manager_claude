import { describe, it, expect } from "vitest";
import {
  detectRecurringCandidates,
  type RecurringCandidateTransaction,
} from "../recurring-candidates";

let seq = 0;
function tx(
  overrides: Partial<RecurringCandidateTransaction> & { transaction_date: string },
): RecurringCandidateTransaction {
  seq += 1;
  return {
    id: `tx-${seq}`,
    destinatario_id: "dest-netflix",
    clean_description: "NETFLIX.COM 866-579",
    amount: 26900,
    currency_code: "COP",
    direction: "OUTFLOW",
    flow_class: "SPEND",
    ...overrides,
  };
}

describe("detectRecurringCandidates", () => {
  it("two charges on the same day of consecutive months are a candidate", () => {
    const a = tx({ transaction_date: "2026-08-05" });
    const b = tx({ transaction_date: "2026-09-05" });
    const out = detectRecurringCandidates([b, a]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      key: "dest:dest-netflix:COP",
      destinatario_id: "dest-netflix",
      currency_code: "COP",
      transaction_ids: [a.id, b.id],
      dates: ["2026-08-05", "2026-09-05"],
      amounts: [26900, 26900],
      median_amount: 26900,
      day_of_month: 5,
    });
  });

  it("a 30-day gap counts as monthly even when the day of month drifts", () => {
    const out = detectRecurringCandidates([
      tx({ transaction_date: "2026-07-03" }),
      tx({ transaction_date: "2026-08-02" }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("31 Jan → 28 Feb (gap 28, day drift 3) is a candidate", () => {
    const out = detectRecurringCandidates([
      tx({ transaction_date: "2026-01-31" }),
      tx({ transaction_date: "2026-02-28" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].day_of_month).toBe(28);
  });

  it("a 20-day gap is not monthly", () => {
    const out = detectRecurringCandidates([
      tx({ transaction_date: "2026-08-05" }),
      tx({ transaction_date: "2026-08-25" }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("a skipped month (gap ≈ 61) is not a candidate even on the same day", () => {
    const out = detectRecurringCandidates([
      tx({ transaction_date: "2026-06-05" }),
      tx({ transaction_date: "2026-08-05" }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("amounts spread more than 10% of the median break the candidate", () => {
    const out = detectRecurringCandidates([
      tx({ transaction_date: "2026-08-05", amount: 26900 }),
      tx({ transaction_date: "2026-09-05", amount: 32000 }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("a small price change (under 10%) keeps the candidate", () => {
    const out = detectRecurringCandidates([
      tx({ transaction_date: "2026-08-05", amount: 26900 }),
      tx({ transaction_date: "2026-09-05", amount: 29000 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].median_amount).toBe(27950);
  });

  it("debt payments, transfers and withdrawals are excluded", () => {
    for (const flow of [
      "DEBT_PAYMENT",
      "DEBT_CREDIT",
      "DEBT_DRAWDOWN",
      "SELF_TRANSFER",
      "CASH_WITHDRAWAL",
    ]) {
      const out = detectRecurringCandidates([
        tx({ transaction_date: "2026-08-05", flow_class: flow }),
        tx({ transaction_date: "2026-09-05", flow_class: flow }),
      ]);
      expect(out, flow).toHaveLength(0);
    }
  });

  it("bank fees and unclassified rows stay in", () => {
    expect(
      detectRecurringCandidates([
        tx({ transaction_date: "2026-08-05", flow_class: "BANK_FEE" }),
        tx({ transaction_date: "2026-09-05", flow_class: "BANK_FEE" }),
      ]),
    ).toHaveLength(1);
    expect(
      detectRecurringCandidates([
        tx({ transaction_date: "2026-08-05", flow_class: null }),
        tx({ transaction_date: "2026-09-05", flow_class: null }),
      ]),
    ).toHaveLength(1);
  });

  it("inflows are ignored", () => {
    const out = detectRecurringCandidates([
      tx({ transaction_date: "2026-08-05", direction: "INFLOW" }),
      tx({ transaction_date: "2026-09-05", direction: "INFLOW" }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("without a destinatario, rows group by the normalized clean description", () => {
    const out = detectRecurringCandidates([
      tx({
        transaction_date: "2026-08-05",
        destinatario_id: null,
        clean_description: "PAGO NETFLIX.COM 866-579",
      }),
      tx({
        transaction_date: "2026-09-05",
        destinatario_id: null,
        clean_description: "netflix.com 866-579",
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].destinatario_id).toBeNull();
    expect(out[0].key).toBe("desc:NETFLIX.COM 866-579:COP");
  });

  it("rows with neither destinatario nor description are skipped", () => {
    const out = detectRecurringCandidates([
      tx({ transaction_date: "2026-08-05", destinatario_id: null, clean_description: null }),
      tx({ transaction_date: "2026-09-05", destinatario_id: null, clean_description: "  " }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("the same merchant in two currencies is two groups, not one", () => {
    const out = detectRecurringCandidates([
      tx({ transaction_date: "2026-08-05", currency_code: "COP" }),
      tx({ transaction_date: "2026-09-05", currency_code: "USD", amount: 7 }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("three charges with one bad gap are not a candidate", () => {
    const out = detectRecurringCandidates([
      tx({ transaction_date: "2026-07-05" }),
      tx({ transaction_date: "2026-08-05" }),
      tx({ transaction_date: "2026-09-20" }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("three clean monthly charges report the median and the latest day", () => {
    const out = detectRecurringCandidates([
      tx({ transaction_date: "2026-09-06", amount: 27500 }),
      tx({ transaction_date: "2026-07-05", amount: 26900 }),
      tx({ transaction_date: "2026-08-05", amount: 26900 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].dates).toEqual(["2026-07-05", "2026-08-05", "2026-09-06"]);
    expect(out[0].median_amount).toBe(26900);
    expect(out[0].day_of_month).toBe(6);
  });

  it("minOccurrences is configurable", () => {
    const rows = [tx({ transaction_date: "2026-08-05" }), tx({ transaction_date: "2026-09-05" })];
    expect(detectRecurringCandidates(rows, { minOccurrences: 3 })).toHaveLength(0);
  });
});
