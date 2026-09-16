import { describe, it, expect } from "vitest";
import { allocateRepaidAcrossRows } from "../allocate-repaid";

const row = (id: string, amount: number | null, cuota: number | null, date = "2026-01-01") => ({
  id, amount, installment_current: cuota, transaction_date: date,
});

describe("allocateRepaidAcrossRows", () => {
  it("clamps a single row to its amount", () => {
    const out = allocateRepaidAcrossRows([row("a", 100, null)], 250);
    expect(out.get("a")).toBe(100);
  });

  it("fills cuotas in order and leaves the excess unallocated", () => {
    const out = allocateRepaidAcrossRows(
      [row("c2", 50, 2, "2026-02-05"), row("c1", 50, 1, "2026-01-05"), row("c3", 50, 3, "2026-03-05")],
      120,
    );
    expect(out.get("c1")).toBe(50);
    expect(out.get("c2")).toBe(50);
    expect(out.get("c3")).toBe(20);
  });

  it("orders by date when there is no cuota number, nulls last", () => {
    const out = allocateRepaidAcrossRows(
      [row("late", 30, null, "2026-03-01"), row("early", 30, null, "2026-01-01"), row("cuota", 30, 1, "2026-05-01")],
      40,
    );
    expect(out.get("cuota")).toBe(30);
    expect(out.get("early")).toBe(10);
    expect(out.get("late")).toBe(0);
  });

  it("treats null amounts and negative repaid as zero", () => {
    const out = allocateRepaidAcrossRows([row("a", null, 1), row("b", 10, 2)], -5);
    expect(out.get("a")).toBe(0);
    expect(out.get("b")).toBe(0);
  });
});
