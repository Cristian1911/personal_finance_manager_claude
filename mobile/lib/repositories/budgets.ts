import * as Crypto from "expo-crypto";
import { getDatabase } from "../db/database";

export type BudgetProgressRow = {
  id: string | null;
  category_id: string;
  category_name: string;
  category_color: string | null;
  amount: number;
  spent: number;
  progress: number;
};

export async function getBudgetProgress(month: string): Promise<BudgetProgressRow[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    id: string | null;
    category_id: string;
    category_name: string;
    category_color: string | null;
    amount: number | null;
    spent: number | null;
  }>(
    `SELECT
      b.id as id,
      c.id as category_id,
      COALESCE(c.name_es, c.name) as category_name,
      c.color as category_color,
      COALESCE(b.amount, 0) as amount,
      COALESCE(SUM(CASE WHEN t.is_excluded = 0 THEN ABS(t.amount) ELSE 0 END), 0) as spent
    FROM categories c
    LEFT JOIN budgets b
      ON b.category_id = c.id AND b.period = 'monthly'
    LEFT JOIN transactions t
      ON t.category_id = c.id
      AND t.direction = 'OUTFLOW'
      AND t.transaction_date LIKE ?
    GROUP BY c.id, c.name, c.name_es, c.color, b.id, b.amount
    HAVING b.id IS NOT NULL
      OR COALESCE(SUM(CASE WHEN t.is_excluded = 0 THEN ABS(t.amount) ELSE 0 END), 0) > 0
    ORDER BY COALESCE(SUM(CASE WHEN t.is_excluded = 0 THEN ABS(t.amount) ELSE 0 END), 0) DESC, category_name ASC`,
    [`${month}%`]
  );

  return rows.map((row) => {
    const amount = Number(row.amount ?? 0);
    const spent = Number(row.spent ?? 0);
    const progress = amount > 0 ? (spent / amount) * 100 : 0;
    return {
      id: row.id,
      category_id: row.category_id,
      category_name: row.category_name,
      category_color: row.category_color,
      amount,
      spent,
      progress,
    };
  });
}

export async function upsertBudget(params: {
  id?: string;
  user_id: string;
  category_id: string;
  amount: number;
  period?: string;
}): Promise<string> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = params.id ?? Crypto.randomUUID();
  const period = params.period ?? "monthly";

  const existing = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM budgets WHERE category_id = ? AND period = ?",
    [params.category_id, period]
  );
  const budgetId = existing?.id ?? id;

  await db.runAsync(
    `INSERT OR REPLACE INTO budgets
      (id, user_id, category_id, amount, period, created_at, updated_at)
     VALUES (
      ?,
      ?,
      ?,
      ?,
      ?,
      COALESCE((SELECT created_at FROM budgets WHERE id = ?), ?),
      ?
     )`,
    [budgetId, params.user_id, params.category_id, params.amount, period, budgetId, now, now]
  );

  const payload = {
    id: budgetId,
    user_id: params.user_id,
    category_id: params.category_id,
    amount: params.amount,
    period,
    updated_at: now,
    created_at: existing ? undefined : now,
  };

  const pendingInsert = await db.getFirstAsync<{ id: number; payload: string }>(
    `SELECT id, payload FROM sync_queue
     WHERE table_name = 'budgets' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
    [budgetId]
  );

  if (pendingInsert) {
    const merged = { ...JSON.parse(pendingInsert.payload), ...payload };
    await db.runAsync("UPDATE sync_queue SET payload = ? WHERE id = ?", [
      JSON.stringify(merged),
      pendingInsert.id,
    ]);
  } else if (!existing) {
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES ('budgets', ?, 'INSERT', ?, ?)`,
      [budgetId, JSON.stringify({ ...payload, created_at: now }), now]
    );
  } else {
    const pendingUpdate = await db.getFirstAsync<{ id: number; payload: string }>(
      `SELECT id, payload FROM sync_queue
       WHERE table_name = 'budgets' AND record_id = ? AND operation = 'UPDATE' AND synced_at IS NULL`,
      [budgetId]
    );
    if (pendingUpdate) {
      const merged = { ...JSON.parse(pendingUpdate.payload), ...payload };
      await db.runAsync("UPDATE sync_queue SET payload = ? WHERE id = ?", [
        JSON.stringify(merged),
        pendingUpdate.id,
      ]);
    } else {
      await db.runAsync(
        `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
         VALUES ('budgets', ?, 'UPDATE', ?, ?)`,
        [budgetId, JSON.stringify(payload), now]
      );
    }
  }

  return budgetId;
}

export async function deleteBudget(id: string): Promise<void> {
  const db = await getDatabase();

  const pendingInsert = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM sync_queue
     WHERE table_name = 'budgets' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
    [id]
  );

  await db.runAsync("DELETE FROM budgets WHERE id = ?", [id]);

  if (pendingInsert) {
    await db.runAsync("DELETE FROM sync_queue WHERE id = ?", [pendingInsert.id]);
    return;
  }

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES ('budgets', ?, 'DELETE', ?, ?)`,
    [id, JSON.stringify({ id }), now]
  );
}
