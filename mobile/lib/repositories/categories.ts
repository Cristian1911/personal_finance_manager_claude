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
