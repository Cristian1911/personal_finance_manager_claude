import * as Crypto from "expo-crypto";
import {
  computeIdempotencyKey,
  findReconciliationCandidates,
  mergeTransactionMetadata,
  type DataProvider,
  type ReconciliationCandidate,
  type RankedReconciliationResult,
  type TransactionCaptureMethod,
  type TransactionDirection,
} from "@zeta/shared";
import { getDatabase } from "../db/database";

const expoHashFn = (payload: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);

export type TransactionRow = {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  direction: string;
  description: string | null;
  merchant_name: string | null;
  raw_description: string | null;
  transaction_date: string;
  post_date: string | null;
  status: string;
  idempotency_key: string | null;
  is_excluded: number | boolean;
  notes: string | null;
  currency_code: string;
  provider: string;
  capture_method: string;
  capture_input_text: string | null;
  reconciled_into_transaction_id: string | null;
  reconciliation_score: number | null;
  transfer_group_id: string | null;
  original_amount: number | null;
  installment_current: number | null;
  installment_total: number | null;
  installment_group_id: string | null;
  is_subscription: number;
  is_recurring: number;
  created_at: string;
  updated_at: string;
};

export type TransactionListRow = TransactionRow & {
  category_name: string | null;
  category_name_es: string | null;
  category_color: string | null;
  category_icon: string | null;
  account_type: string | null;
  account_name: string | null;
  account_color: string | null;
};

export type CreateTransactionParams = {
  user_id: string;
  account_id: string;
  amount: number;
  currency_code: string;
  direction: TransactionDirection;
  transaction_date: string;
  description?: string | null;
  merchant_name?: string | null;
  raw_description?: string | null;
  category_id?: string | null;
  notes?: string | null;
  provider?: DataProvider;
  capture_method?: TransactionCaptureMethod;
  capture_input_text?: string | null;
  status?: string;
  is_excluded?: boolean;
  is_subscription?: boolean;
};

export type UpdateTransactionParams = {
  description?: string | null;
  merchant_name?: string | null;
  amount?: number;
  transaction_date?: string;
  category_id?: string | null;
  notes?: string | null;
  is_excluded?: boolean;
  reconciled_into_transaction_id?: string | null;
  reconciliation_score?: number | null;
  capture_input_text?: string | null;
};

export type LocalReconciliationDecision = {
  manualTransactionId: string;
  pdfTransactionId: string;
  score: number;
};

function buildInsertPayload(id: string, now: string, params: CreateTransactionParams, idempotencyKey: string) {
  return {
    id,
    user_id: params.user_id,
    account_id: params.account_id,
    category_id: params.category_id ?? null,
    amount: params.amount,
    currency_code: params.currency_code,
    direction: params.direction,
    clean_description: params.description ?? null,
    merchant_name: params.merchant_name ?? null,
    raw_description: params.raw_description ?? null,
    transaction_date: params.transaction_date,
    status: params.status ?? "POSTED",
    idempotency_key: idempotencyKey,
    is_excluded: params.is_excluded ?? false,
    is_subscription: params.is_subscription ?? false,
    notes: params.notes ?? null,
    provider: params.provider ?? "MANUAL",
    capture_method: params.capture_method ?? "MANUAL_FORM",
    capture_input_text: params.capture_input_text ?? null,
    reconciled_into_transaction_id: null,
    reconciliation_score: null,
    created_at: now,
    updated_at: now,
  };
}

async function queueInsertSync(payload: Record<string, unknown>, now: string) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES ('transactions', ?, 'INSERT', ?, ?)`,
    [String(payload.id), JSON.stringify(payload), now]
  );
}

export async function createTransaction(params: CreateTransactionParams): Promise<string> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const txId = Crypto.randomUUID();
  const idempotencyKey = await computeIdempotencyKey(
    {
      provider: params.provider ?? "MANUAL",
      transactionDate: params.transaction_date,
      amount: params.amount,
      rawDescription: params.raw_description ?? params.description ?? params.merchant_name ?? "",
    },
    expoHashFn
  );

  const payload = buildInsertPayload(txId, now, params, idempotencyKey);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transactions
        (id, user_id, account_id, category_id, amount, currency_code, direction, description, merchant_name, raw_description,
         transaction_date, status, idempotency_key, is_excluded, is_subscription, notes, provider, capture_method, capture_input_text,
         reconciled_into_transaction_id, reconciliation_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.id,
        payload.user_id,
        payload.account_id,
        payload.category_id,
        payload.amount,
        payload.currency_code,
        payload.direction,
        payload.clean_description,
        payload.merchant_name,
        payload.raw_description,
        payload.transaction_date,
        payload.status,
        payload.idempotency_key,
        payload.is_excluded ? 1 : 0,
        payload.is_subscription ? 1 : 0,
        payload.notes,
        payload.provider,
        payload.capture_method,
        payload.capture_input_text,
        payload.reconciled_into_transaction_id,
        payload.reconciliation_score,
        payload.created_at,
        payload.updated_at,
      ]
    );

    await queueInsertSync(payload, now);
  });

  return txId;
}

export async function createQuickCaptureTransaction(
  params: Omit<CreateTransactionParams, "capture_method" | "provider">
): Promise<string> {
  return createTransaction({
    ...params,
    provider: "MANUAL",
    capture_method: "TEXT_QUICK_CAPTURE",
  });
}

export async function getTransactions(options?: {
  accountId?: string;
  categoryId?: string;
  uncategorizedOnly?: boolean;
  search?: string;
  month?: string;
  limit?: number;
  offset?: number;
  includeReconciled?: boolean;
}) {
  const db = await getDatabase();
  const conditions: string[] = ["1=1"];
  const params: (string | number)[] = [];

  if (options?.accountId) {
    conditions.push("t.account_id = ?");
    params.push(options.accountId);
  }
  if (options?.uncategorizedOnly) {
    conditions.push("t.category_id IS NULL");
    conditions.push("t.is_excluded = 0");
  } else if (options?.categoryId) {
    conditions.push("t.category_id = ?");
    params.push(options.categoryId);
  }
  if (options?.search) {
    conditions.push("(t.description LIKE ? OR t.merchant_name LIKE ? OR t.raw_description LIKE ?)");
    params.push(`%${options.search}%`, `%${options.search}%`, `%${options.search}%`);
  }
  if (options?.month) {
    conditions.push("t.transaction_date LIKE ?");
    params.push(`${options.month}%`);
  }
  if (!options?.includeReconciled) {
    conditions.push("t.reconciled_into_transaction_id IS NULL");
  }

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  return db.getAllAsync<TransactionListRow>(
    `SELECT t.*, c.name as category_name, c.name_es as category_name_es, c.icon as category_icon, c.color as category_color,
            a.account_type as account_type, a.name as account_name, a.color as account_color
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN accounts a ON t.account_id = a.id
     WHERE ${conditions.join(" AND ")}
     ORDER BY t.transaction_date DESC, t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
}

/**
 * Month-scope aggregates for the Movimientos summary card — computed via SQL
 * so the totals reflect the full month regardless of feed pagination. Matches
 * webapp `getMonthlyCashflowCached` semantics: INFLOW to CREDIT_CARD / LOAN
 * accounts is EXCLUDED from totalInflow (it's a debt payment, not income).
 */
export type MonthlyAggregates = {
  count: number;
  totalInflow: number;
  totalOutflow: number;
  uncategorizedCount: number;
  daysByDate: { date: string; income: number; expense: number }[];
};

export async function getMonthlyAggregates(options: {
  month: string;
  accountId?: string;
}): Promise<MonthlyAggregates> {
  const db = await getDatabase();
  const params: (string | number)[] = [`${options.month}%`];
  let accountFilter = "";
  if (options.accountId) {
    accountFilter = " AND t.account_id = ?";
    params.push(options.accountId);
  }

  // Totals + count. INFLOW to debt accounts excluded from totalInflow.
  const totalsRow = await db.getFirstAsync<{
    count: number;
    total_inflow: number;
    total_outflow: number;
    uncategorized_count: number;
  }>(
    `SELECT
       COUNT(*) AS count,
       COALESCE(SUM(CASE WHEN t.direction = 'INFLOW'
                          AND a.account_type NOT IN ('CREDIT_CARD','LOAN')
                          AND t.is_excluded = 0
                         THEN t.amount ELSE 0 END), 0) AS total_inflow,
       COALESCE(SUM(CASE WHEN t.direction = 'OUTFLOW' AND t.is_excluded = 0
                         THEN t.amount ELSE 0 END), 0) AS total_outflow,
       SUM(CASE WHEN t.direction = 'OUTFLOW' AND t.category_id IS NULL AND t.is_excluded = 0
                THEN 1 ELSE 0 END) AS uncategorized_count
     FROM transactions t
     LEFT JOIN accounts a ON t.account_id = a.id
     WHERE t.transaction_date LIKE ?
       AND t.reconciled_into_transaction_id IS NULL${accountFilter}`,
    params
  );

  // Per-day income/expense aggregation for the flow chart.
  const dayRows = await db.getAllAsync<{
    transaction_date: string;
    income: number;
    expense: number;
  }>(
    `SELECT
       t.transaction_date,
       COALESCE(SUM(CASE WHEN t.direction = 'INFLOW'
                          AND a.account_type NOT IN ('CREDIT_CARD','LOAN')
                         THEN t.amount ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN t.direction = 'OUTFLOW'
                         THEN t.amount ELSE 0 END), 0) AS expense
     FROM transactions t
     LEFT JOIN accounts a ON t.account_id = a.id
     WHERE t.transaction_date LIKE ?
       AND t.is_excluded = 0
       AND t.reconciled_into_transaction_id IS NULL${accountFilter}
     GROUP BY t.transaction_date
     ORDER BY t.transaction_date ASC`,
    params
  );

  return {
    count: totalsRow?.count ?? 0,
    totalInflow: totalsRow?.total_inflow ?? 0,
    totalOutflow: totalsRow?.total_outflow ?? 0,
    uncategorizedCount: totalsRow?.uncategorized_count ?? 0,
    daysByDate: dayRows.map((r) => ({
      date: r.transaction_date,
      income: r.income,
      expense: r.expense,
    })),
  };
}

export async function getTopUncategorized(options: {
  month: string;
  accountId?: string;
  limit?: number;
}): Promise<TransactionListRow[]> {
  const db = await getDatabase();
  const params: (string | number)[] = [`${options.month}%`];
  let accountFilter = "";
  if (options.accountId) {
    accountFilter = " AND t.account_id = ?";
    params.push(options.accountId);
  }
  params.push(options.limit ?? 5);

  return db.getAllAsync<TransactionListRow>(
    `SELECT t.*, c.name as category_name, c.name_es as category_name_es, c.icon as category_icon, c.color as category_color,
            a.account_type as account_type, a.name as account_name, a.color as account_color
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN accounts a ON t.account_id = a.id
     WHERE t.direction = 'OUTFLOW'
       AND t.category_id IS NULL
       AND t.is_excluded = 0
       AND t.reconciled_into_transaction_id IS NULL
       AND t.transaction_date LIKE ?${accountFilter}
     ORDER BY t.transaction_date DESC, t.created_at DESC
     LIMIT ?`,
    params
  );
}

export async function getTransactionById(id: string, includeReconciled = true) {
  const db = await getDatabase();
  const visibility = includeReconciled ? "" : "AND t.reconciled_into_transaction_id IS NULL";
  return db.getFirstAsync(
    `SELECT t.*, c.name as category_name, c.name_es as category_name_es, c.icon as category_icon, c.color as category_color,
            a.name as account_name, a.icon as account_icon, a.color as account_color, a.account_type as account_type
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN accounts a ON t.account_id = a.id
     WHERE t.id = ? ${visibility}`,
    [id]
  );
}

export async function getReconciliationCandidateById(
  id: string
): Promise<ReconciliationCandidate | null> {
  const db = await getDatabase();
  return db.getFirstAsync<ReconciliationCandidate>(
    `SELECT id, user_id, account_id, amount, direction, transaction_date, raw_description, merchant_name,
            description as clean_description, category_id,
            CASE WHEN category_id IS NOT NULL THEN 'USER_CREATED' ELSE NULL END as categorization_source,
            notes, reconciled_into_transaction_id
     FROM transactions
     WHERE id = ?`,
    [id]
  );
}

export async function getReconciliationCandidates(params: {
  userId: string;
  accountId: string;
  direction: TransactionDirection;
  amount: number;
  transactionDate: string;
  rawDescription: string;
}): Promise<RankedReconciliationResult> {
  const db = await getDatabase();
  const monthStart = params.transactionDate.slice(0, 7);
  const rows = await db.getAllAsync<ReconciliationCandidate>(
    `SELECT id, user_id, account_id, amount, direction, transaction_date, raw_description, merchant_name, description as clean_description,
            category_id,
            CASE WHEN category_id IS NOT NULL THEN 'USER_CREATED' ELSE NULL END as categorization_source,
            notes, reconciled_into_transaction_id
     FROM transactions
     WHERE user_id = ?
       AND account_id = ?
       AND direction = ?
       AND transaction_date LIKE ?
       AND reconciled_into_transaction_id IS NULL`,
    [params.userId, params.accountId, params.direction, `${monthStart}%`]
  );

  return findReconciliationCandidates(
    {
      account_id: params.accountId,
      amount: params.amount,
      direction: params.direction,
      transaction_date: params.transactionDate,
      raw_description: params.rawDescription,
    },
    rows
  );
}

export async function applyReconciliationMerge(params: {
  manualTransaction: ReconciliationCandidate;
  pdfTransactionId: string;
  score: number;
  pdfCategoryId?: string | null;
  pdfNotes?: string | null;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const merged = mergeTransactionMetadata(params.manualTransaction, {
    category_id: params.pdfCategoryId ?? null,
    notes: params.pdfNotes ?? null,
  });

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE transactions
       SET category_id = ?, notes = ?, capture_method = ?, updated_at = ?
       WHERE id = ?`,
      [merged.category_id ?? null, merged.notes ?? null, merged.capture_method, now, params.pdfTransactionId]
    );

    await db.runAsync(
      `UPDATE transactions
       SET reconciled_into_transaction_id = ?, reconciliation_score = ?, updated_at = ?
       WHERE id = ?`,
      [params.pdfTransactionId, params.score, now, params.manualTransaction.id]
    );

    const pdfUpdatePayload = {
      category_id: merged.category_id ?? null,
      notes: merged.notes ?? null,
      capture_method: merged.capture_method,
      updated_at: now,
    };
    const manualUpdatePayload = {
      reconciled_into_transaction_id: params.pdfTransactionId,
      reconciliation_score: params.score,
      updated_at: now,
    };

    await enqueueTransactionUpdate(db, params.pdfTransactionId, pdfUpdatePayload, now);
    await enqueueTransactionUpdate(db, params.manualTransaction.id, manualUpdatePayload, now);
  });
}

async function enqueueTransactionUpdate(
  db: Awaited<ReturnType<typeof getDatabase>>,
  id: string,
  payload: Record<string, unknown>,
  now: string
) {
  const pendingInsert = await db.getFirstAsync<{ id: number; payload: string }>(
    `SELECT id, payload FROM sync_queue
     WHERE table_name = 'transactions' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
    [id]
  );

  if (pendingInsert) {
    const existing = JSON.parse(pendingInsert.payload);
    await db.runAsync("UPDATE sync_queue SET payload = ? WHERE id = ?", [
      JSON.stringify({ ...existing, ...payload }),
      pendingInsert.id,
    ]);
    return;
  }

  const pendingUpdate = await db.getFirstAsync<{ id: number; payload: string }>(
    `SELECT id, payload FROM sync_queue
     WHERE table_name = 'transactions' AND record_id = ? AND operation = 'UPDATE' AND synced_at IS NULL`,
    [id]
  );

  if (pendingUpdate) {
    const existing = JSON.parse(pendingUpdate.payload);
    await db.runAsync("UPDATE sync_queue SET payload = ? WHERE id = ?", [
      JSON.stringify({ ...existing, ...payload }),
      pendingUpdate.id,
    ]);
    return;
  }

  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES ('transactions', ?, 'UPDATE', ?, ?)`,
    [id, JSON.stringify(payload), now]
  );
}

export async function deleteTransaction(id: string) {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    const pendingInsert = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM sync_queue
       WHERE table_name = 'transactions' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
      [id]
    );

    await db.runAsync("DELETE FROM transactions WHERE id = ?", [id]);

    if (pendingInsert) {
      await db.runAsync(
        `DELETE FROM sync_queue WHERE table_name = 'transactions' AND record_id = ? AND synced_at IS NULL`,
        [id]
      );
    } else {
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
    // Match webapp: track how the category was assigned
    setClauses.push("categorization_source = ?");
    values.push(params.category_id ? "USER_OVERRIDE" : null);
  }
  if (params.notes !== undefined) {
    setClauses.push("notes = ?");
    values.push(params.notes ?? null);
  }
  if (params.is_excluded !== undefined) {
    setClauses.push("is_excluded = ?");
    values.push(params.is_excluded ? 1 : 0);
  }
  if (params.reconciled_into_transaction_id !== undefined) {
    setClauses.push("reconciled_into_transaction_id = ?");
    values.push(params.reconciled_into_transaction_id ?? null);
  }
  if (params.reconciliation_score !== undefined) {
    setClauses.push("reconciliation_score = ?");
    values.push(params.reconciliation_score ?? null);
  }
  if (params.capture_input_text !== undefined) {
    setClauses.push("capture_input_text = ?");
    values.push(params.capture_input_text ?? null);
  }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = ?");
  values.push(now);
  values.push(id);

  const syncPayload: Record<string, unknown> = { updated_at: now };
  if (params.description !== undefined) syncPayload.clean_description = params.description ?? null;
  if (params.merchant_name !== undefined) syncPayload.merchant_name = params.merchant_name ?? null;
  if (params.amount !== undefined) syncPayload.amount = params.amount;
  if (params.transaction_date !== undefined) syncPayload.transaction_date = params.transaction_date;
  if (params.category_id !== undefined) {
    syncPayload.category_id = params.category_id ?? null;
    syncPayload.categorization_source = params.category_id ? "USER_OVERRIDE" : null;
  }
  if (params.notes !== undefined) syncPayload.notes = params.notes ?? null;
  if (params.is_excluded !== undefined) syncPayload.is_excluded = params.is_excluded;
  if (params.reconciled_into_transaction_id !== undefined) {
    syncPayload.reconciled_into_transaction_id = params.reconciled_into_transaction_id ?? null;
  }
  if (params.reconciliation_score !== undefined) {
    syncPayload.reconciliation_score = params.reconciliation_score ?? null;
  }
  if (params.capture_input_text !== undefined) {
    syncPayload.capture_input_text = params.capture_input_text ?? null;
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE transactions SET ${setClauses.join(", ")} WHERE id = ?`,
      values
    );
    await enqueueTransactionUpdate(db, id, syncPayload, now);
  });
}
