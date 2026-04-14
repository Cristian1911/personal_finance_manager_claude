"use server";

import "server-only";
import { revalidateTag, cacheTag, cacheLife } from "next/cache";
import { addDays, startOfMonth, endOfMonth } from "date-fns";
import { toColombiaDateString } from "@/lib/utils/date";
import { PAY_CYCLE_LOOKAHEAD_DAYS } from "@/lib/constants/occurrences";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { isDebtAccountType, reverseAccountBalanceDelta } from "@/lib/utils/account-balance";
import { UUID_RE } from "@/lib/validators/shared";
import {
  generateOccurrenceRowsBatch,
} from "@/lib/utils/occurrence-generator";
import type { ActionResult } from "@/types/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OccurrenceStatus = "pending" | "paid" | "skipped";

export interface NextIncomeInfo {
  date: string;           // ISO date "YYYY-MM-DD"
  amount: number;         // Expected amount
  name: string;           // Merchant/description
  daysUntil: number;      // Days from today (1 = today or tomorrow)
}

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
    account: { name: string; account_type: string } | null;
    category: { name_es: string | null; icon: string | null; color: string | null } | null;
  } | null;
};

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
  const monthDate = new Date(`${month}-01T12:00:00`);
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

  const rangeEnd = toColombiaDateString(addDays(new Date(todayStr + "T12:00:00"), PAY_CYCLE_LOOKAHEAD_DAYS));
  const occurrences = await getPendingOccurrencesCached(userId, todayStr, rangeEnd, accessToken);

  const match = occurrences.find(
    (o) =>
      o.direction === "INFLOW" &&
      o.currency_code === currency &&
      !isDebtAccountType(o.account_type),
  );
  if (!match) return null;

  const occDate = new Date(match.occurrence_date + "T12:00:00");
  const today = new Date(todayStr + "T12:00:00");
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

  const { error: upsertError } = await supabase
    .from("recurring_occurrences")
    .upsert(rows, { onConflict: "template_id,occurrence_date", ignoreDuplicates: true });

  if (upsertError) return { success: false, error: upsertError.message };

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
    console.error("Error loading occurrences:", error);
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
async function deactivateOnceTemplateIfNeeded(
  supabase: Awaited<ReturnType<typeof getAuthenticatedClient>>["supabase"],
  templateId: string,
  userId: string,
) {
  const { data: tmpl } = await supabase
    .from("recurring_transaction_templates")
    .select("frequency")
    .eq("id", templateId)
    .eq("user_id", userId)
    .single();

  if (tmpl?.frequency === "ONCE") {
    await supabase
      .from("recurring_transaction_templates")
      .update({ is_active: false })
      .eq("id", templateId)
      .eq("user_id", userId);

    revalidateTag("recurring", "zeta");
  }
}

/**
 * Mark an occurrence as paid and link it to the created transaction.
 * Only transitions from 'pending'.
 */
export async function markOccurrencePaid(
  occurrenceId: string,
  transactionId: string,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: occurrence, error } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "paid",
      transaction_id: transactionId,
      paid_at: new Date().toISOString(),
    })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("template_id")
    .single();

  if (error) return { success: false, error: error.message };

  // Auto-deactivate ONCE templates after their single occurrence is resolved
  if (occurrence?.template_id) {
    await deactivateOnceTemplateIfNeeded(supabase, occurrence.template_id, user.id);
  }

  revalidateFinancialViews();
  revalidateTag("occurrences", "zeta");
  return { success: true, data: undefined };
}

/**
 * Skip a pending occurrence.
 * Only transitions from 'pending'.
 */
export async function skipOccurrence(occurrenceId: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: occurrence, error } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "skipped",
      skipped_at: new Date().toISOString(),
    })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("template_id")
    .single();

  if (error) return { success: false, error: error.message };

  // Auto-deactivate ONCE templates after their single occurrence is resolved
  if (occurrence?.template_id) {
    await deactivateOnceTemplateIfNeeded(supabase, occurrence.template_id, user.id);
  }

  revalidateFinancialViews();
  revalidateTag("occurrences", "zeta");
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
    .select("id, status, transaction_id, template_id, occurrence_date")
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !occurrence) {
    return { success: false, error: "Ocurrencia no encontrada" };
  }

  if (occurrence.status === "pending") {
    return { success: false, error: "Esta ocurrencia ya está pendiente" };
  }

  // For paid occurrences: delete created transactions and reverse balances
  if (occurrence.status === "paid" && occurrence.transaction_id) {
    // Single query: get recurrence_group_id via FK join (avoids extra round trip)
    const { data: primaryTx } = await supabase
      .from("transactions")
      .select("recurrence_group_id")
      .eq("id", occurrence.transaction_id)
      .eq("user_id", user.id)
      .single();

    if (primaryTx?.recurrence_group_id) {
      // Get all transactions in the group
      const { data: groupTxs } = await supabase
        .from("transactions")
        .select("id, amount, direction, account_id, accounts!transactions_account_id_fkey(account_type, current_balance)")
        .eq("recurrence_group_id", primaryTx.recurrence_group_id)
        .eq("user_id", user.id);

      const txIds = (groupTxs ?? []).map((tx) => tx.id);

      // Guard: block revert if any transaction was reconciled into by another
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

      // Reverse balance deltas in parallel — safe because each tx in a
      // recurrence group targets a different account (source ≠ destination)
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

      // Delete all transactions in the recurrence group
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

  // Reset occurrence to pending
  const { error: updateError } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "pending",
      transaction_id: null,
      paid_at: null,
      skipped_at: null,
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
      await supabase
        .from("recurring_transaction_templates")
        .update({ is_active: true })
        .eq("id", occurrence.template_id)
        .eq("user_id", user.id);
    }
  }

  revalidateFinancialViews();
  revalidateTag("occurrences", "zeta");
  revalidateTag("recurring", "zeta");
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
): Promise<string | null> {
  // Direct query — not cached. This runs on mutation paths (tx creation)
  // where fresh data is required to avoid double-linking in batch imports.
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return null;

  const baseDateObj = new Date(`${transactionDate}T12:00:00`);
  const rangeStart = toColombiaDateString(addDays(baseDateObj, -3));
  const rangeEnd = toColombiaDateString(addDays(baseDateObj, 3));

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
  return match?.id ?? null;
}

/**
 * Convenience: find a matching pending occurrence and mark it paid.
 * Used by all transaction creation paths (FAB, email, PDF import).
 */
export async function linkTransactionToOccurrence(
  accountId: string,
  transactionDate: string,
  amount: number,
  direction: "INFLOW" | "OUTFLOW",
  transactionId: string,
): Promise<void> {
  const matchId = await findMatchingOccurrence(accountId, transactionDate, amount, direction);
  if (matchId) {
    await markOccurrencePaid(matchId, transactionId);
  }
}
