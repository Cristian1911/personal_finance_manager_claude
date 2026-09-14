import type { Category, CategoryWithChildren } from "@/types/domain";

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

/**
 * Flatten a hierarchical category tree into a flat array.
 * Strips `children` from each node.
 */
export function flattenCategories(
  tree: CategoryWithChildren[]
): Category[] {
  return tree.flatMap((node) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { children, ...cat } = node;
    return [cat as Category, ...flattenCategories(node.children)];
  });
}

/** Resolved leaf category for chips/rows — a child inherits its zone color. */
export interface LeafCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

/**
 * Find a category (zone or child) by id in the hierarchical list. Returns the
 * Spanish display name and, for children without their own color, the parent
 * zone's color so chips render consistently.
 */
export function findLeafCategory(
  categories: CategoryWithChildren[],
  id: string | null,
): LeafCategory | null {
  if (!id) return null;
  for (const zone of categories) {
    if (zone.id === id) {
      return {
        id: zone.id,
        name: zone.name_es ?? zone.name ?? "",
        icon: zone.icon ?? null,
        color: zone.color ?? null,
      };
    }
    const child = zone.children.find((c) => c.id === id);
    if (child) {
      return {
        id: child.id,
        name: child.name_es ?? child.name ?? "",
        icon: child.icon ?? null,
        color: child.color ?? zone.color ?? null,
      };
    }
  }
  return null;
}
