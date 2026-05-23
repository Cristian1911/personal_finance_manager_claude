import * as Crypto from "expo-crypto";
import type { RecurrenceFrequency, TransactionDirection } from "@zeta/shared";
import { getDatabase } from "../db/database";
import { enqueueInsert, enqueueUpdate } from "../sync/queue";

/** Convert a recurring amount to its monthly equivalent based on frequency. */
export function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "WEEKLY": return amount * 4.33;
    case "BIWEEKLY": return amount * 2.17;
    case "MONTHLY": return amount;
    case "QUARTERLY": return amount / 3;
    case "ANNUAL": return amount / 12;
    default: return amount;
  }
}

export type RecurringTemplateRow = {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  currency_code: string;
  direction: string;
  frequency: string;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string;
  end_date: string | null;
  merchant_name: string | null;
  description: string | null;
  transfer_source_account_id: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type RecurringOccurrenceRow = {
  id: string;
  user_id: string;
  template_id: string;
  occurrence_date: string;
  expected_amount: number;
  status: "pending" | "paid" | "skipped";
  transaction_id: string | null;
  paid_at: string | null;
  skipped_at: string | null;
  linked_manually: number;
  created_at: string;
};

/** Joined occurrence + template for display */
export type OccurrenceWithTemplate = RecurringOccurrenceRow & {
  merchant_name: string | null;
  description: string | null;
  account_id: string;
  category_id: string | null;
  currency_code: string;
  direction: string;
  frequency: string;
  template_is_active: number;
};

export async function getActiveTemplates(): Promise<RecurringTemplateRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<RecurringTemplateRow>(
    `SELECT * FROM recurring_transaction_templates
     WHERE is_active = 1
     ORDER BY day_of_month ASC, merchant_name ASC`
  );
}

export async function getAllTemplates(): Promise<RecurringTemplateRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<RecurringTemplateRow>(
    `SELECT * FROM recurring_transaction_templates
     ORDER BY is_active DESC, merchant_name ASC`
  );
}

export async function getTemplateById(
  id: string
): Promise<RecurringTemplateRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<RecurringTemplateRow>(
    "SELECT * FROM recurring_transaction_templates WHERE id = ?",
    [id]
  );
}

export async function getTemplatesByIds(
  ids: string[]
): Promise<RecurringTemplateRow[]> {
  if (ids.length === 0) return [];
  const db = await getDatabase();
  const placeholders = ids.map(() => "?").join(", ");
  return db.getAllAsync<RecurringTemplateRow>(
    `SELECT * FROM recurring_transaction_templates WHERE id IN (${placeholders})`,
    ids
  );
}

/**
 * Get occurrences for a given month with joined template data.
 * @param month - YYYY-MM format
 */
export async function getOccurrencesForMonth(
  month: string
): Promise<OccurrenceWithTemplate[]> {
  const db = await getDatabase();

  return db.getAllAsync<OccurrenceWithTemplate>(
    `SELECT
      o.*,
      t.merchant_name,
      t.description,
      t.account_id,
      t.category_id,
      t.currency_code,
      t.direction,
      t.frequency,
      t.is_active AS template_is_active
    FROM recurring_occurrences o
    JOIN recurring_transaction_templates t ON o.template_id = t.id
    WHERE o.occurrence_date LIKE ?
    ORDER BY o.occurrence_date ASC, t.merchant_name ASC`,
    [`${month}%`]
  );
}

export async function getPendingOccurrences(): Promise<OccurrenceWithTemplate[]> {
  const db = await getDatabase();
  return db.getAllAsync<OccurrenceWithTemplate>(
    `SELECT
      o.*,
      t.merchant_name,
      t.description,
      t.account_id,
      t.category_id,
      t.currency_code,
      t.direction,
      t.frequency,
      t.is_active AS template_is_active
    FROM recurring_occurrences o
    JOIN recurring_transaction_templates t ON o.template_id = t.id
    WHERE o.status = 'pending'
    ORDER BY o.occurrence_date ASC`,
  );
}

export async function getRecurringSummary(month: string) {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{
    total_expected: number;
    pending_count: number;
    paid_count: number;
    skipped_count: number;
  }>(
    `SELECT
      COALESCE(SUM(o.expected_amount), 0) AS total_expected,
      COALESCE(SUM(CASE WHEN o.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
      COALESCE(SUM(CASE WHEN o.status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_count,
      COALESCE(SUM(CASE WHEN o.status = 'skipped' THEN 1 ELSE 0 END), 0) AS skipped_count
    FROM recurring_occurrences o
    WHERE o.occurrence_date LIKE ?`,
    [`${month}%`]
  );

  return row ?? { total_expected: 0, pending_count: 0, paid_count: 0, skipped_count: 0 };
}

export type CreateRecurringTemplateParams = {
  user_id: string;
  account_id: string;
  amount: number;
  currency_code: string;
  direction: TransactionDirection;
  frequency: RecurrenceFrequency;
  start_date: string;
  end_date?: string | null;
  merchant_name?: string | null;
  description?: string | null;
  category_id?: string | null;
  destinatario_id?: string | null;
  day_of_month?: number | null;
  day_of_week?: number | null;
  transfer_source_account_id?: string | null;
  /** Optional pre-fetched account type — lets callers skip the DEBT guard's SELECT. */
  account_type?: string | null;
};

/**
 * Create a recurring template locally and enqueue for sync.
 * Mirrors webapp `createRecurringTemplate` shape minus sub_payments
 * (mobile doesn't yet handle multi-currency sub-payments).
 * Server-side occurrences generation (ensureCurrentOccurrences) happens
 * on pull after the template syncs.
 */
const DEBT_ACCOUNT_TYPES = new Set(["CREDIT_CARD", "LOAN"]);

export async function createRecurringTemplate(
  params: CreateRecurringTemplateParams
): Promise<string> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  // Defense-in-depth: enforce the same debt-account rules the webapp's
  // `insertRecurringTemplateFromFormData` applies. Callers (e.g. capture.tsx)
  // should pre-check, but a stray caller must not produce corrupt rows.
  const acctType =
    params.account_type ??
    (
      await db.getFirstAsync<{ account_type: string }>(
        "SELECT account_type FROM accounts WHERE id = ?",
        [params.account_id]
      )
    )?.account_type;
  const isDebtAccount = !!acctType && DEBT_ACCOUNT_TYPES.has(acctType);
  if (isDebtAccount && !params.transfer_source_account_id) {
    throw new Error(
      "Debes seleccionar la cuenta origen para un pago de deuda."
    );
  }
  const effectiveDirection: TransactionDirection = isDebtAccount
    ? "INFLOW"
    : params.direction;

  const payload = {
    id,
    user_id: params.user_id,
    account_id: params.account_id,
    category_id: params.category_id ?? null,
    amount: params.amount,
    currency_code: params.currency_code,
    direction: effectiveDirection,
    frequency: params.frequency,
    day_of_month: params.day_of_month ?? null,
    day_of_week: params.day_of_week ?? null,
    start_date: params.start_date,
    end_date: params.end_date ?? null,
    merchant_name: params.merchant_name ?? null,
    description: params.description ?? null,
    destinatario_id: params.destinatario_id ?? null,
    transfer_source_account_id: params.transfer_source_account_id ?? null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO recurring_transaction_templates
        (id, user_id, account_id, category_id, amount, currency_code, direction, frequency,
         day_of_month, day_of_week, start_date, end_date, merchant_name, description,
         destinatario_id, transfer_source_account_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        payload.id,
        payload.user_id,
        payload.account_id,
        payload.category_id,
        payload.amount,
        payload.currency_code,
        payload.direction,
        payload.frequency,
        payload.day_of_month,
        payload.day_of_week,
        payload.start_date,
        payload.end_date,
        payload.merchant_name,
        payload.description,
        payload.destinatario_id,
        payload.transfer_source_account_id,
        now,
        now,
      ]
    );

    await enqueueInsert(db, "recurring_transaction_templates", id, payload, now);
  });

  return id;
}

/** Mark an occurrence as paid and enqueue for sync. */
export async function confirmOccurrence(occurrenceId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    "UPDATE recurring_occurrences SET status = 'paid', paid_at = ? WHERE id = ?",
    [now, occurrenceId]
  );
  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
    [
      "recurring_occurrences",
      occurrenceId,
      "UPDATE",
      JSON.stringify({ status: "paid", paid_at: now }),
      now,
    ]
  );
}

/** True when a `recurring_occurrences` row already points to this transaction. */
export async function isTransactionLinkedToOccurrence(
  transactionId: string
): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM recurring_occurrences WHERE transaction_id = ? LIMIT 1",
    [transactionId]
  );
  return !!row;
}

/** Candidate occurrence to vinculate with an existing transaction. */
export type CandidateOccurrence = {
  id: string;
  templateId: string;
  merchant: string;
  occurrenceDate: string;
  expectedAmount: number;
  currencyCode: string;
  matchScore: number;
};

function computeMatchScore(
  candidateDate: string,
  candidateAmount: number,
  referenceDate: string,
  referenceAmount: number
): number {
  const c = new Date(candidateDate + "T12:00:00");
  const r = new Date(referenceDate + "T12:00:00");
  const daysDiff = Math.abs(
    Math.round((c.getTime() - r.getTime()) / (1000 * 60 * 60 * 24))
  );
  const dateScore = Math.max(0, 1 - daysDiff / 30);
  const amountDiff = Math.abs(candidateAmount - referenceAmount);
  const amountScore =
    referenceAmount > 0 ? Math.max(0, 1 - amountDiff / referenceAmount) : 0;
  return dateScore * 0.6 + amountScore * 0.4;
}

/**
 * Pending occurrences in a ±30-day window around the transaction's date.
 * Matches webapp `getCandidateOccurrencesForTransaction`:
 * - Same account + direction (direct match), OR
 * - Cross-account debt payment: an OUTFLOW tx from a source checking account
 *   matches an INFLOW template on a CREDIT_CARD/LOAN whose
 *   `transfer_source_account_id` points back to the tx's account.
 *
 * One intentional deviation: adds `AND t.is_active = 1` so deactivated
 * templates don't surface stale candidates. Webapp doesn't filter is_active;
 * in practice deactivated templates rarely have leftover pending occurrences.
 *
 * Note: LEFT JOIN on `accounts` means if the account row hasn't synced yet,
 * `a.account_type` is NULL and the cross-account branch is silently excluded
 * (degraded mode). User just won't see the Vincular candidate until accounts
 * sync; no false positives.
 */
export async function getCandidateOccurrencesForTransaction(
  transactionId: string
): Promise<CandidateOccurrence[]> {
  const db = await getDatabase();
  const tx = await db.getFirstAsync<{
    account_id: string;
    direction: TransactionDirection;
    transaction_date: string;
    amount: number;
  }>(
    "SELECT account_id, direction, transaction_date, amount FROM transactions WHERE id = ?",
    [transactionId]
  );
  if (!tx) return [];

  const base = new Date(tx.transaction_date + "T12:00:00");
  const rangeStart = new Date(base);
  rangeStart.setDate(rangeStart.getDate() - 30);
  const rangeEnd = new Date(base);
  rangeEnd.setDate(rangeEnd.getDate() + 30);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const rows = await db.getAllAsync<{
    id: string;
    template_id: string;
    occurrence_date: string;
    expected_amount: number;
    merchant_name: string | null;
    description: string | null;
    currency_code: string;
  }>(
    `SELECT
       o.id, o.template_id, o.occurrence_date, o.expected_amount,
       t.merchant_name, t.description, t.currency_code
     FROM recurring_occurrences o
     JOIN recurring_transaction_templates t ON o.template_id = t.id
     LEFT JOIN accounts a ON t.account_id = a.id
     WHERE o.status = 'pending'
       AND o.occurrence_date BETWEEN ? AND ?
       AND t.is_active = 1
       AND (
         (t.account_id = ? AND t.direction = ?)
         OR (
           ? = 'OUTFLOW'
           AND t.direction = 'INFLOW'
           AND t.transfer_source_account_id = ?
           AND a.account_type IN ('CREDIT_CARD', 'LOAN')
         )
       )`,
    [
      fmt(rangeStart),
      fmt(rangeEnd),
      tx.account_id,
      tx.direction,
      tx.direction,
      tx.account_id,
    ]
  );

  const candidates: CandidateOccurrence[] = rows.map((r) => ({
    id: r.id,
    templateId: r.template_id,
    merchant: r.merchant_name ?? r.description ?? "Recurrente",
    occurrenceDate: r.occurrence_date,
    expectedAmount: r.expected_amount,
    currencyCode: r.currency_code,
    // Argument order matches webapp `getCandidateOccurrencesForTransaction`:
    // tx is the "candidate" (numerator), occurrence is the "reference"
    // (denominator). Swapping these makes amount-tie-breaking diverge.
    matchScore: computeMatchScore(
      tx.transaction_date,
      tx.amount,
      r.occurrence_date,
      r.expected_amount
    ),
  }));

  candidates.sort((a, b) => b.matchScore - a.matchScore);
  return candidates;
}

/**
 * Account IDs that have at least one pending occurrence — used to gate the
 * "Vincular" affordance on the TX detail screen.
 */
export async function getAccountIdsWithPendingOccurrences(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ account_id: string; transfer_source_account_id: string | null }>(
    `SELECT DISTINCT t.account_id, t.transfer_source_account_id
     FROM recurring_occurrences o
     JOIN recurring_transaction_templates t ON o.template_id = t.id
     WHERE o.status = 'pending' AND t.is_active = 1`
  );
  const set = new Set<string>();
  for (const r of rows) {
    set.add(r.account_id);
    if (r.transfer_source_account_id) set.add(r.transfer_source_account_id);
  }
  return Array.from(set);
}

/**
 * SHA256-based deterministic group UUID identical to webapp's
 * `computeRecurringGroupUuid`. Stamped on the transaction so the webapp
 * (and aggregations) recognize the tx as part of the recurring series.
 */
async function computeRecurringGroupUuid(
  templateId: string,
  occurrenceDate: string
): Promise<string> {
  const payload = `${templateId}|${occurrenceDate}`;
  const hex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    payload,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  const bytes: number[] = [];
  for (let i = 0; i < 32; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  // Force RFC v4 version + variant bits so Postgres accepts the UUID.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Vinculate an existing transaction to a pending recurring occurrence.
 * Mirrors webapp `linkExistingTransactionToOccurrence`:
 * - Stamps `recurrence_group_id` on the transaction (so it shows up as a
 *   recurring payment in series-aware views).
 * - If the tx has no category, inherits the template's category.
 * - Marks the occurrence paid + linked_manually=true.
 * - Auto-deactivates ONCE templates.
 *
 * Throws if the occurrence isn't pending or accounts/direction mismatch.
 */
export async function linkExistingTransactionToOccurrence(
  occurrenceId: string,
  transactionId: string
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const occ = await db.getFirstAsync<{
    id: string;
    template_id: string;
    occurrence_date: string;
    status: string;
    account_id: string;
    direction: TransactionDirection;
    frequency: string;
    category_id: string | null;
    transfer_source_account_id: string | null;
    account_type: string | null;
  }>(
    `SELECT o.id, o.template_id, o.occurrence_date, o.status,
            t.account_id, t.direction, t.frequency, t.category_id,
            t.transfer_source_account_id, a.account_type
     FROM recurring_occurrences o
     JOIN recurring_transaction_templates t ON o.template_id = t.id
     LEFT JOIN accounts a ON t.account_id = a.id
     WHERE o.id = ?`,
    [occurrenceId]
  );
  if (!occ) throw new Error("Ocurrencia no encontrada");
  if (occ.status !== "pending") {
    throw new Error("La ocurrencia ya no está pendiente");
  }

  const tx = await db.getFirstAsync<{
    account_id: string;
    direction: TransactionDirection;
    category_id: string | null;
  }>(
    "SELECT account_id, direction, category_id FROM transactions WHERE id = ?",
    [transactionId]
  );
  if (!tx) throw new Error("Transacción no encontrada");

  const directMatch =
    tx.account_id === occ.account_id && tx.direction === occ.direction;
  const crossAccountDebt =
    occ.direction === "INFLOW" &&
    tx.direction === "OUTFLOW" &&
    occ.transfer_source_account_id === tx.account_id &&
    !!occ.account_type &&
    DEBT_ACCOUNT_TYPES.has(occ.account_type);
  if (!directMatch && !crossAccountDebt) {
    throw new Error("La transacción no coincide con la cuenta o dirección");
  }

  const recurrenceGroupId = await computeRecurringGroupUuid(
    occ.template_id,
    occ.occurrence_date
  );

  const txUpdates: Record<string, unknown> = {
    recurrence_group_id: recurrenceGroupId,
  };
  if (!tx.category_id && occ.category_id) {
    txUpdates.category_id = occ.category_id;
    txUpdates.categorization_source = "RECURRING_TEMPLATE";
  }

  await db.withTransactionAsync(async () => {
    // Stamp transaction
    const setClauses = Object.keys(txUpdates).map((k) => `${k} = ?`);
    const txValues = Object.values(txUpdates);
    await db.runAsync(
      `UPDATE transactions SET ${setClauses.join(", ")} WHERE id = ?`,
      [...(txValues as any[]), transactionId]
    );
    await enqueueUpdate(db, "transactions", transactionId, txUpdates, now);

    // Mark occurrence paid
    const occPayload = {
      status: "paid",
      transaction_id: transactionId,
      paid_at: now,
      linked_manually: true,
    };
    await db.runAsync(
      `UPDATE recurring_occurrences
         SET status = 'paid', transaction_id = ?, paid_at = ?, linked_manually = 1
         WHERE id = ?`,
      [transactionId, now, occurrenceId]
    );
    await enqueueUpdate(db, "recurring_occurrences", occurrenceId, occPayload, now);

    // Auto-deactivate ONCE templates
    if (occ.frequency === "ONCE") {
      await db.runAsync(
        "UPDATE recurring_transaction_templates SET is_active = 0, updated_at = ? WHERE id = ?",
        [now, occ.template_id]
      );
      await enqueueUpdate(
        db,
        "recurring_transaction_templates",
        occ.template_id,
        { is_active: false, updated_at: now },
        now
      );
    }
  });
}

/** Mark an occurrence as skipped and enqueue for sync. */
export async function skipOccurrence(occurrenceId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    "UPDATE recurring_occurrences SET status = 'skipped', skipped_at = ? WHERE id = ?",
    [now, occurrenceId]
  );
  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
    [
      "recurring_occurrences",
      occurrenceId,
      "UPDATE",
      JSON.stringify({ status: "skipped", skipped_at: now }),
      now,
    ]
  );
}
