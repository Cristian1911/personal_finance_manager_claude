import { getDatabase } from "../db/database";

export async function getTransactions(options?: {
  accountId?: string;
  categoryId?: string;
  search?: string;
  month?: string; // "YYYY-MM"
  limit?: number;
  offset?: number;
}) {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options?.accountId) {
    conditions.push("t.account_id = ?");
    params.push(options.accountId);
  }
  if (options?.categoryId) {
    conditions.push("t.category_id = ?");
    params.push(options.categoryId);
  }
  if (options?.search) {
    conditions.push("(t.description LIKE ? OR t.merchant_name LIKE ?)");
    params.push(`%${options.search}%`, `%${options.search}%`);
  }
  if (options?.month) {
    conditions.push("t.transaction_date LIKE ?");
    params.push(`${options.month}%`);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  return db.getAllAsync(
    `SELECT t.*, c.name as category_name, c.name_es as category_name_es, c.icon as category_icon, c.color as category_color
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     ${where}
     ORDER BY t.transaction_date DESC, t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
}

export async function deleteTransaction(id: string) {
  const db = await getDatabase();

  // Check if there's a pending INSERT that hasn't synced yet
  const pendingInsert = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM sync_queue
     WHERE table_name = 'transactions' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
    [id]
  );

  await db.runAsync("DELETE FROM transactions WHERE id = ?", [id]);

  if (pendingInsert) {
    // Never synced — just remove the pending INSERT from the queue
    await db.runAsync("DELETE FROM sync_queue WHERE id = ?", [pendingInsert.id]);
  } else {
    // Already synced — queue a DELETE so Supabase removes it too
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES ('transactions', ?, 'DELETE', ?, ?)`,
      [id, JSON.stringify({ id }), now]
    );
  }
}

export async function getTransactionById(id: string) {
  const db = await getDatabase();
  return db.getFirstAsync(
    `SELECT t.*, c.name as category_name, c.name_es as category_name_es, c.icon as category_icon, c.color as category_color,
            a.name as account_name, a.icon as account_icon, a.color as account_color
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN accounts a ON t.account_id = a.id
     WHERE t.id = ?`,
    [id]
  );
}
