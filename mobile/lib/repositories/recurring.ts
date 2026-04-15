import { getDatabase } from "../db/database";

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
