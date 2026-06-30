import {
  CATEGORY_INGRESOS,
  CATEGORY_OTROS_INGRESOS,
  type TransactionDirection,
} from "@zeta/shared";
import * as Crypto from "expo-crypto";
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

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "category"
  );
}

/** Create a (sub)category locally + enqueue the sync INSERT, returning its id.
 * NOTE: the `categories` table has no `updated_at` column (the inline create in
 * CategoriesRoot wrote one and silently failed) — this writes the real columns. */
export async function createCategory(params: {
  user_id: string;
  name: string;
  name_es?: string | null;
  color?: string | null;
  parent_id?: string | null;
  icon?: string;
  /** INFLOW/OUTFLOW — pass the parent zone's side so the row doesn't land NULL
   * and leak into the wrong webapp category picker. */
  direction?: string | null;
}): Promise<string> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const slug = generateSlug(params.name);
  const icon = params.icon ?? "tag";
  const nameEs = params.name_es ?? params.name;
  const color = params.color ?? null;
  const parentId = params.parent_id ?? null;
  const direction = params.direction ?? null;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO categories
      (id, user_id, name, name_es, slug, icon, color, direction, parent_id, is_system, display_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 999, ?)`,
    [id, params.user_id, params.name, nameEs, slug, icon, color, direction, parentId, now]
  );
  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES ('categories', ?, 'INSERT', ?, ?)`,
    [
      id,
      JSON.stringify({
        id,
        user_id: params.user_id,
        name: params.name,
        name_es: nameEs,
        slug,
        icon,
        color,
        direction,
        parent_id: parentId,
        is_system: false,
        display_order: 999,
        created_at: now,
      }),
      now,
    ]
  );
  return id;
}
