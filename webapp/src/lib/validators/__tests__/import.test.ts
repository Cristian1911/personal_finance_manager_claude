import { describe, it, expect } from "vitest";
import { transactionToImportSchema } from "../import";

const base = {
  account_id: "a0000001-0000-4000-8000-000000000001",
  amount: 120000,
  currency_code: "COP",
  direction: "OUTFLOW",
  transaction_date: "2026-08-10",
  raw_description: "RESTAURANTE",
};
const person = "b0000001-0000-4000-8000-000000000002";

describe("transactionToImportSchema enrichments", () => {
  it("accepts a row without enrichments", () => {
    const r = transactionToImportSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("normalizes an empty modo_id and accepts tags + share", () => {
    const r = transactionToImportSchema.safeParse({
      ...base,
      modo_id: "",
      tag_ids: [person],
      notes: "cena",
      share: { method: "equal", userIncluded: true, participants: [{ destinatario_id: person }], ea_rate_percent: 26 },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.modo_id).toBeUndefined();
      expect(r.data.share?.participants).toHaveLength(1);
    }
  });

  it("rejects a share with a bad person id, too many people or an absurd rate", () => {
    expect(
      transactionToImportSchema.safeParse({ ...base, share: { method: "equal", userIncluded: true, participants: [{ destinatario_id: "nope" }] } }).success,
    ).toBe(false);
    expect(
      transactionToImportSchema.safeParse({
        ...base,
        share: { method: "equal", userIncluded: true, participants: Array.from({ length: 13 }, () => ({ destinatario_id: person })) },
      }).success,
    ).toBe(false);
    expect(
      transactionToImportSchema.safeParse({
        ...base,
        share: { method: "percent", userIncluded: false, participants: [{ destinatario_id: person, value: 50 }], ea_rate_percent: 300 },
      }).success,
    ).toBe(false);
    expect(
      transactionToImportSchema.safeParse({
        ...base,
        share: { method: "percent", userIncluded: false, participants: [{ destinatario_id: person, value: 150 }] },
      }).success,
    ).toBe(false);
  });

  it("rejects invalid tag ids", () => {
    expect(transactionToImportSchema.safeParse({ ...base, tag_ids: ["x"] }).success).toBe(false);
  });
});
