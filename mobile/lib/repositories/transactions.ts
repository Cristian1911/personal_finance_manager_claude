import * as Crypto from "expo-crypto";
import {
  classifyFlow,
  matchOwnAccount,
  FLOW_CLASS_RULES_VERSION,
  computeIdempotencyKey,
  computeMonthlyAggregates,
  extractPattern,
  findReconciliationCandidates,
  mergeTransactionMetadata,
  type DataProvider,
  type ReconciliationCandidate,
  type RankedReconciliationResult,
  type TransactionCaptureMethod,
  type TransactionDirection,
} from "@zeta/shared";
import { getDatabase } from "../db/database";
import { applyLocalBalanceDelta, type LedgerAccountRow } from "./ledger-helpers";
import { enqueueInsert, enqueueUpdate } from "../sync/queue";

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
  transaction_time: string | null;
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
  destinatario_id: string | null;
  recurrence_group_id: string | null;
  categorization_source: string | null;
  categorization_confidence: number | null;
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
  destinatario_name: string | null;
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
  destinatario_id?: string | null;
  /**
   * Override the default `categorization_source` derivation. When omitted,
   * falls back to `USER_CREATED` (with `category_id`) or `SYSTEM_DEFAULT`.
   * Import flow passes `USER_LEARNED` when a destinatario rule provides
   * the category (mirrors webapp `step-review.tsx`).
   */
  categorization_source?: string | null;
  /**
   * 0..1 confidence the category is correct. Import flow passes `0.8` when a
   * destinatario rule supplies the category (mirrors webapp).
   */
  categorization_confidence?: number | null;
  notes?: string | null;
  provider?: DataProvider;
  capture_method?: TransactionCaptureMethod;
  capture_input_text?: string | null;
  status?: string;
  is_excluded?: boolean;
  is_subscription?: boolean;
  /** Optional time-of-day, "HH:mm" or "HH:mm:ss". NULL when unknown. */
  transaction_time?: string | null;
  /** Optional FK to a transaction_locations row. Filled by the location linker. */
  location_id?: string | null;
  /**
   * Installment metadata (credit-card cuotas). `installment_current` is folded
   * into the idempotency key so cross-platform re-imports of the same installment
   * dedup against the webapp's key (which always includes it).
   */
  installment_current?: number | null;
  installment_total?: number | null;
  installment_group_id?: string | null;
  /**
   * Full purchase price. Cuota convention: `amount` is the monthly cuota,
   * `original_amount` the full price. The idempotency key uses
   * `original_amount ?? amount` (mirrors webapp import).
   */
  original_amount?: number | null;
  /**
   * Preset idempotency key (e.g. the server-computed pending-email key) to
   * preserve cross-source dedup. When omitted, it is computed from
   * provider/date/amount/description — same as before.
   */
  idempotency_key?: string | null;
};

export type UpdateTransactionParams = {
  description?: string | null;
  merchant_name?: string | null;
  amount?: number;
  transaction_date?: string;
  transaction_time?: string | null;
  category_id?: string | null;
  destinatario_id?: string | null;
  notes?: string | null;
  is_excluded?: boolean;
  reconciled_into_transaction_id?: string | null;
  reconciliation_score?: number | null;
  capture_input_text?: string | null;
  location_id?: string | null;
};

export type LocalReconciliationDecision = {
  manualTransactionId: string;
  pdfTransactionId: string;
  score: number;
};

function buildInsertPayload(
  id: string,
  now: string,
  params: CreateTransactionParams,
  idempotencyKey: string,
  flowColumns: { flow_class: string; flow_class_version: number; source_pattern: string | null },
) {
  return {
    id,
    user_id: params.user_id,
    account_id: params.account_id,
    category_id: params.category_id ?? null,
    // Mirror webapp persistTransaction (webapp/src/actions/transactions.ts):
    // mark as USER_CREATED only when the caller passes a category; otherwise
    // fall back to SYSTEM_DEFAULT so dashboards that filter on this column
    // count mobile-created rows the same as webapp-created rows. Callers
    // (e.g. PDF import) can override when the source is more specific.
    categorization_source:
      params.categorization_source ??
      (params.category_id ? "USER_CREATED" : "SYSTEM_DEFAULT"),
    categorization_confidence: params.categorization_confidence ?? null,
    destinatario_id: params.destinatario_id ?? null,
    amount: params.amount,
    currency_code: params.currency_code,
    direction: params.direction,
    clean_description: params.description ?? null,
    merchant_name: params.merchant_name ?? null,
    raw_description: params.raw_description ?? null,
    transaction_date: params.transaction_date,
    transaction_time: params.transaction_time ?? null,
    location_id: params.location_id ?? null,
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
    installment_current: params.installment_current ?? null,
    installment_total: params.installment_total ?? null,
    installment_group_id: params.installment_group_id ?? null,
    original_amount: params.original_amount ?? null,
    // flow_class_effective is deliberately NOT mirrored in SQLite (it is a
    // GENERATED column server-side; a local generated column would break every
    // pull). Derive it in code from these two.
    flow_class: flowColumns.flow_class,
    flow_class_version: flowColumns.flow_class_version,
    source_pattern: flowColumns.source_pattern,
    created_at: now,
    updated_at: now,
  };
}

/**
 * INSERT the transaction row + enqueue its `transactions` INSERT for sync, using
 * the CALLER's db handle (so it composes inside the caller's withTransactionAsync
 * alongside a balance delta). Throws on a UNIQUE(idempotency_key) collision —
 * inside withTransactionAsync that rolls back the whole mutation, so a dupe
 * leaves no row AND no balance change. Callers catch via isUniqueConstraintError.
 */
async function _insertTxBody(
  db: Awaited<ReturnType<typeof getDatabase>>,
  payload: ReturnType<typeof buildInsertPayload>,
  now: string
) {
  await db.runAsync(
    `INSERT INTO transactions
      (id, user_id, account_id, category_id, categorization_source, categorization_confidence, destinatario_id,
       amount, currency_code, direction,
       description, merchant_name, raw_description, transaction_date, transaction_time, location_id, status, idempotency_key,
       is_excluded, is_subscription, notes, provider, capture_method, capture_input_text, reconciled_into_transaction_id,
       reconciliation_score, installment_current, installment_total, installment_group_id, original_amount,
       flow_class, flow_class_version, source_pattern, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.id,
      payload.user_id,
      payload.account_id,
      payload.category_id,
      payload.categorization_source,
      payload.categorization_confidence,
      payload.destinatario_id,
      payload.amount,
      payload.currency_code,
      payload.direction,
      payload.clean_description,
      payload.merchant_name,
      payload.raw_description,
      payload.transaction_date,
      payload.transaction_time,
      payload.location_id,
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
      payload.installment_current,
      payload.installment_total,
      payload.installment_group_id,
      payload.original_amount,
      payload.flow_class,
      payload.flow_class_version,
      payload.source_pattern,
      payload.created_at,
      payload.updated_at,
    ]
  );

  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES ('transactions', ?, 'INSERT', ?, ?)`,
    [payload.id, JSON.stringify(payload), now]
  );
}

/**
 * Resolve the idempotency key: a preset (e.g. server-computed pending-email key)
 * wins; otherwise compute it with the SAME inputs as the webapp so cross-platform
 * rows dedup by construction — using `original_amount ?? amount` (cuota
 * convention) and `installment_current` (installment dedup).
 */
async function resolveIdempotencyKey(params: CreateTransactionParams): Promise<string> {
  if (params.idempotency_key) return params.idempotency_key;
  return computeIdempotencyKey(
    {
      provider: params.provider ?? "MANUAL",
      transactionDate: params.transaction_date,
      amount: params.original_amount ?? params.amount,
      rawDescription: params.raw_description ?? params.merchant_name ?? "",
      installmentCurrent: params.installment_current ?? undefined,
    },
    expoHashFn
  );
}

/** Fetch the account columns applyLocalBalanceDelta needs as a LedgerAccountRow.
 * Raw SQL (not accounts.ts) to avoid a circular import. */
async function getLedgerAccountRow(
  db: Awaited<ReturnType<typeof getDatabase>>,
  accountId: string
): Promise<LedgerAccountRow | null> {
  return db.getFirstAsync<LedgerAccountRow>(
    `SELECT id, user_id, name, account_type, currency_code, current_balance,
            available_balance, credit_limit, currency_balances
     FROM accounts WHERE id = ?`,
    [accountId]
  );
}

/**
 * Classify the movement from LOCAL SQLite only.
 *
 * Two reads against the local db — the row's own account type, and every
 * account the user owns for the destination matcher. No remote round-trip, so
 * this stays inside the interactive budget: a tap must never block on network.
 *
 * Mirrors webapp's flowClassColumns(). Keeping the version stamp next to the
 * verdict is the point: a row claiming version 1 written by version 2 rules can
 * never be found again to re-derive.
 */
async function resolveFlowClassColumns(
  db: Awaited<ReturnType<typeof getDatabase>>,
  params: CreateTransactionParams,
): Promise<{ flow_class: string; flow_class_version: number; source_pattern: string | null }> {
  const own = await db.getAllAsync<{
    id: string;
    account_type: string | null;
    name: string | null;
    mask: string | null;
  }>(`SELECT id, account_type, name, mask FROM accounts`);

  const accountType = own.find((a) => a.id === params.account_id)?.account_type ?? null;
  const description =
    params.merchant_name ?? params.description ?? params.raw_description ?? null;
  const matched = matchOwnAccount(
    description,
    own.map((a) => ({
      id: a.id,
      accountType: a.account_type,
      name: a.name,
      mask: a.mask,
    })),
    params.account_id,
  );

  const { flowClass } = classifyFlow({
    direction: params.direction,
    accountType,
    description,
    matchedAccountType: matched?.accountType,
  });

  return {
    flow_class: flowClass,
    flow_class_version: FLOW_CLASS_RULES_VERSION,
    source_pattern: null,
  };
}

export async function createTransaction(params: CreateTransactionParams): Promise<string> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const txId = Crypto.randomUUID();
  const idempotencyKey = await resolveIdempotencyKey(params);
  const flowColumns = await resolveFlowClassColumns(db, params);
  const payload = buildInsertPayload(txId, now, params, idempotencyKey, flowColumns);

  await db.withTransactionAsync(async () => {
    await _insertTxBody(db, payload, now);
  });

  return txId;
}

/**
 * createTransaction + LOCAL balance delta in ONE withTransactionAsync — the
 * mobile mirror of webapp persistTransaction (which always calls
 * adjustBalancesForTransactionChanges after the insert). Use this for EVERY
 * non-reconciling create path (manual capture, OCR, voice, email approve, PDF
 * import) so the account balance moves locally; there is NO server trigger.
 *
 * The caller resolves `account` locally first (getAccountById). Excluded
 * transactions never touch the balance (mirrors the webapp skip). A
 * UNIQUE(idempotency_key) collision throws and rolls back the whole tx (no row,
 * no delta); callers catch isUniqueConstraintError and treat it as an
 * already-imported success.
 */
export async function createTransactionAndApplyBalance(
  params: CreateTransactionParams,
  account: LedgerAccountRow
): Promise<string> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const txId = Crypto.randomUUID();
  const idempotencyKey = await resolveIdempotencyKey(params);
  const flowColumns = await resolveFlowClassColumns(db, params);
  const payload = buildInsertPayload(txId, now, params, idempotencyKey, flowColumns);

  await db.withTransactionAsync(async () => {
    await _insertTxBody(db, payload, now);
    if (!payload.is_excluded) {
      await applyLocalBalanceDelta(
        db,
        account,
        params.direction,
        params.amount,
        params.currency_code,
        now
      );
    }
  });

  return txId;
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
            a.account_type as account_type, a.name as account_name, a.color as account_color,
            d.name as destinatario_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN accounts a ON t.account_id = a.id
     LEFT JOIN destinatarios d ON t.destinatario_id = d.id
     WHERE ${conditions.join(" AND ")}
     ORDER BY t.transaction_date DESC, t.transaction_time DESC, t.created_at DESC
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

  // Single slim SELECT for the month; the canonical aggregation lives in
  // @zeta/shared/utils/monthly-aggregates so mobile and webapp produce the
  // same numbers by construction. The previous SQL had a bug — COUNT(*)
  // omitted the `t.is_excluded = 0` predicate that the sibling SUMs applied,
  // inflating the row count whenever the user had excluded transactions.
  const rows = await db.getAllAsync<{
    amount: number;
    direction: "INFLOW" | "OUTFLOW";
    account_id: string;
    category_id: string | null;
    is_excluded: number;
    reconciled_into_transaction_id: string | null;
    transaction_date: string;
    flow_class: string | null;
    flow_class_override: string | null;
  }>(
    // flow_class/flow_class_override are projected so computeMonthlyAggregates
    // honours the stored class here too. The webapp's slim select carries the
    // same two columns; adding them on one side only would reopen the 7-33x
    // webapp/mobile divergence that helper exists to close.
    `SELECT t.amount, t.direction, t.account_id, t.category_id, t.is_excluded,
            t.reconciled_into_transaction_id, t.transaction_date,
            t.flow_class, t.flow_class_override
       FROM transactions t
      WHERE t.transaction_date LIKE ?
        AND t.reconciled_into_transaction_id IS NULL${accountFilter}`,
    params
  );

  // Resolve debt accounts so INFLOWs into them are excluded from totalInflow.
  const debtRows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM accounts WHERE account_type IN ('CREDIT_CARD','LOAN')`
  );
  const debtAccountIds = new Set(debtRows.map((r) => r.id));

  return computeMonthlyAggregates(rows, { debtAccountIds });
}

/** Narrow shape for the Categorizar panel — only the columns it renders. */
export type UncategorizedSampleRow = Pick<
  TransactionRow,
  | "id"
  | "amount"
  | "direction"
  | "currency_code"
  | "description"
  | "merchant_name"
  | "transaction_date"
>;

export async function getTopUncategorized(options: {
  month: string;
  accountId?: string;
  limit?: number;
}): Promise<UncategorizedSampleRow[]> {
  const db = await getDatabase();
  const params: (string | number)[] = [`${options.month}%`];
  let accountFilter = "";
  if (options.accountId) {
    accountFilter = " AND t.account_id = ?";
    params.push(options.accountId);
  }
  params.push(options.limit ?? 5);

  return db.getAllAsync<UncategorizedSampleRow>(
    `SELECT t.id, t.amount, t.direction, t.currency_code, t.description, t.merchant_name, t.transaction_date
     FROM transactions t
     WHERE t.direction = 'OUTFLOW'
       AND t.category_id IS NULL
       AND t.is_excluded = 0
       AND t.reconciled_into_transaction_id IS NULL
       AND t.transaction_date LIKE ?${accountFilter}
     ORDER BY t.transaction_date DESC, t.transaction_time DESC, t.created_at DESC
     LIMIT ?`,
    params
  );
}

export async function getTransactionById(id: string, includeReconciled = true) {
  const db = await getDatabase();
  const visibility = includeReconciled ? "" : "AND t.reconciled_into_transaction_id IS NULL";
  return db.getFirstAsync(
    `SELECT t.*, c.name as category_name, c.name_es as category_name_es, c.icon as category_icon, c.color as category_color,
            a.name as account_name, a.icon as account_icon, a.color as account_color, a.account_type as account_type,
            d.name as destinatario_name,
            l.place_name as location_place_name, l.place_locality as location_place_locality, l.place_country as location_place_country
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN accounts a ON t.account_id = a.id
     LEFT JOIN destinatarios d ON t.destinatario_id = d.id
     LEFT JOIN transaction_locations l ON t.location_id = l.id
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

/**
 * Unranked reconciliation-candidate rows for an account within a date range —
 * the repository owns the column projection the shared matcher expects
 * (`description AS clean_description`; real `categorization_source` and
 * `capture_method` columns, unlike the legacy CASE projection above).
 * Used by the email-import duplicate check (±3-day span around the email
 * date); ranking happens at the caller via `findReconciliationCandidates`.
 */
export async function getReconciliationCandidateRowsInRange(params: {
  userId: string;
  accountId: string;
  fromDate: string;
  toDate: string;
}): Promise<ReconciliationCandidate[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReconciliationCandidate>(
    `SELECT id, user_id, account_id, amount, direction, transaction_date,
            raw_description, merchant_name, description AS clean_description,
            category_id, categorization_source, notes,
            reconciled_into_transaction_id, capture_method
     FROM transactions
     WHERE user_id = ? AND account_id = ?
       AND transaction_date >= ? AND transaction_date <= ?
       AND reconciled_into_transaction_id IS NULL`,
    [params.userId, params.accountId, params.fromDate, params.toDate]
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
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // Snapshot the row BEFORE deleting so we can reverse its balance delta.
    const snapshot = await db.getFirstAsync<{
      account_id: string;
      amount: number;
      direction: TransactionDirection;
      is_excluded: number;
      currency_code: string;
    }>(
      `SELECT account_id, amount, direction, is_excluded, currency_code
       FROM transactions WHERE id = ?`,
      [id]
    );

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
      await db.runAsync(
        `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
         VALUES ('transactions', ?, 'DELETE', ?, ?)`,
        [id, JSON.stringify({ id }), now]
      );
    }

    // Reverse the balance delta this tx applied (excluded txs never moved it —
    // mirror webapp adjustBalancesForTransactionChanges skip). A re-delete sees
    // snapshot=null and no-ops.
    if (snapshot && snapshot.is_excluded !== 1) {
      const account = await getLedgerAccountRow(db, snapshot.account_id);
      if (account) {
        const opposite: TransactionDirection =
          snapshot.direction === "INFLOW" ? "OUTFLOW" : "INFLOW";
        await applyLocalBalanceDelta(
          db,
          account,
          opposite,
          snapshot.amount,
          snapshot.currency_code,
          now
        );
      }
    }
  });
}

export async function updateTransaction(
  id: string,
  params: UpdateTransactionParams
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // Balance delta (mirror webapp adjustBalancesForTransactionChanges): on mobile
  // only `amount` and the `is_excluded` toggle can change a tx's balance impact
  // (direction/account aren't editable here). Read the pre-update row + account
  // up front so the delta runs inside the same transaction as the UPDATE.
  let balanceCtx:
    | {
        account: LedgerAccountRow;
        oldAmount: number;
        newAmount: number;
        oldExcluded: boolean;
        newExcluded: boolean;
        direction: TransactionDirection;
        currencyCode: string;
      }
    | null = null;
  if (params.amount !== undefined || params.is_excluded !== undefined) {
    const existing = await db.getFirstAsync<{
      account_id: string;
      amount: number;
      direction: TransactionDirection;
      is_excluded: number;
      currency_code: string;
    }>(
      `SELECT account_id, amount, direction, is_excluded, currency_code
       FROM transactions WHERE id = ?`,
      [id]
    );
    if (existing) {
      const oldAmount = existing.amount;
      const newAmount = params.amount ?? existing.amount;
      const oldExcluded = existing.is_excluded === 1;
      const newExcluded = params.is_excluded ?? oldExcluded;
      if (newAmount !== oldAmount || newExcluded !== oldExcluded) {
        const account = await getLedgerAccountRow(db, existing.account_id);
        if (account) {
          balanceCtx = {
            account,
            oldAmount,
            newAmount,
            oldExcluded,
            newExcluded,
            direction: existing.direction,
            currencyCode: existing.currency_code,
          };
        }
      }
    }
  }

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
  if (params.transaction_time !== undefined) {
    setClauses.push("transaction_time = ?");
    values.push(params.transaction_time ?? null);
  }
  if (params.location_id !== undefined) {
    setClauses.push("location_id = ?");
    values.push(params.location_id ?? null);
  }
  if (params.category_id !== undefined) {
    setClauses.push("category_id = ?");
    values.push(params.category_id ?? null);
    // Match webapp (actions/transactions.ts:841): flag USER_OVERRIDE on any
    // category change — assign or clear. Webapp uses `categoryChanged` which
    // is true in both directions; mobile mirrors by always setting the flag
    // whenever the caller includes category_id in the update.
    setClauses.push("categorization_source = ?");
    values.push("USER_OVERRIDE");
    // Webapp clears confidence on any user category override (categorize.ts:243).
    setClauses.push("categorization_confidence = ?");
    values.push(null);
  }
  if (params.destinatario_id !== undefined) {
    setClauses.push("destinatario_id = ?");
    values.push(params.destinatario_id ?? null);
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
  if (params.transaction_time !== undefined) syncPayload.transaction_time = params.transaction_time ?? null;
  if (params.location_id !== undefined) syncPayload.location_id = params.location_id ?? null;
  if (params.category_id !== undefined) {
    syncPayload.category_id = params.category_id ?? null;
    syncPayload.categorization_source = "USER_OVERRIDE";
    syncPayload.categorization_confidence = null;
  }
  if (params.destinatario_id !== undefined) syncPayload.destinatario_id = params.destinatario_id ?? null;
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

    if (balanceCtx) {
      const opposite: TransactionDirection =
        balanceCtx.direction === "INFLOW" ? "OUTFLOW" : "INFLOW";
      // Reverse the OLD effect (if it counted), then apply the NEW effect (if it
      // counts). For a pure amount change this nets to (new − old) in `direction`.
      if (!balanceCtx.oldExcluded) {
        await applyLocalBalanceDelta(
          db,
          balanceCtx.account,
          opposite,
          balanceCtx.oldAmount,
          balanceCtx.currencyCode,
          now
        );
      }
      if (!balanceCtx.newExcluded) {
        await applyLocalBalanceDelta(
          db,
          balanceCtx.account,
          balanceCtx.direction,
          balanceCtx.newAmount,
          balanceCtx.currencyCode,
          now
        );
      }
    }
  });
}

/**
 * Categorize a transaction AND learn from it — the mobile mirror of webapp
 * categorizeTransaction (actions/categorize.ts). Beyond setting the category it
 * (1) upserts a category_rules row from the merchant pattern so the auto-
 * categorizer improves and the rule syncs to web / other devices, and (2)
 * backfills the destinatario's default category when unset. Used by the
 * Categorizar flow ONLY — generic edits stay on updateTransaction, which does
 * NOT learn (matching the webapp split).
 */
export async function categorizeAndLearn(
  transactionId: string,
  categoryId: string
): Promise<void> {
  const db = await getDatabase();

  // 1. Set the category (USER_OVERRIDE). No balance side-effect (amount /
  //    is_excluded untouched), so reusing updateTransaction is safe.
  await updateTransaction(transactionId, { category_id: categoryId });

  // 2. Read the fields needed to learn.
  const tx = await db.getFirstAsync<{
    user_id: string;
    merchant_name: string | null;
    description: string | null;
    raw_description: string | null;
    destinatario_id: string | null;
  }>(
    `SELECT user_id, merchant_name, description, raw_description, destinatario_id
     FROM transactions WHERE id = ?`,
    [transactionId]
  );
  if (!tx) return;

  // 3. Upsert a category rule from the merchant pattern. A cross-device duplicate
  //    INSERT is skipped harmlessly by push.ts (23505 → skip), so no stall.
  const pattern = extractPattern(tx.merchant_name, tx.description, tx.raw_description);
  if (pattern && tx.user_id) {
    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      // SELECT inside the transaction so two rapid categorizations of the same
      // pattern serialize (the 2nd sees the row and UPDATEs) instead of racing
      // into a duplicate INSERT that throws UNIQUE(user_id, pattern).
      const existing = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM category_rules WHERE user_id = ? AND pattern = ?",
        [tx.user_id, pattern]
      );
      if (existing) {
        await db.runAsync(
          "UPDATE category_rules SET category_id = ?, match_count = match_count + 1, updated_at = ? WHERE id = ?",
          [categoryId, now, existing.id]
        );
        await enqueueUpdate(
          db,
          "category_rules",
          existing.id,
          { category_id: categoryId, updated_at: now },
          now
        );
      } else {
        const ruleId = Crypto.randomUUID();
        await db.runAsync(
          `INSERT INTO category_rules (id, user_id, pattern, category_id, match_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)`,
          [ruleId, tx.user_id, pattern, categoryId, now, now]
        );
        await enqueueInsert(
          db,
          "category_rules",
          ruleId,
          {
            id: ruleId,
            user_id: tx.user_id,
            pattern,
            category_id: categoryId,
            match_count: 1,
            created_at: now,
            updated_at: now,
          },
          now
        );
      }
    });
  }

  // 4. Backfill the destinatario's default category when unset (conditional
  //    UPDATE — no-ops if already set). Mirrors webapp.
  if (tx.destinatario_id) {
    const destinatarioId = tx.destinatario_id;
    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      const res = await db.runAsync(
        "UPDATE destinatarios SET default_category_id = ?, updated_at = ? WHERE id = ? AND default_category_id IS NULL",
        [categoryId, now, destinatarioId]
      );
      if (res.changes > 0) {
        await enqueueUpdate(
          db,
          "destinatarios",
          destinatarioId,
          { default_category_id: categoryId, updated_at: now },
          now
        );
      }
    });
  }
}
