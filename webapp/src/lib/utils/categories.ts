import type { CategoryWithChildren } from "@/types/domain";

/**
 * Build a flat id -> display name map from the hierarchical categories list.
 * Prefers `name_es` (Spanish) over `name`.
 */
export function buildCategoryMap(
  categories: CategoryWithChildren[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const cat of categories) {
    map[cat.id] = cat.name_es ?? cat.name;
    for (const child of cat.children) {
      map[child.id] = child.name_es ?? child.name;
    }
  }
  return map;
}
