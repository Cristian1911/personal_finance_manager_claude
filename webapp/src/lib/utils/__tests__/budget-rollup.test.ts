import { describe, expect, it } from "vitest";
import { rollupGroup, computeCompositionDiff } from "../budget-rollup";

describe("rollupGroup", () => {
  it("parent-only group (today's simple budget)", () => {
    const r = rollupGroup({ baseBudget: 700_000, childBudgets: {}, parentSpent: 350_000, childrenSpent: {} });
    expect(r).toEqual({ totalBudget: 700_000, totalSpent: 350_000, percentUsed: 50 });
  });

  it("subs-only group (composed without Base)", () => {
    const r = rollupGroup({
      baseBudget: null,
      childBudgets: { a: 220_000, b: 450_000 },
      parentSpent: 30_000, // tx categorized directly at parent still counts
      childrenSpent: { a: 110_000 },
    });
    expect(r.totalBudget).toBe(670_000);
    expect(r.totalSpent).toBe(140_000);
    expect(r.percentUsed).toBeCloseTo((140_000 / 670_000) * 100);
  });

  it("mixed: Base + lines", () => {
    const r = rollupGroup({ baseBudget: 100_000, childBudgets: { a: 50_000 }, parentSpent: 0, childrenSpent: {} });
    expect(r.totalBudget).toBe(150_000);
  });

  it("no budget rows at all → totalBudget null, percent 0", () => {
    const r = rollupGroup({ baseBudget: null, childBudgets: {}, parentSpent: 90_000, childrenSpent: { a: 10_000 } });
    expect(r.totalBudget).toBeNull();
    expect(r.totalSpent).toBe(100_000);
    expect(r.percentUsed).toBe(0);
  });

  it("zero total budget → percent 0 (no division by zero)", () => {
    const r = rollupGroup({ baseBudget: 0, childBudgets: {}, parentSpent: 50_000, childrenSpent: {} });
    expect(r.totalBudget).toBe(0);
    expect(r.percentUsed).toBe(0);
  });
});

describe("computeCompositionDiff", () => {
  it("new and changed amounts become upserts", () => {
    const d = computeCompositionDiff({ a: 100 }, { a: 150, b: 200 });
    expect(d.upserts).toEqual([
      { category_id: "a", amount: 150 },
      { category_id: "b", amount: 200 },
    ]);
    expect(d.deletes).toEqual([]);
  });

  it("unchanged amounts produce no operations", () => {
    const d = computeCompositionDiff({ a: 100 }, { a: 100 });
    expect(d.upserts).toEqual([]);
    expect(d.deletes).toEqual([]);
  });

  it("cleared lines (0 or removed) become deletes", () => {
    const d = computeCompositionDiff({ a: 100, b: 50 }, { a: 0 });
    expect(d.upserts).toEqual([]);
    expect(d.deletes.sort()).toEqual(["a", "b"]);
  });

  it("a line that never existed and stays 0 produces nothing", () => {
    const d = computeCompositionDiff({}, { a: 0 });
    expect(d.upserts).toEqual([]);
    expect(d.deletes).toEqual([]);
  });
});
