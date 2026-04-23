import * as Crypto from "expo-crypto";
import type { RecurrenceFrequency, TransactionDirection } from "@zeta/shared";
import { getDatabase } from "../db/database";
import { enqueueInsert } from "../sync/queue";

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
