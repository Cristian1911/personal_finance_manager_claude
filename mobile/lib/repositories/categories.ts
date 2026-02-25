import { getDatabase } from "../db/database";

export async function getAllCategories() {
  const db = await getDatabase();
  return db.getAllAsync("SELECT * FROM categories ORDER BY display_order");
}
