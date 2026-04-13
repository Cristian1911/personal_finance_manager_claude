"use server";

import "server-only";
import { revalidateTag, cacheTag, cacheLife } from "next/cache";
import { addDays, startOfMonth, endOfMonth } from "date-fns";
import { toColombiaDateString } from "@/lib/utils/date";
import { PAY_CYCLE_LOOKAHEAD_DAYS } from "@/lib/constants/occurrences";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
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

  return (data ?? [])
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

  const supabase = createCachedClient(accessToken);

  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select(`
      occurrence_date,
      expected_amount,
      recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner (
        merchant_name,
        description,
        direction,
        currency_code,
        accounts!recurring_transaction_templates_account_id_fkey (
          account_type
        )
      )
    `)
    .eq("user_id", userId)
    .eq("status", "pending")
    .gte("occurrence_date", todayStr)
    .order("occurrence_date", { ascending: true })
    .limit(50);

  if (error || !data || data.length === 0) return null;

  for (const row of data) {
    const tpl = row.recurring_transaction_templates as {
      merchant_name: string | null;
      description: string | null;
      direction: string;
      currency_code: string;
      accounts: { account_type: string } | null;
    };
    if (tpl.direction !== "INFLOW") continue;
    if (tpl.currency_code !== currency) continue;
    const acctType = tpl.accounts?.account_type;
    if (acctType === "CREDIT_CARD" || acctType === "LOAN") continue;

    const occDate = new Date(row.occurrence_date + "T12:00:00");
    const today = new Date(todayStr + "T12:00:00");
    const daysUntil = Math.max(
      1,
      Math.ceil((occDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    );

    return {
      date: row.occurrence_date,
      amount: row.expected_amount,
      name: tpl.merchant_name ?? tpl.description ?? "Ingreso",
      daysUntil,
    };
  }

  return null;
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
  const rangeStart = today.toISOString().split("T")[0];
  const rangeEnd = addDays(today, daysAhead).toISOString().split("T")[0];

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
 * Mark an occurrence as paid and link it to the created transaction.
 * Only transitions from 'pending'.
 */
export async function markOccurrencePaid(
  occurrenceId: string,
  transactionId: string,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "paid",
      transaction_id: transactionId,
      paid_at: new Date().toISOString(),
    })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) return { success: false, error: error.message };

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

  const { error } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "skipped",
      skipped_at: new Date().toISOString(),
    })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) return { success: false, error: error.message };

  revalidateFinancialViews();
  revalidateTag("occurrences", "zeta");
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
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return null;

  // Look within ±3 days of the transaction date to account for payment timing
  const baseDateObj = new Date(`${transactionDate}T12:00:00`);
  const windowStart = addDays(baseDateObj, -3).toISOString().split("T")[0];
  const windowEnd = addDays(baseDateObj, 3).toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select(
      `id, expected_amount,
       template:recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner(
         account_id, direction
       )`
    )
    .eq("user_id", user.id)
    .eq("status", "pending")
    .eq("template.account_id", accountId)
    .eq("template.direction", direction)
    .gte("occurrence_date", windowStart)
    .lte("occurrence_date", windowEnd);

  if (error || !data) return null;

  // Match by amount (1% tolerance)
  const tolerance = amount * 0.01;
  for (const row of data) {
    if (Math.abs(row.expected_amount - amount) <= tolerance) {
      return row.id;
    }
  }

  return null;
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
