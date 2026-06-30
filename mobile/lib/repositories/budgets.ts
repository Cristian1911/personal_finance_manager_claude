import * as Crypto from "expo-crypto";
import { getDatabase } from "../db/database";
import { isIncomeCategory } from "./categories";

export type BudgetProgressRow = {
  id: string | null;
  category_id: string;
  category_name: string;
  category_color: string | null;
  expense_type: string | null;
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
    expense_type: string | null;
    amount: number | null;
    spent: number | null;
  }>(
    `SELECT
      b.id as id,
      c.id as category_id,
      COALESCE(c.name_es, c.name) as category_name,
      c.color as category_color,
      c.expense_type as expense_type,
      COALESCE(b.amount, 0) as amount,
      COALESCE(SUM(CASE WHEN t.is_excluded = 0 THEN ABS(t.amount) ELSE 0 END), 0) as spent
    FROM categories c
    LEFT JOIN budgets b
      ON b.category_id = c.id AND b.period = 'monthly'
    LEFT JOIN transactions t
      ON t.category_id = c.id
      AND t.direction = 'OUTFLOW'
      AND t.transaction_date LIKE ?
      -- Exclude personal-debt origin legs (shared-payment "me deben" portion)
      -- so the lent amount doesn't inflate per-category budget spend.
      AND (t.pd_role IS NULL OR t.pd_role != 'origin')
    GROUP BY c.id, c.name, c.name_es, c.color, c.expense_type, b.id, b.amount
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
      expense_type: row.expense_type,
      amount,
      spent,
      progress,
    };
  });
}

/** Current-month income — INFLOW transactions excluding debt-account inflows
 * (an inflow to a credit card / loan is a payment, not income) and excluded
 * txs. Mirrors the cashflow income the webapp 50·30·20 allocation uses. */
export async function getMonthlyIncome(month: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(ABS(t.amount)), 0) as total
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.direction = 'INFLOW'
       AND t.is_excluded = 0
       AND a.account_type NOT IN ('CREDIT_CARD', 'LOAN')
       AND t.transaction_date LIKE ?`,
    [`${month}%`]
  );
  return Number(row?.total ?? 0);
}

export type Allocation = {
  income: number;
  needs: { amount: number; percent: number };
  wants: { amount: number; percent: number };
  savings: { amount: number; percent: number };
};

/** 50·30·20 split: category spend where expense_type === "fixed" is "needs",
 * everything else is "wants", savings = income − needs − wants. Null when there
 * is no income to measure against. Mirrors the webapp get503020Allocation. */
export function compute503020(
  rows: BudgetProgressRow[],
  income: number
): Allocation | null {
  if (income <= 0) return null;
  let needs = 0;
  let wants = 0;
  for (const r of rows) {
    if (r.expense_type === "fixed") needs += r.spent;
    else wants += r.spent;
  }
  const savings = income - needs - wants;
  return {
    income,
    needs: { amount: needs, percent: (needs / income) * 100 },
    wants: { amount: wants, percent: (wants / income) * 100 },
    savings: { amount: savings, percent: (savings / income) * 100 },
  };
}

export type BudgetBuilderRow = {
  budget_id: string | null;
  category_id: string;
  category_name: string;
  category_color: string | null;
  category_icon: string | null;
  parent_id: string | null;
  amount: number;
  avg3m: number;
};

/** All OUTFLOW categories (income excluded) with their current monthly budget
 * and a 3-month average outflow — the rows for the "Armar presupuesto" builder.
 * The avg powers the "Desde transacciones" suggestion. */
export async function getBudgetBuilderRows(): Promise<BudgetBuilderRow[]> {
  const db = await getDatabase();
  // First day of the month two months back → ~3 full months of history.
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const startMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

  const rows = await db.getAllAsync<{
    budget_id: string | null;
    category_id: string;
    category_name: string;
    category_color: string | null;
    category_icon: string | null;
    parent_id: string | null;
    amount: number | null;
    avg3m: number | null;
  }>(
    `SELECT
      b.id as budget_id,
      c.id as category_id,
      COALESCE(c.name_es, c.name) as category_name,
      c.color as category_color,
      c.icon as category_icon,
      c.parent_id as parent_id,
      COALESCE(b.amount, 0) as amount,
      COALESCE(SUM(
        CASE WHEN t.is_excluded = 0 AND t.transaction_date >= ?
          THEN ABS(t.amount) ELSE 0 END
      ), 0) / 3.0 as avg3m
    FROM categories c
    LEFT JOIN budgets b
      ON b.category_id = c.id AND b.period = 'monthly'
    LEFT JOIN transactions t
      ON t.category_id = c.id AND t.direction = 'OUTFLOW'
    GROUP BY b.id, c.id, c.name, c.name_es, c.color, c.icon, c.parent_id, b.amount
    ORDER BY c.display_order ASC, category_name ASC`,
    [startMonth]
  );

  return rows
    .filter((r) => !isIncomeCategory({ id: r.category_id, parent_id: r.parent_id }))
    .map((r) => ({
      budget_id: r.budget_id,
      category_id: r.category_id,
      category_name: r.category_name,
      category_color: r.category_color,
      category_icon: r.category_icon,
      parent_id: r.parent_id,
      amount: Number(r.amount ?? 0),
      avg3m: Math.round(Number(r.avg3m ?? 0)),
    }));
}

/** Persist a budget-builder draft in ONE transaction (single disk flush; no
 * partial-save risk). Only rows whose amount changed are written. */
export async function saveBudgetDraft(
  userId: string,
  changes: Array<{
    budgetId: string | null;
    categoryId: string;
    amount: number;
    prev: number;
  }>
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const c of changes) {
      if (c.amount === c.prev) continue;
      if (c.amount > 0) {
        await upsertBudget({
          id: c.budgetId ?? undefined,
          user_id: userId,
          category_id: c.categoryId,
          amount: c.amount,
          period: "monthly",
        });
      } else if (c.budgetId) {
        await deleteBudget(c.budgetId);
      }
    }
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
