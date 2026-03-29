import type { CategoryWithChildren } from "@/types/domain";

type CategoryRule = {
  pattern: string;
  category_id: string;
  match_count: number;
};

export type CategorySuggestion = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  parentName: string | null;
  reason: string;
};

const MIN_CONFIDENCE = 2;

/**
 * Find a high-confidence category suggestion for a transaction description.
 * Returns null if no rule matches with sufficient confidence.
 */
export function findSuggestion(
  description: string,
  rules: CategoryRule[],
  categories: CategoryWithChildren[]
): CategorySuggestion | null {
  if (!description.trim()) return null;

  const descLower = description.toLowerCase();

  // Find all matching rules, sorted by match_count desc
  const matches = rules
    .filter(
      (r) => r.match_count >= MIN_CONFIDENCE && descLower.includes(r.pattern.toLowerCase())
    )
    .sort((a, b) => b.match_count - a.match_count);

  if (matches.length === 0) return null;

  const best = matches[0];

  // Verify the category exists and is active
  for (const parent of categories) {
    if (parent.id === best.category_id && parent.is_active) {
      return {
        categoryId: parent.id,
        categoryName: parent.name_es ?? parent.name,
        categoryIcon: parent.icon,
        categoryColor: parent.color,
        parentName: null,
        reason: `${best.pattern} aparece ${best.match_count} veces aqui`,
      };
    }
    for (const child of parent.children) {
      if (child.id === best.category_id && child.is_active) {
        return {
          categoryId: child.id,
          categoryName: child.name_es ?? child.name,
          categoryIcon: child.icon,
          categoryColor: child.color,
          parentName: parent.name_es ?? parent.name,
          reason: `${best.pattern} aparece ${best.match_count} veces aqui`,
        };
      }
    }
  }

  return null;
}
