import { describe, expect, it } from "vitest";
import { quickCapturePreviewSchema, transactionSchema } from "../transaction";

const BASE = {
  account_id: "a0000001-0000-4000-8000-000000000001",
  amount: "1.17",
  currency_code: "USD",
  direction: "OUTFLOW",
  transaction_date: "2026-09-14",
};

describe("transactionSchema — cuotas (optional on credit-card movements)", () => {
  it("accepts a movement without cuota fields (alert emails, quick capture)", () => {
    const parsed = transactionSchema.safeParse(BASE);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.installment_current).toBeUndefined();
    expect(parsed.data.installment_total).toBeUndefined();
    expect(parsed.data.original_amount).toBeUndefined();
  });

  it("parses cuota position, count and full price from form strings", () => {
    const parsed = transactionSchema.safeParse({
      ...BASE,
      installment_current: "1",
      installment_total: "36",
      original_amount: "41.99",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.installment_current).toBe(1);
    expect(parsed.data.installment_total).toBe(36);
    expect(parsed.data.original_amount).toBe(41.99);
  });

  it("maps an emptied field to null so an edit can clear the cuotas", () => {
    const parsed = transactionSchema.safeParse({
      ...BASE,
      installment_current: null,
      installment_total: null,
      original_amount: null,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.installment_total).toBeNull();
    expect(parsed.data.original_amount).toBeNull();
  });

  it("rejects a cuota position past the count", () => {
    const parsed = transactionSchema.safeParse({
      ...BASE,
      installment_current: "5",
      installment_total: "3",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0].message).toMatch(/cuota actual/i);
  });

  it("rejects non-integer or non-positive cuotas", () => {
    expect(transactionSchema.safeParse({ ...BASE, installment_total: "2.5" }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...BASE, installment_total: "0" }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...BASE, original_amount: "-1" }).success).toBe(false);
  });

  it("keeps the quick-capture schema extending the base object", () => {
    const parsed = quickCapturePreviewSchema.safeParse({
      ...BASE,
      raw_description: "compra",
      merchant_name: "Nintendo",
      capture_input_text: "41.99 nintendo",
    });
    expect(parsed.success).toBe(true);
  });
});
