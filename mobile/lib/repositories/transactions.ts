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

  await db.withTransactionAsync(async () => {
    // Check if this record was never synced (has a pending INSERT)
    const pendingInsert = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM sync_queue
       WHERE table_name = 'transactions' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
      [id]
    );

    await db.runAsync("DELETE FROM transactions WHERE id = ?", [id]);

    if (pendingInsert) {
      // Never reached Supabase — remove all pending queue entries for this record
      await db.runAsync(
        `DELETE FROM sync_queue WHERE table_name = 'transactions' AND record_id = ? AND synced_at IS NULL`,
        [id]
      );
    } else {
      // Already in Supabase — clean up pending UPDATEs and queue a DELETE
      await db.runAsync(
        `DELETE FROM sync_queue WHERE table_name = 'transactions' AND record_id = ? AND operation = 'UPDATE' AND synced_at IS NULL`,
        [id]
      );
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
         VALUES ('transactions', ?, 'DELETE', ?, ?)`,
        [id, JSON.stringify({ id }), now]
      );
    }
  });
}

export type UpdateTransactionParams = {
  description?: string | null;
  merchant_name?: string | null;
  amount?: number;
  transaction_date?: string; // "YYYY-MM-DD"
  category_id?: string | null;
  notes?: string | null;
  is_excluded?: boolean;
};

export async function updateTransaction(
  id: string,
  params: UpdateTransactionParams
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  if (params.description !== undefined) {
    setClauses.push("description = ?");
    values.push(params.description ?? null);
  }
  if (params.merchant_name !== undefined) {
    setClauses.push("merchant_name = ?");
    values.push(params.merchant_name ?? null);
  }
  if (params.amount !== undefined) {
    setClauses.push("amount = ?");
    values.push(params.amount);
  }
  if (params.transaction_date !== undefined) {
    setClauses.push("transaction_date = ?");
    values.push(params.transaction_date);
  }
  if (params.category_id !== undefined) {
    setClauses.push("category_id = ?");
    values.push(params.category_id ?? null);
  }
  if (params.notes !== undefined) {
    setClauses.push("notes = ?");
    values.push(params.notes ?? null);
  }
  if (params.is_excluded !== undefined) {
    setClauses.push("is_excluded = ?");
    values.push(params.is_excluded ? 1 : 0);
  }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = ?");
  values.push(now);
  values.push(id);

  // Build sync payload — Supabase expects boolean for is_excluded, not integer
  const syncPayload: Record<string, unknown> = { updated_at: now };
  if (params.description !== undefined) syncPayload.description = params.description ?? null;
  if (params.merchant_name !== undefined) syncPayload.merchant_name = params.merchant_name ?? null;
  if (params.amount !== undefined) syncPayload.amount = params.amount;
  if (params.transaction_date !== undefined) syncPayload.transaction_date = params.transaction_date;
  if (params.category_id !== undefined) syncPayload.category_id = params.category_id ?? null;
  if (params.notes !== undefined) syncPayload.notes = params.notes ?? null;
  if (params.is_excluded !== undefined) syncPayload.is_excluded = params.is_excluded;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE transactions SET ${setClauses.join(", ")} WHERE id = ?`,
      values
    );

    const pendingInsert = await db.getFirstAsync<{ id: number; payload: string }>(
      `SELECT id, payload FROM sync_queue
       WHERE table_name = 'transactions' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
      [id]
    );

    if (pendingInsert) {
      // Merge into the existing INSERT so Supabase receives the final state
      const existing = JSON.parse(pendingInsert.payload);
      const merged = { ...existing, ...syncPayload };
      await db.runAsync(
        "UPDATE sync_queue SET payload = ? WHERE id = ?",
        [JSON.stringify(merged), pendingInsert.id]
      );
    } else {
      // Check for an existing pending UPDATE — merge rather than accumulate
      const pendingUpdate = await db.getFirstAsync<{ id: number; payload: string }>(
        `SELECT id, payload FROM sync_queue
         WHERE table_name = 'transactions' AND record_id = ? AND operation = 'UPDATE' AND synced_at IS NULL`,
        [id]
      );

      if (pendingUpdate) {
        const existing = JSON.parse(pendingUpdate.payload);
        const merged = { ...existing, ...syncPayload };
        await db.runAsync(
          "UPDATE sync_queue SET payload = ? WHERE id = ?",
          [JSON.stringify(merged), pendingUpdate.id]
        );
      } else {
        // Queue a new UPDATE
        await db.runAsync(
          `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
           VALUES ('transactions', ?, 'UPDATE', ?, ?)`,
          [id, JSON.stringify(syncPayload), now]
        );
      }
    }
  });
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
