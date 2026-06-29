import {
  CATEGORY_INGRESOS,
  CATEGORY_OTROS_INGRESOS,
  type TransactionDirection,
} from "@zeta/shared";
import { getDatabase } from "../db/database";

export type CategoryRow = {
  id: string;
  user_id: string | null;
  name: string;
  name_es: string | null;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  is_system: number;
  display_order: number;
  created_at: string;
};

export async function getAllCategories(): Promise<CategoryRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CategoryRow>(
    "SELECT * FROM categories ORDER BY display_order"
  );
}

const INCOME_PARENT_IDS = new Set<string>([
  CATEGORY_INGRESOS,
  CATEGORY_OTROS_INGRESOS,
]);

/** A category is income if it IS an income parent zone or sits under one. */
export function isIncomeCategory(
  cat: Pick<CategoryRow, "id" | "parent_id">
): boolean {
  if (INCOME_PARENT_IDS.has(cat.id)) return true;
  return !!cat.parent_id && INCOME_PARENT_IDS.has(cat.parent_id);
}

/** Filter a category list to the side matching a transaction direction.
 * INFLOW -> income categories, OUTFLOW -> everything else. */
export function filterCategoriesByDirection<
  T extends Pick<CategoryRow, "id" | "parent_id">,
>(cats: T[], direction: TransactionDirection): T[] {
  if (direction === "INFLOW") return cats.filter(isIncomeCategory);
  return cats.filter((c) => !isIncomeCategory(c));
}
