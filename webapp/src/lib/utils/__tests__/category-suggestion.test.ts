import { describe, it, expect } from "vitest";
import { findSuggestion } from "../category-suggestion";
import type { CategoryWithChildren } from "@/types/domain";

// Minimal category tree for testing
const categories: CategoryWithChildren[] = [
  {
    id: "parent-1", name: "Gustos", name_es: "Gustos", slug: "gustos",
    icon: "🎯", color: "#f59e0b", direction: "OUTFLOW", parent_id: null,
    is_active: true, is_essential: false, is_system: true, display_order: 0,
    user_id: null, created_at: "", updated_at: "", expense_type: null,
    children: [
      {
        id: "child-1", name: "Restaurants", name_es: "Restaurantes", slug: "restaurantes",
        icon: "🍕", color: "#f59e0b", direction: "OUTFLOW", parent_id: "parent-1",
        is_active: true, is_essential: false, is_system: true, display_order: 0,
        user_id: null, created_at: "", updated_at: "", expense_type: null,
        children: [],
      },
    ],
  },
];

type Rule = { pattern: string; category_id: string; match_count: number };

describe("findSuggestion", () => {
  it("returns suggestion when pattern matches and match_count >= 2", () => {
    const rules: Rule[] = [
      { pattern: "rappi", category_id: "child-1", match_count: 8 },
    ];
    const result = findSuggestion("RAPPI*Restaurante", rules, categories);
    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe("child-1");
    expect(result!.reason).toContain("8");
  });

  it("returns null when match_count < 2 (low confidence)", () => {
    const rules: Rule[] = [
      { pattern: "rappi", category_id: "child-1", match_count: 1 },
    ];
    const result = findSuggestion("RAPPI*Restaurante", rules, categories);
    expect(result).toBeNull();
  });

  it("returns null when no pattern matches", () => {
    const rules: Rule[] = [
      { pattern: "uber", category_id: "child-1", match_count: 5 },
    ];
    const result = findSuggestion("RAPPI*Restaurante", rules, categories);
    expect(result).toBeNull();
  });

  it("returns null for empty description", () => {
    const rules: Rule[] = [
      { pattern: "rappi", category_id: "child-1", match_count: 5 },
    ];
    expect(findSuggestion("", rules, categories)).toBeNull();
  });

  it("returns null when category_id points to inactive category", () => {
    const inactiveCategories: CategoryWithChildren[] = [
      {
        ...categories[0],
        children: [{ ...categories[0].children[0], is_active: false }],
      },
    ];
    const rules: Rule[] = [
      { pattern: "rappi", category_id: "child-1", match_count: 5 },
    ];
    expect(findSuggestion("RAPPI*Restaurante", rules, inactiveCategories)).toBeNull();
  });

  it("picks the highest match_count rule when multiple patterns match", () => {
    const rules: Rule[] = [
      { pattern: "rappi", category_id: "child-1", match_count: 3 },
      { pattern: "rappi*rest", category_id: "child-1", match_count: 10 },
    ];
    const result = findSuggestion("RAPPI*Restaurante", rules, categories);
    expect(result!.reason).toContain("10");
  });
});
