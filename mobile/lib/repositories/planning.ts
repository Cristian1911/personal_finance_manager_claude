import * as Crypto from "expo-crypto";
import { getDatabase } from "../db/database";
import { enqueueDelete, enqueueInsert, enqueueUpdate } from "../sync/queue";

export type PlanningPeriodRow = {
  id: string;
  user_id: string;
  name: string | null;
  preset: string;
  start_date: string;
  end_date: string;
  currency_code: string;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanningEntryRow = {
  id: string;
  user_id: string;
  period_id: string;
  entry_type: "INCOME" | "EXPENSE";
  label: string;
  amount: number;
  currency_code: string;
  expected_date: string;
  status: "PLANNED" | "COMPLETED" | "SKIPPED";
  completed_at: string | null;
  recurring_template_id: string | null;
  account_id: string | null;
  category_id: string | null;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanningAssignmentRow = {
  id: string;
  user_id: string;
  period_id: string;
  income_entry_id: string;
  expense_entry_id: string;
  assigned_amount: number;
  created_at: string;
  updated_at: string;
};

export async function getActivePeriod(
  userId: string
): Promise<PlanningPeriodRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<PlanningPeriodRow>(
    `SELECT * FROM planning_periods
     WHERE user_id = ? AND is_active = 1
     ORDER BY start_date DESC
     LIMIT 1`,
    [userId]
  );
}

export async function getPeriodEntries(
  userId: string,
  periodId: string
): Promise<PlanningEntryRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<PlanningEntryRow>(
    `SELECT * FROM planning_entries
     WHERE user_id = ? AND period_id = ?
     ORDER BY expected_date ASC, sort_order ASC`,
    [userId, periodId]
  );
}

export async function getPeriodAssignments(
  userId: string,
  periodId: string
): Promise<PlanningAssignmentRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<PlanningAssignmentRow>(
    `SELECT * FROM planning_assignments
     WHERE user_id = ? AND period_id = ?`,
    [userId, periodId]
  );
}

/** Composite read for the /periodo screen — active period + entries + assignments. */
export async function getActivePeriodWithEntries(userId: string): Promise<{
  period: PlanningPeriodRow;
  entries: PlanningEntryRow[];
  assignments: PlanningAssignmentRow[];
} | null> {
  const period = await getActivePeriod(userId);
  if (!period) return null;
  const [entries, assignments] = await Promise.all([
    getPeriodEntries(userId, period.id),
    getPeriodAssignments(userId, period.id),
  ]);
  return { period, entries, assignments };
}

/** Mark a planning entry as COMPLETED and enqueue the UPDATE. */
export async function markEntryCompleted(entryId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE planning_entries
       SET status = 'COMPLETED', completed_at = ?, updated_at = ?
       WHERE id = ?`,
      [now, now, entryId]
    );
    await enqueueUpdate(
      db,
      "planning_entries",
      entryId,
      { status: "COMPLETED", completed_at: now, updated_at: now },
      now
    );
  });
}

/** Update the assigned_amount on an existing assignment. */
export async function updateAssignmentAmount(
  assignmentId: string,
  amount: number
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE planning_assignments
       SET assigned_amount = ?, updated_at = ?
       WHERE id = ?`,
      [amount, now, assignmentId]
    );
    await enqueueUpdate(
      db,
      "planning_assignments",
      assignmentId,
      { assigned_amount: amount, updated_at: now },
      now
    );
  });
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "DELETE FROM planning_assignments WHERE id = ?",
      [assignmentId]
    );
    await enqueueDelete(db, "planning_assignments", assignmentId, now);
  });
}

export type CreateAssignmentParams = {
  user_id: string;
  period_id: string;
  income_entry_id: string;
  expense_entry_id: string;
  assigned_amount: number;
};

export async function createAssignment(
  params: CreateAssignmentParams
): Promise<string> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const payload = {
    id,
    user_id: params.user_id,
    period_id: params.period_id,
    income_entry_id: params.income_entry_id,
    expense_entry_id: params.expense_entry_id,
    assigned_amount: params.assigned_amount,
    created_at: now,
    updated_at: now,
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO planning_assignments
       (id, user_id, period_id, income_entry_id, expense_entry_id, assigned_amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.id,
        payload.user_id,
        payload.period_id,
        payload.income_entry_id,
        payload.expense_entry_id,
        payload.assigned_amount,
        payload.created_at,
        payload.updated_at,
      ]
    );
    await enqueueInsert(db, "planning_assignments", id, payload, now);
  });
  return id;
}
