"use server";

import "server-only";
import { updateTag, cacheTag, cacheLife } from "next/cache";
import { addDays, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { toColombiaDateString } from "@/lib/utils/date";
import { PAY_CYCLE_LOOKAHEAD_DAYS } from "@/lib/constants/occurrences";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { isDebtAccountType, reverseAccountBalanceDelta } from "@/lib/utils/account-balance";
import { applyDebtPaymentToBalances } from "@/lib/debt/payoff";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { getDebtPaymentCategoryId } from "@zeta/shared";
import { parseSubPayments } from "@/lib/utils/sub-payments";
import { UUID_RE } from "@/lib/validators/shared";
import {
  generateOccurrenceRowsBatch,
} from "@/lib/utils/occurrence-generator";
import type { ActionResult } from "@/types/actions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// ─── Match Score ──────────────────────────────────────────────────────────────

/**
 * Composite match score for ranking candidates.
 * Date proximity (weight 0.6) + amount proximity (weight 0.4).
 * Returns 0-1 where 1 = perfect match.
 */
function computeMatchScore(
  candidateDate: string,
  candidateAmount: number,
  referenceDate: string,
  referenceAmount: number,
): number {
  const cDate = parseISO(candidateDate);
  const rDate = parseISO(referenceDate);
  const daysDiff = Math.abs(
    Math.round((cDate.getTime() - rDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const dateScore = Math.max(0, 1 - daysDiff / 30);

  const amountDiff = Math.abs(candidateAmount - referenceAmount);
  const amountScore =
    referenceAmount > 0 ? Math.max(0, 1 - amountDiff / referenceAmount) : 0;

  return dateScore * 0.6 + amountScore * 0.4;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type OccurrenceStatus = "pending" | "paid" | "skipped";

export interface NextIncomeInfo {
  date: string;           // ISO date "YYYY-MM-DD"
  amount: number;         // Expected amount
  name: string;           // Merchant/description
  daysUntil: number;      // Days from today (1 = today or tomorrow)
}

import type { SubPayment } from "@/types/domain";

/** @deprecated Use SubPayment from @/types/domain */
export type OccurrenceSubPayment = SubPayment;

export interface RecurringOccurrence {
  id: string;
  template_id: string;
  occurrence_date: string;
  expected_amount: number;
  status: OccurrenceStatus;
  transaction_id: string | null;
  merchant_name: string | null;
  description: string | null;
  direction: "INFLOW" | "OUTFLOW";
  currency_code: string;
  account_id: string;
  account_name: string;
  account_type: string;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  transfer_source_account_id: string | null;
  sub_payments: OccurrenceSubPayment[] | null;
}

// ─── Select fragment for occurrence + joined template data ────────────────────

const OCCURRENCE_SELECT = `
  id,
  template_id,
  occurrence_date,
  expected_amount,
  status,
  transaction_id,
  template:recurring_transaction_templates!recurring_occurrences_template_id_fkey(
    merchant_name,
    description,
    direction,
    currency_code,
    is_active,
    account_id,
    transfer_source_account_id,
    sub_payments,
    account:accounts!recurring_transaction_templates_account_id_fkey(name, account_type),
    category:categories!recurring_transaction_templates_category_id_fkey(name_es, icon, color)
  )
`;

type RawOccurrenceRow = {
  id: string;
  template_id: string;
  occurrence_date: string;
  expected_amount: number;
  status: OccurrenceStatus;
  transaction_id: string | null;
  template: {
    merchant_name: string | null;
    description: string | null;
    direction: "INFLOW" | "OUTFLOW";
    currency_code: string;
    is_active: boolean;
    account_id: string;
    transfer_source_account_id: string | null;
    sub_payments: unknown;
    account: { name: string; account_type: string } | null;
    category: { name_es: string | null; icon: string | null; color: string | null } | null;
  } | null;
};

/** Minimal template shape for cross-account debt matching queries. */
type TemplateWithAccount = {
  account_id: string;
  direction: "INFLOW" | "OUTFLOW";
  transfer_source_account_id: string | null;
  account: { account_type: string } | null;
};

/** True when an OUTFLOW tx from a source account matches an INFLOW template on a debt account. */
function isCrossAccountDebtPayment(
  template: TemplateWithAccount,
  txDirection: "INFLOW" | "OUTFLOW",
  txAccountId: string,
): boolean {
  return (
    template.direction === "INFLOW" &&
    txDirection === "OUTFLOW" &&
    template.transfer_source_account_id === txAccountId &&
    template.account != null &&
    isDebtAccountType(template.account.account_type)
  );
}

function mapOccurrenceRow(row: RawOccurrenceRow): RecurringOccurrence | null {
  if (!row.template || !row.template.account) return null;
  return {
    id: row.id,
    template_id: row.template_id,
    occurrence_date: row.occurrence_date,
    expected_amount: row.expected_amount,
    status: row.status,
    transaction_id: row.transaction_id,
    merchant_name: row.template.merchant_name,
    description: row.template.description,
    direction: row.template.direction,
    currency_code: row.template.currency_code,
    account_id: row.template.account_id,
    account_name: row.template.account.name,
    account_type: row.template.account.account_type,
    category_name: row.template.category?.name_es ?? null,
    category_icon: row.template.category?.icon ?? null,
    category_color: row.template.category?.color ?? null,
    transfer_source_account_id: row.template.transfer_source_account_id,
    sub_payments: parseSubPayments(row.template.sub_payments),
  };
}

// ─── Cached inner functions ───────────────────────────────────────────────────

async function getOccurrencesForMonthCached(
  userId: string,
  month: string,
  accessToken: string,
): Promise<RecurringOccurrence[]> {
  "use cache";
  cacheTag("occurrences");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const monthStart = `${month}-01`;
  const monthDate = parseISO(`${month}-01`);
  const monthEnd = endOfMonth(monthDate).toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select(OCCURRENCE_SELECT)
    .eq("user_id", userId)
    .gte("occurrence_date", monthStart)
    .lte("occurrence_date", monthEnd)
    .order("occurrence_date");

  if (error) throw error;

  return (data ?? [])
    .map((row) => mapOccurrenceRow(row as RawOccurrenceRow))
    .filter((r): r is RecurringOccurrence => r !== null);
}

export async function getPendingOccurrencesCached(
  userId: string,
  rangeStart: string,
  rangeEnd: string,
  accessToken: string,
): Promise<RecurringOccurrence[]> {
  "use cache";
  cacheTag("occurrences");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select(OCCURRENCE_SELECT)
    .eq("user_id", userId)
    .eq("status", "pending")
    .gte("occurrence_date", rangeStart)
    .lte("occurrence_date", rangeEnd)
    .order("occurrence_date");

  if (error) throw error;

  // Filter out occurrences for paused templates (is_active = false)
  return (data ?? [])
    .filter((row) => (row as RawOccurrenceRow).template?.is_active !== false)
    .map((row) => mapOccurrenceRow(row as RawOccurrenceRow))
    .filter((r): r is RecurringOccurrence => r !== null);
}

// ─── Next income occurrence ──────────────────────────────────────────────────

export async function getNextIncomeOccurrenceCached(
  userId: string,
  todayStr: string,
  currency: string,
  accessToken: string,
): Promise<NextIncomeInfo | null> {
  "use cache";
  cacheTag("occurrences");
  cacheTag("recurring");
  cacheLife("zeta");

  const rangeEnd = toColombiaDateString(addDays(parseISO(todayStr + "T12:00:00"), PAY_CYCLE_LOOKAHEAD_DAYS));
  const occurrences = await getPendingOccurrencesCached(userId, todayStr, rangeEnd, accessToken);

  const match = occurrences.find(
    (o) =>
      o.direction === "INFLOW" &&
      o.currency_code === currency &&
      !isDebtAccountType(o.account_type),
  );
  if (!match) return null;

  const occDate = parseISO(match.occurrence_date);
  const today = parseISO(todayStr);
  const daysUntil = Math.max(
    1,
    Math.ceil((occDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return {
    date: match.occurrence_date,
    amount: match.expected_amount,
    name: match.merchant_name ?? match.description ?? "Ingreso",
    daysUntil,
  };
}

export async function getNextIncomeOccurrence(
  currency?: string,
): Promise<NextIncomeInfo | null> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return null;

  try {
    const now = new Date();
    await ensureOccurrencesForRange(
      startOfMonth(now),
      addDays(now, PAY_CYCLE_LOOKAHEAD_DAYS),
    );

    const todayStr = toColombiaDateString(now);
    return getNextIncomeOccurrenceCached(user.id, todayStr, currency ?? "COP", accessToken);
  } catch (error) {
    console.error("Error loading next income occurrence:", error);
    return null;
  }
}

/**
 * True iff a recurring_occurrences row already points to this transaction.
 * Used by the "Hacer recurrente" CTA to hide itself when the tx is already
 * promoted. Not cached — runs once per detail-page render inside Suspense.
 */
export async function isTransactionLinkedToOccurrence(
  transactionId: string,
): Promise<boolean> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return false;

  const { data } = await supabase
    .from("recurring_occurrences")
    .select("id")
    .eq("transaction_id", transactionId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return !!data;
}

export interface LinkedRecurringInfo {
  occurrenceId: string;
  occurrenceDate: string;
  templateId: string;
  templateMerchant: string;
  expectedAmount: number;
  currencyCode: string;
}

/**
 * Returns the recurring template/occurrence linked to this transaction, if any.
 * Used by transaction detail and row badges to navigate the user to the source.
 */
async function getLinkedRecurringForTransactionCached(
  userId: string,
  transactionId: string,
  accessToken: string,
): Promise<LinkedRecurringInfo | null> {
  "use cache";
  cacheTag("occurrences");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data } = await supabase
    .from("recurring_occurrences")
    .select(`
      id, occurrence_date, template_id, expected_amount,
      template:recurring_transaction_templates!recurring_occurrences_template_id_fkey(
        merchant_name, description, currency_code
      )
    `)
    .eq("transaction_id", transactionId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const t = data.template as {
    merchant_name: string | null;
    description: string | null;
    currency_code: string;
  } | null;
  if (!t) return null;

  return {
    occurrenceId: data.id,
    occurrenceDate: data.occurrence_date,
    templateId: data.template_id,
    templateMerchant: t.merchant_name ?? t.description ?? "Recurrente",
    expectedAmount: data.expected_amount,
    currencyCode: t.currency_code,
  };
}

export async function getLinkedRecurringForTransaction(
  transactionId: string,
): Promise<LinkedRecurringInfo | null> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return null;
  if (!UUID_RE.test(transactionId)) return null;
  return getLinkedRecurringForTransactionCached(user.id, transactionId, accessToken);
}

// ─── Public actions ───────────────────────────────────────────────────────────

/**
 * Idempotently generate occurrence rows for all active templates within a
 * date range. Uses ON CONFLICT DO NOTHING so existing statuses are preserved.
 */
export async function ensureOccurrencesForRange(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Fetch active templates — only the fields needed for generation
  const { data: templates, error: templatesError } = await supabase
    .from("recurring_transaction_templates")
    .select("id, user_id, amount, start_date, frequency, end_date, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (templatesError) return { success: false, error: templatesError.message };
  if (!templates || templates.length === 0) {
    return { success: true, data: undefined };
  }

  const rows = generateOccurrenceRowsBatch(
    templates as Array<{
      id: string;
      user_id: string;
      amount: number;
      start_date: string;
      frequency: import("@zeta/shared").RecurrenceFrequency;
      end_date: string | null;
      is_active: boolean;
    }>,
    rangeStart,
    rangeEnd,
  );

  if (rows.length === 0) return { success: true, data: undefined };

  // Month-level idempotency for MONTHLY templates: the unique constraint is on
  // (template_id, occurrence_date), so a day_of_month change (e.g. a statement
  // import updating the due day) would otherwise create a SECOND occurrence in
  // a month that already has one. One obligation = one needed payment per month.
  const monthlyIds = new Set(
    templates.filter((t) => t.frequency === "MONTHLY").map((t) => t.id)
  );
  let rowsToInsert = rows;
  if (monthlyIds.size > 0) {
    const monthStart = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, "0")}-01`;
    // Bound to the generated range's months — an unbounded scan over all
    // future occurrences can exceed PostgREST's max_rows (1000) and silently
    // truncate, re-enabling same-month duplicates for heavy users.
    const afterRange = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth() + 1, 1);
    const afterRangeStr = `${afterRange.getFullYear()}-${String(afterRange.getMonth() + 1).padStart(2, "0")}-01`;
    const { data: existing, error: existingError } = await supabase
      .from("recurring_occurrences")
      .select("template_id, occurrence_date")
      .eq("user_id", user.id)
      .in("template_id", [...monthlyIds])
      .gte("occurrence_date", monthStart)
      .lt("occurrence_date", afterRangeStr);
    if (existingError) return { success: false, error: existingError.message };

    const existingMonths = new Set(
      (existing ?? []).map((o) => `${o.template_id}|${o.occurrence_date.slice(0, 7)}`)
    );
    rowsToInsert = rows.filter(
      (r) =>
        !monthlyIds.has(r.template_id) ||
        !existingMonths.has(`${r.template_id}|${r.occurrence_date.slice(0, 7)}`)
    );
  }

  if (rowsToInsert.length === 0) return { success: true, data: undefined };

  const { error: upsertError } = await supabase
    .from("recurring_occurrences")
    .upsert(rowsToInsert, { onConflict: "template_id,occurrence_date", ignoreDuplicates: true });

  if (upsertError) {
    console.error(
      `[ensureOccurrencesForRange] upsert failed for user=${user.id} generated=${rowsToInsert.length}:`,
      upsertError.message,
    );
    return { success: false, error: upsertError.message };
  }

  return { success: true, data: undefined };
}

/**
 * Convenience wrapper — ensures occurrences for the current month + 14 days ahead.
 */
export async function ensureCurrentOccurrences(): Promise<ActionResult> {
  const now = new Date();
  const rangeStart = startOfMonth(now);
  const rangeEnd = addDays(endOfMonth(now), 14);
  return ensureOccurrencesForRange(rangeStart, rangeEnd);
}

/**
 * Align `expected_amount` on every *pending* occurrence of a template to a new
 * amount. Use after the template's amount changes (PDF import or manual edit):
 * `ensureCurrentOccurrences()` uses `ON CONFLICT DO NOTHING`, so an
 * already-generated pending occurrence would otherwise keep a stale amount and
 * diverge from the template. `paid`/`skipped` rows are historical — left as-is.
 */
export async function syncPendingOccurrenceAmounts(
  supabase: SupabaseClient<Database>,
  userId: string,
  templateId: string,
  amount: number,
): Promise<void> {
  const { error } = await supabase
    .from("recurring_occurrences")
    .update({ expected_amount: amount })
    .eq("user_id", userId)
    .eq("template_id", templateId)
    .eq("status", "pending");
  if (error) {
    console.error("syncPendingOccurrenceAmounts error:", error.message);
  }
}

/**
 * Get all occurrences for a given month (YYYY-MM). Defaults to current month.
 */
export async function getOccurrencesForMonth(
  month?: string,
): Promise<ActionResult<RecurringOccurrence[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  const targetMonth =
    month ?? new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    const data = await getOccurrencesForMonthCached(user.id, targetMonth, accessToken);
    return { success: true, data };
  } catch (error) {
    const err = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error(
      "Error loading occurrences:",
      err?.message ?? String(error),
      { code: err?.code, details: err?.details, hint: err?.hint },
    );
    return { success: false, error: "Error al cargar las ocurrencias recurrentes" };
  }
}

/**
 * Get pending occurrences within the next N days, optionally filtered by currency.
 */
export async function getPendingOccurrences(
  daysAhead: number = 30,
  currency?: string,
): Promise<ActionResult<RecurringOccurrence[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  const today = new Date();
  const rangeStart = toColombiaDateString(today);
  const rangeEnd = toColombiaDateString(addDays(today, daysAhead));

  try {
    let data = await getPendingOccurrencesCached(user.id, rangeStart, rangeEnd, accessToken);
    if (currency) {
      data = data.filter((o) => o.currency_code === currency);
    }
    return { success: true, data };
  } catch (error) {
    console.error("Error loading pending occurrences:", error);
    return { success: false, error: "Error al cargar las ocurrencias pendientes" };
  }
}

/**
 * If the template has frequency ONCE, deactivate it after its occurrence is resolved.
 */
/**
 * Deactivate a ONCE template after its occurrence is resolved.
 * Accepts frequency directly to avoid an extra DB read.
 */
async function deactivateOnceTemplate(
  supabase: Awaited<ReturnType<typeof getAuthenticatedClient>>["supabase"],
  templateId: string,
  userId: string,
) {
  const { error: deactivateErr } = await supabase
    .from("recurring_transaction_templates")
    .update({ is_active: false })
    .eq("id", templateId)
    .eq("user_id", userId);

  if (deactivateErr) console.error("Failed to deactivate ONCE template:", deactivateErr.message);
  updateTag("recurring");
}

/**
 * Mark an occurrence as paid and link it to a pre-existing transaction (auto-link path).
 * Only transitions from 'pending'.
 *
 * Stamps `recurrence_group_id` on the transaction so the "Vincular" button hides,
 * and sets `linked_manually = true` on the occurrence so revertOccurrence unlinks
 * the imported/manual transaction instead of deleting it.
 */
export async function markOccurrencePaid(
  occurrenceId: string,
  transactionId: string,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (!UUID_RE.test(occurrenceId) || !UUID_RE.test(transactionId)) {
    return { success: false, error: "ID inválido" };
  }

  const { data: occurrence, error } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "paid",
      transaction_id: transactionId,
      paid_at: new Date().toISOString(),
      linked_manually: true,
    })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("template_id, occurrence_date, template:recurring_transaction_templates!recurring_occurrences_template_id_fkey(frequency, category_id)")
    .single();

  if (error) return { success: false, error: error.message };

  // Stamp recurrence_group_id on the linked transaction so visibility predicates
  // (movimientos / inicio "Vincular" button) correctly hide it. Use the same
  // deterministic UUID scheme as linkExistingTransactionToOccurrence so both
  // paths share group identity.
  if (occurrence?.template_id && occurrence?.occurrence_date) {
    const { computeRecurringGroupUuid } = await import("@/actions/recurring-templates");
    const recurrenceGroupId = await computeRecurringGroupUuid(
      occurrence.template_id,
      occurrence.occurrence_date,
    );
    const template = occurrence.template as { frequency: string; category_id: string | null } | null;

    // Read existing tx to decide if we should backfill the category
    const { data: tx } = await supabase
      .from("transactions")
      .select("category_id")
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .single();

    const update: Record<string, unknown> = { recurrence_group_id: recurrenceGroupId };
    if (tx && !tx.category_id && template?.category_id) {
      update.category_id = template.category_id;
      update.categorization_source = "RECURRING_TEMPLATE";
    }

    const { error: txUpdateErr } = await supabase
      .from("transactions")
      .update(update)
      .eq("id", transactionId)
      .eq("user_id", user.id);
    if (txUpdateErr) {
      console.error("[markOccurrencePaid] tx group stamp failed:", txUpdateErr.message);
    }
  }

  // Auto-deactivate ONCE templates after their single occurrence is resolved
  const freq = (occurrence?.template as { frequency: string } | null)?.frequency;
  if (freq === "ONCE" && occurrence?.template_id) {
    await deactivateOnceTemplate(supabase, occurrence.template_id, user.id);
  }

  revalidateFinancialViews();
  updateTag("cashflow-planner");
  return { success: true, data: undefined };
}

/**
 * Skip a pending occurrence.
 * Only transitions from 'pending'.
 */
export async function skipOccurrence(occurrenceId: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (!UUID_RE.test(occurrenceId)) {
    return { success: false, error: "ID inválido" };
  }

  const { data: occurrence, error } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "skipped",
      skipped_at: new Date().toISOString(),
    })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("template_id, template:recurring_transaction_templates!recurring_occurrences_template_id_fkey(frequency)")
    .single();

  if (error) return { success: false, error: error.message };

  // Auto-deactivate ONCE templates after their single occurrence is resolved
  const freq = (occurrence?.template as { frequency: string } | null)?.frequency;
  if (freq === "ONCE" && occurrence?.template_id) {
    await deactivateOnceTemplate(supabase, occurrence.template_id, user.id);
  }

  revalidateFinancialViews();
  updateTag("occurrences");
  updateTag("cashflow-planner");
  return { success: true, data: undefined };
}

/**
 * Revert a completed occurrence (paid or skipped) back to pending.
 * For paid occurrences: deletes the created transaction(s) and reverses balance deltas.
 * For skipped occurrences: simply resets status.
 */
export async function revertOccurrence(occurrenceId: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (!UUID_RE.test(occurrenceId)) {
    return { success: false, error: "ID inválido" };
  }

  // Fetch occurrence with its current state
  const { data: occurrence, error: fetchError } = await supabase
    .from("recurring_occurrences")
    .select("id, status, transaction_id, template_id, occurrence_date, linked_manually")
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !occurrence) {
    return { success: false, error: "Ocurrencia no encontrada" };
  }

  if (occurrence.status === "pending") {
    return { success: false, error: "Esta ocurrencia ya está pendiente" };
  }

  // For paid occurrences with a linked transaction
  if (occurrence.status === "paid" && occurrence.transaction_id) {
    if (occurrence.linked_manually) {
      // Manual link: just clear recurrence_group_id — don't delete the transaction
      const { data: primaryTx } = await supabase
        .from("transactions")
        .select("recurrence_group_id")
        .eq("id", occurrence.transaction_id)
        .eq("user_id", user.id)
        .single();

      if (primaryTx?.recurrence_group_id) {
        const { error: unlinkErr } = await supabase
          .from("transactions")
          .update({ recurrence_group_id: null })
          .eq("recurrence_group_id", primaryTx.recurrence_group_id)
          .eq("user_id", user.id);
        if (unlinkErr) {
          return { success: false, error: `Error al desvincular transacción: ${unlinkErr.message}` };
        }
      }
    } else {
      // System-created: delete transactions and reverse balances
      const { data: primaryTx } = await supabase
        .from("transactions")
        .select("recurrence_group_id")
        .eq("id", occurrence.transaction_id)
        .eq("user_id", user.id)
        .single();

      if (primaryTx?.recurrence_group_id) {
        const { data: groupTxs } = await supabase
          .from("transactions")
          .select("id, amount, direction, account_id, accounts!transactions_account_id_fkey(account_type, current_balance)")
          .eq("recurrence_group_id", primaryTx.recurrence_group_id)
          .eq("user_id", user.id);

        const txIds = (groupTxs ?? []).map((tx) => tx.id);

        if (txIds.length > 0) {
          const { count: reconciledRefs } = await supabase
            .from("transactions")
            .select("id", { count: "exact", head: true })
            .in("reconciled_into_transaction_id", txIds)
            .eq("user_id", user.id);
          if (reconciledRefs && reconciledRefs > 0) {
            return { success: false, error: "No se puede revertir: hay una transacción importada vinculada a este pago." };
          }
        }

        const balanceResults = await Promise.all(
          (groupTxs ?? []).map((tx) => {
            const account = tx.accounts as { account_type: string; current_balance: number } | null;
            if (!account) return Promise.resolve(null);

            const newBalance = reverseAccountBalanceDelta({
              currentBalance: account.current_balance,
              accountType: account.account_type,
              direction: tx.direction as "INFLOW" | "OUTFLOW",
              amount: tx.amount,
            });

            return supabase
              .from("accounts")
              .update({ current_balance: newBalance })
              .eq("user_id", user.id)
              .eq("id", tx.account_id);
          })
        );

        const balanceError = balanceResults.find((r) => r && "error" in r && r.error);
        if (balanceError && "error" in balanceError && balanceError.error) {
          return { success: false, error: `Error al revertir saldo: ${balanceError.error.message}` };
        }

        const { error: deleteError } = await supabase
          .from("transactions")
          .delete()
          .eq("recurrence_group_id", primaryTx.recurrence_group_id)
          .eq("user_id", user.id);

        if (deleteError) {
          return { success: false, error: `Error al eliminar transacciones: ${deleteError.message}` };
        }
      }
    }
  }

  // Reset occurrence to pending
  const { error: updateError } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "pending",
      transaction_id: null,
      paid_at: null,
      skipped_at: null,
      linked_manually: false,
    })
    .eq("id", occurrenceId)
    .eq("user_id", user.id);

  if (updateError) return { success: false, error: updateError.message };

  // Re-activate ONCE templates so the reverted occurrence becomes visible
  if (occurrence.template_id) {
    const { data: tmpl } = await supabase
      .from("recurring_transaction_templates")
      .select("frequency, is_active")
      .eq("id", occurrence.template_id)
      .eq("user_id", user.id)
      .single();

    if (tmpl?.frequency === "ONCE" && !tmpl.is_active) {
      const { error: reactivateErr } = await supabase
        .from("recurring_transaction_templates")
        .update({ is_active: true })
        .eq("id", occurrence.template_id)
        .eq("user_id", user.id);

      if (reactivateErr) console.error("Failed to reactivate ONCE template:", reactivateErr.message);
    }
  }

  revalidateFinancialViews();
  updateTag("occurrences");
  updateTag("recurring");
  updateTag("cashflow-planner");
  return { success: true, data: undefined };
}

/**
 * Find a pending occurrence that matches the given account, date, direction,
 * and amount (within ±1% tolerance). Used by transaction creation paths to
 * auto-link a new transaction to its materialized occurrence.
 * Returns the occurrence ID or null if none found.
 */
export async function findMatchingOccurrence(
  accountId: string,
  transactionDate: string,
  amount: number,
  direction: "INFLOW" | "OUTFLOW",
  destinatarioId: string | null = null,
): Promise<string | null> {
  // Direct query — not cached. This runs on mutation paths (tx creation)
  // where fresh data is required to avoid double-linking in batch imports.
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return null;

  const baseDateObj = parseISO(transactionDate + "T12:00:00");
  const rangeStart = toColombiaDateString(addDays(baseDateObj, -3));
  const rangeEnd = toColombiaDateString(addDays(baseDateObj, 3));

  // Primary pass: if the transaction has a destinatario, try to match an
  // occurrence whose template is anchored to the same destinatario + account
  // + direction. Stronger signal than amount proximity alone, but a ±50%
  // tolerance still applies — the destinatario link says "this template
  // tracks this merchant", NOT "every tx to this merchant is this payment".
  // A 500k partial payment to a landlord should not silently auto-link to
  // a 2M rent occurrence. The wide band (vs 1% on the amount-only pass)
  // still absorbs realistic variance like fees, exchange rates, or partial
  // extra-principal prepayments.
  if (destinatarioId) {
    const { data: anchored, error: anchoredError } = await supabase
      .from("recurring_occurrences")
      .select(
        `id, occurrence_date, expected_amount,
         template:recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner(
           account_id, destinatario_id, direction, is_active
         )`
      )
      .eq("user_id", user.id)
      .eq("status", "pending")
      .eq("template.account_id", accountId)
      .eq("template.destinatario_id", destinatarioId)
      .eq("template.direction", direction)
      .eq("template.is_active", true)
      .gte("occurrence_date", rangeStart)
      .lte("occurrence_date", rangeEnd)
      .order("occurrence_date", { ascending: true });

    if (anchoredError) {
      // Log but don't abort — fall through to the amount-proximity pass so
      // a transient DB hiccup doesn't block legitimate matches.
      console.error("[findMatchingOccurrence] anchored query failed", anchoredError);
    }

    const ANCHORED_TOLERANCE = 0.5;
    const anchoredWithinTolerance = (anchored ?? []).filter(
      (row) =>
        row.expected_amount > 0 &&
        Math.abs(row.expected_amount - amount) / row.expected_amount <= ANCHORED_TOLERANCE,
    );

    if (anchoredWithinTolerance.length > 0) {
      // parseISO both sides for timezone consistency — baseDateObj was parsed
      // with an explicit noon offset, while occurrence_date is a bare YYYY-MM-DD
      // which `new Date()` would interpret as UTC midnight (off by hours in Colombia).
      const nearest = anchoredWithinTolerance.reduce((best, row) => {
        const bestDiff = Math.abs(
          parseISO(best.occurrence_date + "T12:00:00").getTime() - baseDateObj.getTime(),
        );
        const rowDiff = Math.abs(
          parseISO(row.occurrence_date + "T12:00:00").getTime() - baseDateObj.getTime(),
        );
        return rowDiff < bestDiff ? row : best;
      }, anchoredWithinTolerance[0]);
      return nearest.id;
    }
  }

  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select(
      `id, expected_amount,
       template:recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner(
         account_id, direction, is_active
       )`
    )
    .eq("user_id", user.id)
    .eq("status", "pending")
    .eq("template.account_id", accountId)
    .eq("template.direction", direction)
    .eq("template.is_active", true)
    .gte("occurrence_date", rangeStart)
    .lte("occurrence_date", rangeEnd);

  if (error || !data) return null;

  const tolerance = amount * 0.01;
  const match = data.find(
    (row) => Math.abs(row.expected_amount - amount) <= tolerance,
  );
  if (match) return match.id;

  // Secondary query: cross-account debt payment matching.
  // If this is an OUTFLOW from a source account, check if a debt payment template
  // has transfer_source_account_id pointing here.
  if (direction === "OUTFLOW") {
    const { data: crossData, error: crossErr } = await supabase
      .from("recurring_occurrences")
      .select(
        `id, expected_amount,
         template:recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner(
           account_id, transfer_source_account_id, direction, is_active,
           account:accounts!recurring_transaction_templates_account_id_fkey(account_type)
         )`
      )
      .eq("user_id", user.id)
      .eq("status", "pending")
      .eq("template.transfer_source_account_id", accountId)
      .eq("template.direction", "INFLOW")
      .eq("template.is_active", true)
      .gte("occurrence_date", rangeStart)
      .lte("occurrence_date", rangeEnd);

    if (!crossErr && crossData) {
      const crossMatch = crossData.find((row) => {
        const t = row.template as TemplateWithAccount | null;
        return (
          Math.abs(row.expected_amount - amount) <= tolerance &&
          t != null && isCrossAccountDebtPayment(t, direction, accountId)
        );
      });
      if (crossMatch) return crossMatch.id;
    }
  }

  return null;
}

/**
 * Convenience: find a matching pending occurrence and mark it paid.
 * Used by all transaction creation paths (FAB, email, PDF import).
 *
 * Also handles the "phantom-swap" race: if no PENDING occurrence matches but
 * a recently-paid system-created occurrence does (i.e. the user clicked
 * "Confirmar pago" before the bank-verified import arrived), the imported
 * transaction supersedes the phantom — the phantom tx is deleted (balance
 * reversed) and the occurrence is repointed at the imported transaction.
 */
export async function linkTransactionToOccurrence(
  accountId: string,
  transactionDate: string,
  amount: number,
  direction: "INFLOW" | "OUTFLOW",
  transactionId: string,
  destinatarioId: string | null = null,
  options: { skipDebtCompanionLeg?: boolean } = {},
): Promise<void> {
  const matchId = await findMatchingOccurrence(
    accountId,
    transactionDate,
    amount,
    direction,
    destinatarioId,
  );
  if (matchId) {
    await markOccurrencePaid(matchId, transactionId);
    // A debt-payment occurrence paid from another account (e.g. an email-
    // captured transfer) only registers the source OUTFLOW — without the
    // companion INFLOW the debt account's balance never moves. Statement
    // imports opt out: the card statement carries its own abono row.
    if (!options.skipDebtCompanionLeg) {
      await ensureDebtCompanionLeg({
        occurrenceId: matchId,
        sourceTransactionId: transactionId,
        sourceAccountId: accountId,
        transactionDate,
        amount,
        direction,
      });
    }
    return;
  }

  await swapPhantomOccurrenceIfMatched(
    accountId,
    transactionDate,
    amount,
    direction,
    transactionId,
  );
}

/**
 * Create the companion INFLOW on the debt account when a payment occurrence
 * is auto-linked to an OUTFLOW from another account (email ingest, manual
 * form). Mirrors leg B of the recurring-checklist flow: idempotent (key
 * derived from the source transaction), tier-3 capture, balances synced via
 * applyDebtPaymentToBalances. No-op for non-debt templates or same-account
 * payments.
 */
async function ensureDebtCompanionLeg(params: {
  occurrenceId: string;
  sourceTransactionId: string;
  sourceAccountId: string;
  transactionDate: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
}): Promise<void> {
  if (params.direction !== "OUTFLOW" || params.amount <= 0) return;

  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return;

  try {
    const { data: occurrence } = await supabase
      .from("recurring_occurrences")
      .select(
        `id,
         template:recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner(
           id, account_id, currency_code, merchant_name, description, category_id
         )`
      )
      .eq("id", params.occurrenceId)
      .eq("user_id", user.id)
      .single();

    const template = occurrence?.template as {
      id: string;
      account_id: string;
      currency_code: import("@/types/domain").CurrencyCode;
      merchant_name: string | null;
      description: string | null;
      category_id: string | null;
    } | null;
    if (!template || template.account_id === params.sourceAccountId) return;

    const [{ data: debtAccount }, { data: sourceAccount }, { data: sourceTx }] =
      await Promise.all([
        supabase
          .from("accounts")
          .select("id, name, account_type")
          .eq("user_id", user.id)
          .eq("id", template.account_id)
          .single(),
        supabase
          .from("accounts")
          .select("id, name")
          .eq("user_id", user.id)
          .eq("id", params.sourceAccountId)
          .single(),
        supabase
          .from("transactions")
          .select("recurrence_group_id")
          .eq("user_id", user.id)
          .eq("id", params.sourceTransactionId)
          .single(),
      ]);

    if (!debtAccount || !isDebtAccountType(debtAccount.account_type)) return;

    const label = template.merchant_name || template.description || "Pago recurrente";
    const rawDescription = `Abono deuda desde ${sourceAccount?.name ?? "cuenta"} - ${label}`;

    // Stable per source transaction: re-linking or retries hit 23505 → skip.
    const idempotencyKey = await computeIdempotencyKey({
      provider: "DEBT_COMPANION_LEG",
      providerTransactionId: params.sourceTransactionId,
      transactionDate: params.transactionDate,
      amount: params.amount,
      rawDescription,
    });

    const { error: insertError } = await supabase.from("transactions").insert({
      user_id: user.id,
      account_id: template.account_id,
      amount: params.amount,
      currency_code: template.currency_code,
      direction: "INFLOW",
      transaction_date: params.transactionDate,
      raw_description: rawDescription,
      clean_description: label,
      merchant_name: label,
      category_id:
        template.category_id ?? getDebtPaymentCategoryId(debtAccount.account_type),
      notes: "Abono de deuda generado automáticamente al vincular el pago",
      idempotency_key: idempotencyKey,
      provider: "MANUAL",
      status: "POSTED",
      capture_method: "MANUAL_FORM",
      is_recurring: true,
      recurrence_group_id: sourceTx?.recurrence_group_id ?? null,
      categorization_source: template.category_id ? "USER_CREATED" : "SYSTEM_DEFAULT",
    });

    if (insertError) {
      if (insertError.code !== "23505") {
        console.error("[ensureDebtCompanionLeg] insert failed", insertError.message);
      }
      return;
    }

    await applyDebtPaymentToBalances({
      supabase,
      userId: user.id,
      accountId: template.account_id,
      amount: params.amount,
      currencyCode: template.currency_code,
    });
  } catch (error) {
    // Linking must never fail the primary transaction insert.
    console.error("[ensureDebtCompanionLeg] failed", error);
  }
}

/**
 * Phantom-swap fallback for `linkTransactionToOccurrence`.
 *
 * If a recently-paid, system-created (linked_manually=false) occurrence exists
 * in the same account/direction window with a matching amount, replace its
 * phantom transaction with the just-inserted bank-verified one.
 *
 * Restricted to single-tx recurrence groups — multi-leg debt-payment phantoms
 * (CC inflow + source outflow) require human reconciliation.
 */
async function swapPhantomOccurrenceIfMatched(
  accountId: string,
  transactionDate: string,
  amount: number,
  direction: "INFLOW" | "OUTFLOW",
  newTransactionId: string,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return;

  const baseDateObj = parseISO(transactionDate + "T12:00:00");
  const rangeStart = toColombiaDateString(addDays(baseDateObj, -3));
  const rangeEnd = toColombiaDateString(addDays(baseDateObj, 3));

  const { data: candidates, error } = await supabase
    .from("recurring_occurrences")
    .select(
      `id, transaction_id, expected_amount,
       template:recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner(
         account_id, direction, is_active
       )`,
    )
    .eq("user_id", user.id)
    .eq("status", "paid")
    .eq("linked_manually", false)
    .eq("template.account_id", accountId)
    .eq("template.direction", direction)
    .eq("template.is_active", true)
    .gte("occurrence_date", rangeStart)
    .lte("occurrence_date", rangeEnd);

  if (error || !candidates) return;

  const tolerance = amount * 0.01;
  const match = candidates.find(
    (row) =>
      row.transaction_id != null &&
      Math.abs(row.expected_amount - amount) <= tolerance,
  );
  if (!match || !match.transaction_id) return;

  // Read phantom tx — must be a single-tx recurrence group to swap safely
  const { data: phantomTx } = await supabase
    .from("transactions")
    .select(
      "id, recurrence_group_id, amount, direction, account_id, accounts!transactions_account_id_fkey(account_type, current_balance)",
    )
    .eq("id", match.transaction_id)
    .eq("user_id", user.id)
    .single();

  if (!phantomTx || !phantomTx.recurrence_group_id) return;

  const { data: groupTxs } = await supabase
    .from("transactions")
    .select("id")
    .eq("recurrence_group_id", phantomTx.recurrence_group_id)
    .eq("user_id", user.id);

  if (!groupTxs || groupTxs.length !== 1) {
    // Multi-leg phantom (e.g. source OUTFLOW + debt companion INFLOW from
    // ensureDebtCompanionLeg) — a later bank-verified import of either leg
    // intentionally falls through to manual reconciliation instead of an
    // automatic swap.
    return;
  }

  // Order: delete phantom first, then reverse balance. If the delete fails the
  // balance is still correct; if the balance update fails after a successful
  // delete, the account will be off by the phantom amount but the row is gone —
  // recoverable via "recompute account balance". Without ACID transactions across
  // PostgREST calls, this ordering minimizes the window of inconsistency.
  const phantomAccount = phantomTx.accounts as
    | { account_type: string; current_balance: number }
    | null;

  const { error: delErr } = await supabase
    .from("transactions")
    .delete()
    .eq("id", phantomTx.id)
    .eq("user_id", user.id);
  if (delErr) {
    console.error("[swapPhantomOccurrence] phantom delete failed:", delErr.message);
    return;
  }

  if (phantomAccount) {
    const reversedBalance = reverseAccountBalanceDelta({
      currentBalance: phantomAccount.current_balance,
      accountType: phantomAccount.account_type,
      direction: phantomTx.direction as "INFLOW" | "OUTFLOW",
      amount: phantomTx.amount,
    });
    const { error: balErr } = await supabase
      .from("accounts")
      .update({ current_balance: reversedBalance })
      .eq("id", phantomTx.account_id)
      .eq("user_id", user.id);
    if (balErr) {
      console.error("[swapPhantomOccurrence] balance reverse failed after delete:", balErr.message);
      // Continue — phantom is gone, repoint the occurrence anyway so the user
      // sees the import as the canonical payment. Account balance can be
      // recomputed; leaving the orphan paid occurrence is worse UX.
    }
  }

  // Repoint the occurrence at the new tx, mark linked_manually so future
  // reverts unlink (don't delete) the bank-verified transaction.
  const { error: occErr } = await supabase
    .from("recurring_occurrences")
    .update({
      transaction_id: newTransactionId,
      linked_manually: true,
      paid_at: new Date().toISOString(),
    })
    .eq("id", match.id)
    .eq("user_id", user.id);
  if (occErr) {
    console.error("[swapPhantomOccurrence] occurrence repoint failed:", occErr.message);
  }

  // Stamp the new tx with the existing recurrence_group_id so the Vincular
  // button hides and downstream queries treat it as the canonical payment.
  const { error: txStampErr } = await supabase
    .from("transactions")
    .update({ recurrence_group_id: phantomTx.recurrence_group_id })
    .eq("id", newTransactionId)
    .eq("user_id", user.id);
  if (txStampErr) {
    console.error("[swapPhantomOccurrence] new tx group stamp failed:", txStampErr.message);
  }

  revalidateFinancialViews();
}

// ─── Manual Linking ───────────────────────────────────────────────────────────

/**
 * Manually link an existing transaction to a pending occurrence.
 * Unlike recordRecurringOccurrencePayment (which creates a new tx), this connects
 * an already-existing transaction. No balance changes — the tx already impacted balances.
 * Sets linked_manually=true so revertOccurrence knows to unlink instead of delete.
 */
export async function linkExistingTransactionToOccurrence(
  occurrenceId: string,
  transactionId: string,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (!UUID_RE.test(occurrenceId) || !UUID_RE.test(transactionId)) {
    return { success: false, error: "ID inválido" };
  }

  // Fetch occurrence — must be pending
  const { data: occurrence, error: occErr } = await supabase
    .from("recurring_occurrences")
    .select(`id, template_id, occurrence_date,
      template:recurring_transaction_templates!recurring_occurrences_template_id_fkey(
        account_id, direction, frequency, category_id, transfer_source_account_id,
        account:accounts!recurring_transaction_templates_account_id_fkey(account_type)
      )`)
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single();

  if (occErr || !occurrence) {
    return { success: false, error: "Ocurrencia no encontrada o ya no está pendiente" };
  }

  const template = occurrence.template as (TemplateWithAccount & { frequency: string; category_id: string | null }) | null;
  if (!template) return { success: false, error: "Plantilla no encontrada" };

  // Fetch transaction — must exist and match account + direction
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, account_id, direction, category_id")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();

  if (txErr || !tx) {
    return { success: false, error: "Transacción no encontrada" };
  }

  const directMatch = tx.account_id === template.account_id && tx.direction === template.direction;
  const crossAccountDebt = isCrossAccountDebtPayment(template, tx.direction as "INFLOW" | "OUTFLOW", tx.account_id);

  if (!directMatch && !crossAccountDebt) {
    return { success: false, error: "La transacción no coincide con la cuenta o dirección de la plantilla" };
  }

  // Compute recurrence_group_id for consistency with system-created payments
  const { computeRecurringGroupUuid } = await import("@/actions/recurring-templates");
  const recurrenceGroupId = await computeRecurringGroupUuid(
    occurrence.template_id,
    occurrence.occurrence_date,
  );

  // Stamp recurrence_group_id + enrich with template's category if tx has none
  const txEnrichment: Record<string, unknown> = { recurrence_group_id: recurrenceGroupId };
  if (!tx.category_id && template.category_id) {
    txEnrichment.category_id = template.category_id;
    txEnrichment.categorization_source = "RECURRING_TEMPLATE";
  }
  const { error: txUpdateErr } = await supabase
    .from("transactions")
    .update(txEnrichment)
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (txUpdateErr) {
    return { success: false, error: `Error al actualizar transacción: ${txUpdateErr.message}` };
  }

  // Mark occurrence as paid with linked_manually=true
  const { error: occUpdateErr } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "paid" as const,
      transaction_id: transactionId,
      paid_at: new Date().toISOString(),
      linked_manually: true,
    })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (occUpdateErr) {
    return { success: false, error: `Error al vincular: ${occUpdateErr.message}` };
  }

  // Auto-deactivate ONCE templates
  if (template.frequency === "ONCE") {
    await supabase
      .from("recurring_transaction_templates")
      .update({ is_active: false })
      .eq("id", occurrence.template_id)
      .eq("user_id", user.id);
  }

  revalidateFinancialViews();
  return { success: true, data: undefined };
}

// ─── Candidate Queries ────────────────────────────────────────────────────────

export interface CandidateTransaction {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  transaction_date: string;
  provider: string | null;
  matchScore: number;
}

/**
 * Fetch candidate transactions to link to a pending occurrence.
 * Pre-filtered: same account, same direction, ±30 days (or all if showAll=true).
 * Sorted by match score (date proximity 0.6 + amount proximity 0.4).
 */
export async function getCandidateTransactionsForOccurrence(
  occurrenceId: string,
  showAll = false,
): Promise<ActionResult<CandidateTransaction[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (!UUID_RE.test(occurrenceId)) {
    return { success: false, error: "ID inválido" };
  }

  const { data: occurrence, error: occErr } = await supabase
    .from("recurring_occurrences")
    .select(`id, occurrence_date, expected_amount,
      template:recurring_transaction_templates!recurring_occurrences_template_id_fkey(
        account_id, direction, transfer_source_account_id,
        account:accounts!recurring_transaction_templates_account_id_fkey(account_type)
      )`)
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single();

  if (occErr || !occurrence) {
    return { success: false, error: "Ocurrencia no encontrada" };
  }

  const template = occurrence.template as TemplateWithAccount | null;
  if (!template) return { success: false, error: "Plantilla no encontrada" };

  const isCrossAccountDebt = template.transfer_source_account_id &&
    isCrossAccountDebtPayment(template, "OUTFLOW", template.transfer_source_account_id);

  let query = supabase
    .from("transactions")
    .select("id, clean_description, merchant_name, raw_description, amount, currency_code, transaction_date, provider")
    .eq("user_id", user.id)
    .is("recurrence_group_id", null);

  if (isCrossAccountDebt) {
    query = query.or(
      `and(account_id.eq.${template.account_id},direction.eq.INFLOW),and(account_id.eq.${template.transfer_source_account_id},direction.eq.OUTFLOW)`
    );
  } else {
    query = query.eq("account_id", template.account_id).eq("direction", template.direction);
  }

  query = query
    .order("transaction_date", { ascending: false })
    .limit(50);

  if (!showAll) {
    const baseDateObj = parseISO(occurrence.occurrence_date + "T12:00:00");
    const rangeStart = toColombiaDateString(addDays(baseDateObj, -30));
    const rangeEnd = toColombiaDateString(addDays(baseDateObj, 30));
    query = query.gte("transaction_date", rangeStart).lte("transaction_date", rangeEnd);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  const candidates: CandidateTransaction[] = (data ?? []).map((tx) => ({
    id: tx.id,
    description: tx.clean_description ?? tx.merchant_name ?? tx.raw_description ?? "Sin descripción",
    amount: tx.amount,
    currency_code: tx.currency_code,
    transaction_date: tx.transaction_date,
    provider: tx.provider,
    matchScore: computeMatchScore(
      tx.transaction_date,
      tx.amount,
      occurrence.occurrence_date,
      occurrence.expected_amount,
    ),
  }));

  candidates.sort((a, b) => b.matchScore - a.matchScore);
  return { success: true, data: candidates };
}

export interface CandidateOccurrence {
  id: string;
  templateId: string;
  merchant: string;
  occurrenceDate: string;
  expectedAmount: number;
  currencyCode: string;
  matchScore: number;
  categoryIcon: string | null;
  categoryColor: string | null;
}

/**
 * Fetch candidate pending occurrences to link a transaction to.
 * Pre-filtered: same account, same direction, ±30 days.
 * Sorted by match score.
 */
export async function getCandidateOccurrencesForTransaction(
  transactionId: string,
): Promise<ActionResult<CandidateOccurrence[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (!UUID_RE.test(transactionId)) {
    return { success: false, error: "ID inválido" };
  }

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, account_id, direction, transaction_date, amount")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();

  if (txErr || !tx) {
    return { success: false, error: "Transacción no encontrada" };
  }

  const baseDateObj = parseISO(tx.transaction_date + "T12:00:00");
  const rangeStart = toColombiaDateString(addDays(baseDateObj, -30));
  const rangeEnd = toColombiaDateString(addDays(baseDateObj, 30));

  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select(`
      id, template_id, occurrence_date, expected_amount,
      template:recurring_transaction_templates!recurring_occurrences_template_id_fkey(
        merchant_name, description, direction, currency_code, account_id, transfer_source_account_id,
        account:accounts!recurring_transaction_templates_account_id_fkey(account_type),
        category:categories!recurring_transaction_templates_category_id_fkey(icon, color)
      )
    `)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .gte("occurrence_date", rangeStart)
    .lte("occurrence_date", rangeEnd);

  if (error) return { success: false, error: error.message };

  // Filter by account + direction (nested join filter not reliable in Supabase)
  const filtered = (data ?? []).filter((o) => {
    const t = o.template as TemplateWithAccount | null;
    if (!t) return false;
    if (t.account_id === tx.account_id && t.direction === tx.direction) return true;
    return isCrossAccountDebtPayment(t, tx.direction as "INFLOW" | "OUTFLOW", tx.account_id);
  });

  const candidates: CandidateOccurrence[] = filtered.map((o) => {
    const t = o.template as {
      merchant_name: string | null;
      description: string | null;
      currency_code: string;
      category: { icon: string | null; color: string | null } | null;
    };
    return {
      id: o.id,
      templateId: o.template_id,
      merchant: t.merchant_name ?? t.description ?? "Recurrente",
      occurrenceDate: o.occurrence_date,
      expectedAmount: o.expected_amount,
      currencyCode: t.currency_code,
      matchScore: computeMatchScore(
        tx.transaction_date,
        tx.amount,
        o.occurrence_date,
        o.expected_amount,
      ),
      categoryIcon: t.category?.icon ?? null,
      categoryColor: t.category?.color ?? null,
    };
  });

  candidates.sort((a, b) => b.matchScore - a.matchScore);
  return { success: true, data: candidates };
}

// ─── Visibility Helper ────────────────────────────────────────────────────────

/**
 * Returns account IDs that have at least one pending occurrence.
 * Used to conditionally show "Vincular a recurrente" on transaction rows.
 */
async function getAccountIdsWithPendingOccurrencesCached(
  userId: string,
  accessToken: string,
): Promise<string[]> {
  "use cache";
  cacheTag("occurrences");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data } = await supabase
    .from("recurring_occurrences")
    .select("template:recurring_transaction_templates!recurring_occurrences_template_id_fkey(account_id, transfer_source_account_id)")
    .eq("user_id", userId)
    .eq("status", "pending");

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const t = row.template as { account_id: string; transfer_source_account_id: string | null } | null;
    if (t) {
      ids.add(t.account_id);
      if (t.transfer_source_account_id) ids.add(t.transfer_source_account_id);
    }
  }
  return Array.from(ids);
}

export async function getAccountIdsWithPendingOccurrences(): Promise<string[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  return getAccountIdsWithPendingOccurrencesCached(user.id, accessToken);
}
