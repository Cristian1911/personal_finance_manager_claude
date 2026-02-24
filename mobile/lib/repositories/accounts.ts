import { getDatabase } from "../db/database";

export async function getAllAccounts() {
  const db = await getDatabase();
  return db.getAllAsync(
    "SELECT * FROM accounts WHERE is_active = 1 ORDER BY name"
  );
}

export async function getAccountById(id: string) {
  const db = await getDatabase();
  return db.getFirstAsync("SELECT * FROM accounts WHERE id = ?", [id]);
}
