import * as Crypto from "expo-crypto";
import {
  getDebtPaymentCategoryId,
  getOccurrencesBetween,
  isDebtAccountType,
  occurrenceAmountMatches,
  OCCURRENCE_AUTO_LINK_DAY_WINDOW,
  TRANSFER_CATEGORY_ID,
  type RecurrenceFrequency,
  type TransactionDirection,
} from "@zeta/shared";
import { getDatabase } from "../db/database";
import { enqueueInsert, enqueueUpdate } from "../sync/queue";
import { toColombiaDateString } from "./accounts-detail";
import {
  applyLocalBalanceDelta,
  buildLedgerTxPayload,
  computeIdempotencyKey,
  insertLedgerTransaction,
  type LedgerAccountRow,
} from "./ledger-helpers";

/** Convert a recurring amount to its monthly equivalent based on frequency. */
export function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "WEEKLY": return amount * 4.33;
    // Quincenal is month-anchored (two fixed days per month), so exactly 2.
    case "BIWEEKLY": return amount * 2;
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
  destinatario_id: string | null;
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
  // On a debt account the direction is the discriminator: INFLOW = "abono a
  // deuda" (paid via transfer, needs a source account); OUTFLOW = a recurring
  // charge billed to the card (no source). Mirrors the webapp's
  // `normalizeDebtTemplatePayload`.
  const isDebtPayment = isDebtAccount && params.direction === "INFLOW";
  if (isDebtPayment && !params.transfer_source_account_id) {
    throw new Error(
      "Debes seleccionar la cuenta origen para un pago de deuda."
    );
  }
  const effectiveDirection: TransactionDirection = params.direction;

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
    transfer_source_account_id: isDebtPayment
      ? (params.transfer_source_account_id ?? null)
      : null,
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

/**
 * Update an existing recurring template + enqueue the sync UPDATE. Same debt
 * rules as create. Occurrences are reconciled server-side (ensureCurrentOccurrences)
 * on pull, exactly as on create — mobile doesn't regenerate them locally.
 */
export async function updateRecurringTemplate(
  id: string,
  params: CreateRecurringTemplateParams
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const acctType =
    params.account_type ??
    (
      await db.getFirstAsync<{ account_type: string }>(
        "SELECT account_type FROM accounts WHERE id = ?",
        [params.account_id]
      )
    )?.account_type;
  const isDebtAccount = !!acctType && DEBT_ACCOUNT_TYPES.has(acctType);
  const isDebtPayment = isDebtAccount && params.direction === "INFLOW";
  if (isDebtPayment && !params.transfer_source_account_id) {
    throw new Error(
      "Debes seleccionar la cuenta origen para un pago de deuda."
    );
  }

  const fields = {
    account_id: params.account_id,
    category_id: params.category_id ?? null,
    amount: params.amount,
    currency_code: params.currency_code,
    direction: params.direction,
    frequency: params.frequency,
    day_of_month: params.day_of_month ?? null,
    day_of_week: params.day_of_week ?? null,
    start_date: params.start_date,
    end_date: params.end_date ?? null,
    merchant_name: params.merchant_name ?? null,
    description: params.description ?? null,
    destinatario_id: params.destinatario_id ?? null,
    transfer_source_account_id: isDebtPayment
      ? (params.transfer_source_account_id ?? null)
      : null,
    updated_at: now,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE recurring_transaction_templates SET
        account_id = ?, category_id = ?, amount = ?, currency_code = ?, direction = ?,
        frequency = ?, day_of_month = ?, day_of_week = ?, start_date = ?, end_date = ?,
        merchant_name = ?, description = ?, destinatario_id = ?,
        transfer_source_account_id = ?, updated_at = ?
       WHERE id = ?`,
      [
        fields.account_id,
        fields.category_id,
        fields.amount,
        fields.currency_code,
        fields.direction,
        fields.frequency,
        fields.day_of_month,
        fields.day_of_week,
        fields.start_date,
        fields.end_date,
        fields.merchant_name,
        fields.description,
        fields.destinatario_id,
        fields.transfer_source_account_id,
        now,
        id,
      ]
    );

    // Keep pending occurrences' expected amount aligned with the new template
    // amount (mirrors the webapp's syncPendingOccurrenceAmounts after update).
    const pendingOccurrences = await db.getAllAsync<{ id: string }>(
      "SELECT id FROM recurring_occurrences WHERE template_id = ? AND status = 'pending'",
      [id]
    );
    if (pendingOccurrences.length > 0) {
      await db.runAsync(
        "UPDATE recurring_occurrences SET expected_amount = ? WHERE template_id = ? AND status = 'pending'",
        [params.amount, id]
      );
      for (const occ of pendingOccurrences) {
        await enqueueUpdate(
          db,
          "recurring_occurrences",
          occ.id,
          { expected_amount: params.amount },
          now
        );
      }
    }

    await enqueueUpdate(db, "recurring_transaction_templates", id, fields, now);
  });
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
  /** Template's anchored destinatario — auto-link uses it to pick the amount tolerance tier. */
  destinatarioId: string | null;
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
    destinatario_id: string | null;
  }>(
    `SELECT
       o.id, o.template_id, o.occurrence_date, o.expected_amount,
       t.merchant_name, t.description, t.currency_code, t.destinatario_id
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
    destinatarioId: r.destinatario_id,
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
  transactionId: string,
  options?: { linkedManually?: boolean }
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  // Manual "Vincular" sets linked_manually=true; auto-linking on create/import
  // (findAndLinkLocalOccurrence) passes false to mirror webapp's auto path.
  const linkedManually = options?.linkedManually ?? true;

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
      linked_manually: linkedManually,
    };
    await db.runAsync(
      `UPDATE recurring_occurrences
         SET status = 'paid', transaction_id = ?, paid_at = ?, linked_manually = ?
         WHERE id = ?`,
      [transactionId, now, linkedManually ? 1 : 0, occurrenceId]
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

/**
 * Auto-link a just-created/imported transaction to its matching pending
 * recurring occurrence — the mobile mirror of webapp `linkTransactionToOccurrence`
 * (called after every persistTransaction / import). Best-effort: returns false
 * (never throws) when there's no confident match.
 *
 * Reuses the ±30-day candidate finder but auto-links only a CONFIDENT match,
 * tighter than the manual "Vincular" window, so a create never silently grabs
 * a distant occurrence. The day window and the tiered amount tolerance
 * (anchored = tx destinatario matches template destinatario → wide band;
 * unanchored → near-exact) come from @zeta/shared `occurrence-matching.ts`,
 * the same constants webapp `findMatchingOccurrence` uses — the two
 * implementations must not drift. Marks the occurrence paid with
 * linked_manually=false (auto), via the shared link routine.
 */
export async function findAndLinkLocalOccurrence(
  transactionId: string
): Promise<boolean> {
  const db = await getDatabase();
  const tx = await db.getFirstAsync<{
    transaction_date: string;
    amount: number;
    destinatario_id: string | null;
  }>(
    "SELECT transaction_date, amount, destinatario_id FROM transactions WHERE id = ?",
    [transactionId]
  );
  if (!tx) return false;

  const candidates = await getCandidateOccurrencesForTransaction(transactionId);
  if (candidates.length === 0) return false;

  const txTime = new Date(tx.transaction_date + "T12:00:00").getTime();
  // candidates are sorted by matchScore desc, so the first confident one is best.
  const best = candidates.find((c) => {
    const occTime = new Date(c.occurrenceDate + "T12:00:00").getTime();
    const dayDiff = Math.abs(occTime - txTime) / 86_400_000;
    if (dayDiff > OCCURRENCE_AUTO_LINK_DAY_WINDOW) return false;
    const anchored =
      !!tx.destinatario_id && c.destinatarioId === tx.destinatario_id;
    return occurrenceAmountMatches(c.expectedAmount, tx.amount, anchored);
  });
  if (!best) return false;

  try {
    await linkExistingTransactionToOccurrence(best.id, transactionId, {
      linkedManually: false,
    });
    return true;
  } catch {
    // Best-effort — a race (occurrence already paid) must never fail the create.
    return false;
  }
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

// ─── Record a recurring occurrence payment (full ledger mutation) ────────────

export type RecordRecurringOccurrencePaymentInput = {
  templateId: string;
  /** Local `recurring_occurrences.id` of the occurrence being paid. When the
   * UI caller has it (it does), pass it so the occurrence UPDATE is keyed by id
   * — no template+date guess, no missing-sync-row race. */
  occurrenceId?: string;
  /** YYYY-MM-DD — the scheduled occurrence date (drives idempotency + matching). */
  occurrenceDate: string;
  /** YYYY-MM-DD — when the payment actually happened. Defaults to occurrenceDate. */
  paymentDate?: string;
  actualAmount: number;
  sourceAccountId?: string | null;
};

export type RecordRecurringOccurrencePaymentResult =
  | { success: true; created: number; alreadyRecorded: number }
  | { success: false; error: string };

type RecurringLeg = {
  accountId: string;
  amount: number;
  direction: TransactionDirection;
  rawDescription: string;
  merchantName: string;
  categoryId: string | null;
  notes: string;
};

/**
 * Offline-first mirror of webapp recurring-templates.ts
 * `recordRecurringOccurrencePayment`. Replaces the old confirmOccurrence stub's
 * logic for the "marcar como pagada con monto" path.
 *
 * - Validates `occurrenceDate` matches the template via getOccurrencesBetween.
 * - Debt template → TWO legs: OUTFLOW from the source account
 *   (category TRANSFER_CATEGORY_ID) + INFLOW on the debt account
 *   (category template.category_id ?? getDebtPaymentCategoryId(account_type)).
 *   Non-debt → ONE leg on the template account.
 * - recurrence_group_id = computeRecurringGroupUuid(templateId, occurrenceDate)
 *   (reused existing local impl — byte-identical to webapp).
 * - PER-LEG idempotency: provider "RECURRING_CHECKLIST", providerTransactionId
 *   = `${templateId}|${occurrenceDate}|${accountId}|${direction}` (uses
 *   occurrenceDate, NOT paymentDate — distinct per leg).
 * - On created > 0: occurrence → status 'paid', transaction_id = firstCreated,
 *   paid_at = now (does NOT set linked_manually). Copies recurring_template_tags
 *   → transaction_tags (soft-fail).
 * - Applies the balance delta per CREATED tx only (skips dupes → no double
 *   debit) against an in-memory accountMap, so a debt account hit by both legs
 *   accumulates correctly. If a debt nextBalance <= 0 → deactivate templates +
 *   delete pending occurrences (payoff lifecycle).
 * - All writes wrapped in ONE withTransactionAsync.
 */
export async function recordRecurringOccurrencePayment(
  input: RecordRecurringOccurrencePaymentInput
): Promise<RecordRecurringOccurrencePaymentResult> {
  if (!(input.actualAmount > 0)) {
    return { success: false, error: "El monto debe ser mayor que cero." };
  }

  const db = await getDatabase();
  const now = new Date().toISOString();

  const template = await db.getFirstAsync<{
    id: string;
    user_id: string;
    account_id: string;
    category_id: string | null;
    currency_code: string;
    direction: TransactionDirection;
    frequency: string;
    start_date: string;
    end_date: string | null;
    merchant_name: string | null;
    description: string | null;
    transfer_source_account_id: string | null;
    account_type: string | null;
  }>(
    `SELECT t.id, t.user_id, t.account_id, t.category_id, t.currency_code, t.direction,
            t.frequency, t.start_date, t.end_date, t.merchant_name, t.description,
            t.transfer_source_account_id, a.account_type
     FROM recurring_transaction_templates t
     LEFT JOIN accounts a ON t.account_id = a.id
     WHERE t.id = ?`,
    [input.templateId]
  );
  if (!template) {
    return { success: false, error: "No se encontró la plantilla recurrente." };
  }
  // Fail fast on a missing user_id — an empty-string user_id produces rows that
  // fail Supabase RLS and stick in sync_queue forever.
  if (!template.user_id) {
    return { success: false, error: "Sesión inválida" };
  }

  // Validate occurrence matches the template's recurrence.
  const targetDate = new Date(`${input.occurrenceDate}T12:00:00`);
  const occurrences = getOccurrencesBetween(
    template.start_date,
    template.frequency as RecurrenceFrequency,
    template.end_date,
    targetDate,
    targetDate
  );
  if (!occurrences.includes(input.occurrenceDate)) {
    return { success: false, error: "La fecha no coincide con la recurrencia de la plantilla." };
  }

  // Only an INFLOW template on a debt account is an "abono" (two-leg transfer).
  // An OUTFLOW template is a recurring charge billed to the card — a single
  // OUTFLOW transaction, no source account. Mirrors the webapp's
  // resolveSourceAccountSelection.
  const isDebtPaymentTemplate =
    !!template.account_type &&
    isDebtAccountType(template.account_type) &&
    template.direction === "INFLOW";
  const effectiveSourceAccountId =
    input.sourceAccountId ?? template.transfer_source_account_id ?? null;

  if (isDebtPaymentTemplate && !effectiveSourceAccountId) {
    return { success: false, error: "Debes indicar la cuenta origen para registrar el pago de deuda." };
  }
  if (isDebtPaymentTemplate && effectiveSourceAccountId === template.account_id) {
    return { success: false, error: "La cuenta origen no puede ser la misma cuenta de deuda." };
  }

  // Load involved accounts into a mutable map (balance deltas mutate it).
  const accountIds = [
    template.account_id,
    ...(effectiveSourceAccountId ? [effectiveSourceAccountId] : []),
  ];
  const placeholders = accountIds.map(() => "?").join(", ");
  const accountRows = await db.getAllAsync<LedgerAccountRow>(
    `SELECT * FROM accounts WHERE id IN (${placeholders})`,
    accountIds
  );
  const accountMap = new Map(accountRows.map((a) => [a.id, a]));
  const targetAccount = accountMap.get(template.account_id);
  if (!targetAccount) {
    return { success: false, error: "No se encontró la cuenta destino del pago." };
  }

  // Build legs (mirror buildRecurringPaymentTransactions).
  const baseLabel = template.merchant_name || template.description || "Pago recurrente";
  let legs: RecurringLeg[];
  if (isDebtPaymentTemplate) {
    const sourceAccount = effectiveSourceAccountId ? accountMap.get(effectiveSourceAccountId) : null;
    if (!sourceAccount) {
      return { success: false, error: "No se encontró la cuenta origen para esta transferencia." };
    }
    legs = [
      {
        accountId: sourceAccount.id,
        amount: input.actualAmount,
        direction: "OUTFLOW",
        rawDescription: `Transferencia a ${targetAccount.name} - ${baseLabel}`,
        merchantName: `Transferencia a ${targetAccount.name}`,
        categoryId: TRANSFER_CATEGORY_ID,
        notes: "Pago recurrente marcado desde checklist",
      },
      {
        accountId: targetAccount.id,
        amount: input.actualAmount,
        direction: "INFLOW",
        rawDescription: `Abono deuda desde ${sourceAccount.name} - ${baseLabel}`,
        merchantName: baseLabel,
        categoryId: template.category_id ?? getDebtPaymentCategoryId(targetAccount.account_type),
        notes: "Abono de deuda marcado desde checklist recurrente",
      },
    ];
  } else {
    legs = [
      {
        accountId: template.account_id,
        amount: input.actualAmount,
        direction: template.direction,
        rawDescription: baseLabel,
        merchantName: baseLabel,
        categoryId: template.category_id,
        notes: "Transacción recurrente marcada desde checklist",
      },
    ];
  }

  const effectivePaymentDate = input.paymentDate ?? input.occurrenceDate;
  const recurrenceGroupId = await computeRecurringGroupUuid(template.id, input.occurrenceDate);

  let created = 0;
  let alreadyRecorded = 0;
  const createdTxIds: string[] = [];
  const createdLegs: { accountId: string; amount: number; direction: TransactionDirection }[] = [];

  await db.withTransactionAsync(async () => {
    // Persist the resolved source account on the template if it changed (debt).
    // Inside the transaction so it rolls back atomically with the payment.
    if (
      isDebtPaymentTemplate &&
      effectiveSourceAccountId &&
      effectiveSourceAccountId !== template.transfer_source_account_id
    ) {
      await db.runAsync(
        "UPDATE recurring_transaction_templates SET transfer_source_account_id = ?, updated_at = ? WHERE id = ?",
        [effectiveSourceAccountId, now, template.id]
      );
      await enqueueUpdate(
        db,
        "recurring_transaction_templates",
        template.id,
        { transfer_source_account_id: effectiveSourceAccountId, updated_at: now },
        now
      );
    }

    for (const leg of legs) {
      // PER-LEG idempotency: providerTransactionId uses occurrenceDate (NOT
      // paymentDate), so the key is stable regardless of when paid.
      const recurrenceIdentity = `${template.id}|${input.occurrenceDate}|${leg.accountId}|${leg.direction}`;
      const idempotencyKey = await computeIdempotencyKey({
        provider: "RECURRING_CHECKLIST",
        providerTransactionId: recurrenceIdentity,
        transactionDate: input.occurrenceDate,
        amount: leg.amount,
        rawDescription: leg.rawDescription,
      });

      const txPayload = buildLedgerTxPayload(
        {
          userId: template.user_id,
          accountId: leg.accountId,
          amount: leg.amount,
          currencyCode: template.currency_code,
          direction: leg.direction,
          transactionDate: effectivePaymentDate,
          rawDescription: leg.rawDescription,
          merchantName: leg.merchantName,
          categoryId: leg.categoryId,
          categorizationSource: leg.categoryId ? "USER_CREATED" : "SYSTEM_DEFAULT",
          notes: leg.notes,
          idempotencyKey,
          isRecurring: true,
          recurrenceGroupId,
        },
        now
      );

      const { inserted, id } = await insertLedgerTransaction(db, txPayload, now);
      if (!inserted) {
        alreadyRecorded++;
        continue;
      }
      created++;
      createdTxIds.push(id);
      createdLegs.push({ accountId: leg.accountId, amount: leg.amount, direction: leg.direction });
    }

    if (created > 0) {
      // Mark the matching occurrence paid (does NOT set linked_manually).
      const occPayload = {
        status: "paid",
        transaction_id: createdTxIds[0],
        paid_at: now,
      };
      if (input.occurrenceId) {
        // Caller supplied the occurrence id — key the UPDATE + sync row by it.
        // No template+date guess, no missing-row race.
        await db.runAsync(
          `UPDATE recurring_occurrences
             SET status = 'paid', transaction_id = ?, paid_at = ?
             WHERE id = ? AND status = 'pending'`,
          [createdTxIds[0], now, input.occurrenceId]
        );
        await enqueueUpdate(
          db,
          "recurring_occurrences",
          input.occurrenceId,
          occPayload,
          now
        );
      } else {
        // Fallback: template + date. If no local occurrence row exists yet
        // (not pulled), the UPDATE is a no-op — never enqueue a guessed row,
        // or Supabase would receive a stale UPDATE keyed by the wrong id.
        const res = await db.runAsync(
          `UPDATE recurring_occurrences
             SET status = 'paid', transaction_id = ?, paid_at = ?
             WHERE template_id = ? AND occurrence_date = ? AND status = 'pending'`,
          [createdTxIds[0], now, template.id, input.occurrenceDate]
        );
        if (res.changes === 0) {
          console.warn(
            `recordRecurringOccurrencePayment: no local pending occurrence for template ${template.id} @ ${input.occurrenceDate}; skipping occurrence sync enqueue (it will be reconciled on next pull).`
          );
        } else {
          const occRow = await db.getFirstAsync<{ id: string }>(
            `SELECT id FROM recurring_occurrences
               WHERE template_id = ? AND occurrence_date = ? LIMIT 1`,
            [template.id, input.occurrenceDate]
          );
          if (occRow) {
            await enqueueUpdate(
              db,
              "recurring_occurrences",
              occRow.id,
              occPayload,
              now
            );
          }
        }
      }

      // Copy template tags onto every created transaction (soft-fail). The
      // `recurring_template_tags` table may not exist on mobile yet (webapp-only
      // for now) — probe first so a missing table is a silent no-op rather than
      // a mid-transaction error that would roll back the whole payment.
      const tagTableExists = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recurring_template_tags'"
      );
      if (tagTableExists) {
        const tagRows = await db.getAllAsync<{ tag_id: string }>(
          "SELECT tag_id FROM recurring_template_tags WHERE recurring_template_id = ?",
          [template.id]
        );
        const tagIds = tagRows.map((r) => r.tag_id);
        if (tagIds.length > 0) {
          for (const txId of createdTxIds) {
            for (const tagId of tagIds) {
              await db.runAsync(
                "INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)",
                [txId, tagId]
              );
            }
            await db.runAsync(
              `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
               VALUES ('transaction_tags', ?, 'REPLACE', ?, ?)`,
              [
                txId,
                JSON.stringify({
                  transaction_id: txId,
                  tag_ids: tagIds,
                  // transaction_tags has a NOT-NULL user_id (webapp inserts it).
                  user_id: template.user_id,
                }),
                now,
              ]
            );
          }
        }
      }
    }

    // Apply balance delta per CREATED leg only (skip dupes → no double debit).
    // accountMap rows are mutated by applyLocalBalanceDelta so a debt account
    // hit by both legs accumulates.
    for (const leg of createdLegs) {
      const account = accountMap.get(leg.accountId);
      if (!account) continue;
      const nextBalance = await applyLocalBalanceDelta(
        db,
        account,
        leg.direction,
        leg.amount,
        template.currency_code,
        now
      );
      // Payoff lifecycle: a debt that reached 0 stops generating cuotas.
      if (isDebtAccountType(account.account_type) && nextBalance <= 0) {
        await deactivateTemplatesForPaidOffAccountLocal(db, account.id, now);
      }
    }
  });

  return { success: true, created, alreadyRecorded };
}

/**
 * Local port of webapp `deactivateTemplatesForPaidOffAccount`: when a debt
 * account reaches 0, deactivate its active templates (is_active = 0,
 * end_date = today) and DELETE only its PENDING occurrences (paid/skipped stay
 * as history). Enqueues all changes for sync. Caller runs inside a transaction.
 */
async function deactivateTemplatesForPaidOffAccountLocal(
  db: Awaited<ReturnType<typeof getDatabase>>,
  accountId: string,
  now: string
): Promise<void> {
  // Colombia-timezone date for end_date, matching webapp (toColombiaDateString).
  // `now.slice(0,10)` would be UTC — wrong day late-evening in Colombia (UTC-5).
  const today = toColombiaDateString(new Date(now));
  const templates = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM recurring_transaction_templates WHERE account_id = ? AND is_active = 1",
    [accountId]
  );
  if (templates.length === 0) return;

  for (const t of templates) {
    await db.runAsync(
      "UPDATE recurring_transaction_templates SET is_active = 0, end_date = ?, updated_at = ? WHERE id = ?",
      [today, now, t.id]
    );
    await enqueueUpdate(
      db,
      "recurring_transaction_templates",
      t.id,
      { is_active: false, end_date: today, updated_at: now },
      now
    );

    const pendingOccs = await db.getAllAsync<{ id: string }>(
      "SELECT id FROM recurring_occurrences WHERE template_id = ? AND status = 'pending'",
      [t.id]
    );
    for (const occ of pendingOccs) {
      await db.runAsync("DELETE FROM recurring_occurrences WHERE id = ?", [occ.id]);
      await db.runAsync(
        `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
         VALUES ('recurring_occurrences', ?, 'DELETE', ?, ?)`,
        [occ.id, JSON.stringify({ id: occ.id }), now]
      );
    }
  }
}
