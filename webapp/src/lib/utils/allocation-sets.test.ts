import { describe, it, expect } from "vitest";
import { groupCategoriesByAllocationSet } from "./allocation-sets";
import type { CategoryBudgetData } from "@/types/domain";

// Minimal category stub — only the fields categoryBudgetGroup reads matter.
function cat(over: Partial<CategoryBudgetData>): CategoryBudgetData {
  return {
    id: over.id ?? "x",
    slug: over.slug ?? "otros",
    expense_type: over.expense_type ?? null,
    is_essential: over.is_essential ?? false,
    // The rest are unused by the helper; cast through unknown for the stub.
  } as unknown as CategoryBudgetData;
}

describe("groupCategoriesByAllocationSet", () => {
  it("buckets by set and computes caps from income", () => {
    const groups = [
      cat({ id: "rent", expense_type: "fixed" }),          // needs
      cat({ id: "fun", slug: "salidas" }),                 // wants
      cat({ id: "save", slug: "ahorro-e-inversion" }),     // savings
    ];
    const result = groupCategoriesByAllocationSet(groups, 1_000_000);
    expect(result.map((r) => r.set)).toEqual(["needs", "wants", "savings"]);
    expect(result.map((r) => r.cap)).toEqual([500_000, 300_000, 200_000]);
    expect(result.find((r) => r.set === "needs")!.groups.map((g) => g.id)).toEqual(["rent"]);
    expect(result.find((r) => r.set === "wants")!.groups.map((g) => g.id)).toEqual(["fun"]);
    expect(result.find((r) => r.set === "savings")!.groups.map((g) => g.id)).toEqual(["save"]);
  });

  it("returns all three sets even when some are empty", () => {
    const result = groupCategoriesByAllocationSet([cat({ id: "rent", expense_type: "fixed" })], 0);
    expect(result.map((r) => r.set)).toEqual(["needs", "wants", "savings"]);
    expect(result.map((r) => r.cap)).toEqual([0, 0, 0]);
  });
});
