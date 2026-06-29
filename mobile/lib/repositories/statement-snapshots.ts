import * as Crypto from "expo-crypto";
import { getDatabase } from "../db/database";
import { enqueueInsert, enqueueUpdate } from "../sync/queue";

/**
 * Local statement_snapshots writer — the mobile mirror of webapp
 * processStatementMeta's snapshot upsert. The mobile table now carries the same
 * columns as the Supabase view (migration v20); the legacy local-only columns
 * (`period` NOT NULL, `statement_date`, `statement_json`) are NOT part of the
 * Supabase shape, so we supply `period` locally on INSERT but keep it OUT of the
 * sync payload (the push sends the payload verbatim — extra columns would 400).
 *
 * Dedup mirrors the webapp's natural key (user_id, account_id, currency_code,
 * period_from, period_to): SELECT the existing row, then UPDATE by id or INSERT.
 */
export type StatementSnapshotInput = {
  userId: string;
  accountId: string;
  currencyCode: string;
  periodFrom: string | null;
  periodTo: string | null;
  previousBalance?: number | null;
  totalCredits?: number | null;
  totalDebits?: number | null;
  finalBalance?: number | null;
  purchasesAndCharges?: number | null;
  interestCharged?: number | null;
  creditLimit?: number | null;
  availableCredit?: number | null;
  interestRate?: number | null;
  lateInterestRate?: number | null;
  totalPaymentDue?: number | null;
  minimumPayment?: number | null;
  paymentDueDate?: string | null;
  remainingBalance?: number | null;
  initialAmount?: number | null;
  installmentsInDefault?: number | null;
  loanNumber?: string | null;
  sourceFilename?: string | null;
  importedCount: number;
  transactionCount: number;
  skippedCount: number;
};

export async function upsertLocalStatementSnapshot(
  input: StatementSnapshotInput
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // Supabase-shaped column set (everything synced). NO period/statement_date/
  // statement_json here — those are local-only legacy columns.
  const row: Record<string, unknown> = {
    user_id: input.userId,
    account_id: input.accountId,
    currency_code: input.currencyCode,
    period_from: input.periodFrom,
    period_to: input.periodTo,
    previous_balance: input.previousBalance ?? null,
    total_credits: input.totalCredits ?? null,
    total_debits: input.totalDebits ?? null,
    final_balance: input.finalBalance ?? null,
    purchases_and_charges: input.purchasesAndCharges ?? null,
    interest_charged: input.interestCharged ?? null,
    credit_limit: input.creditLimit ?? null,
    available_credit: input.availableCredit ?? null,
    interest_rate: input.interestRate ?? null,
    late_interest_rate: input.lateInterestRate ?? null,
    total_payment_due: input.totalPaymentDue ?? null,
    minimum_payment: input.minimumPayment ?? null,
    payment_due_date: input.paymentDueDate ?? null,
    remaining_balance: input.remainingBalance ?? null,
    initial_amount: input.initialAmount ?? null,
    installments_in_default: input.installmentsInDefault ?? null,
    loan_number: input.loanNumber ?? null,
    source_filename: input.sourceFilename ?? null,
    imported_count: input.importedCount,
    transaction_count: input.transactionCount,
    skipped_count: input.skippedCount,
    updated_at: now,
  };

  // Natural key match (NULL-safe on period_from/period_to).
  const keyParams: (string | null)[] = [input.userId, input.accountId, input.currencyCode];
  const fromClause = input.periodFrom != null ? "period_from = ?" : "period_from IS NULL";
  if (input.periodFrom != null) keyParams.push(input.periodFrom);
  const toClause = input.periodTo != null ? "period_to = ?" : "period_to IS NULL";
  if (input.periodTo != null) keyParams.push(input.periodTo);

  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM statement_snapshots
     WHERE user_id = ? AND account_id = ? AND currency_code = ?
       AND ${fromClause} AND ${toClause}`,
    keyParams
  );

  await db.withTransactionAsync(async () => {
    if (existing) {
      const cols = Object.keys(row);
      await db.runAsync(
        `UPDATE statement_snapshots SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
        [...cols.map((c) => row[c] as string | number | null), existing.id]
      );
      await enqueueUpdate(db, "statement_snapshots", existing.id, row, now);
    } else {
      const id = Crypto.randomUUID();
      // Local INSERT also supplies the legacy NOT-NULL `period` (month bucket).
      const period = (input.periodTo ?? input.periodFrom ?? now).slice(0, 7);
      const localRow: Record<string, unknown> = { id, ...row, period, created_at: now };
      const cols = Object.keys(localRow);
      await db.runAsync(
        `INSERT INTO statement_snapshots (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
        cols.map((c) => localRow[c] as string | number | null)
      );
      // Sync payload stays Supabase-shaped (no period/statement_date/statement_json).
      await enqueueInsert(db, "statement_snapshots", id, { id, ...row, created_at: now }, now);
    }
  });
}
