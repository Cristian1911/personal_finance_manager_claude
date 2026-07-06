"use server";

import { updateTag } from "next/cache";
import { addDays, parseISO } from "date-fns";
import { toColombiaDateString } from "@/lib/utils/date";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import {
  anchorStatementBalance,
  assignStatementOccurrenceIndexes,
  computeSnapshotDiffs,
  findReconciliationCandidates,
  isBankVerifiedCapture,
  mergeTransactionMetadata,
  occurrenceAmountMatches,
  validateStatementPeriodBalance,
  MANUAL_BALANCE_ADJUSTMENT_PREFIX,
  OCCURRENCE_AUTO_LINK_DAY_WINDOW,
  type AnchoredBalanceResult,
  type ReconciliationCandidate,
} from "@zeta/shared";
import type { TransactionCaptureMethod } from "@/types/domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { importPayloadSchema } from "@/lib/validators/import";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import type { ActionResult } from "@/types/actions";
import type {
  AccountUpdateResult,
  ImportResult,
  ReconciliationDecisionInput,
  ReconciliationPreviewItem,
  ReconciliationPreviewResult,
  StatementMetaForImport,
  TransactionToImport,
} from "@/types/import";
import { trackProductEvent } from "@/actions/product-events";
import { linkTransactionToOccurrence, ensureCurrentOccurrences } from "@/actions/occurrences";
import { syncPendingOccurrenceAmounts } from "@/lib/utils/occurrence-sync";
import { parseSubPayments as parseSubPaymentsShared } from "@/lib/utils/sub-payments";
import { applyAccountBalanceDelta } from "@/lib/utils/account-balance";
import { runSubscriptionDetection } from "@/actions/subscriptions";

type DebtKind = "credit_card" | "loan";
type CurrencyCode = Database["public"]["Enums"]["currency_code"];
type ImportedAccountRow = Pick<
  Database["public"]["Tables"]["accounts"]["Row"],
  "id" | "name" | "currency_code" | "currency_balances" | "account_type" | "is_payroll_deducted" | "current_balance"
>;
type StatementSnapshotSyncRow = Pick<
  Database["public"]["Tables"]["statement_snapshots"]["Row"],
  "period_to" | "payment_due_date"
>;
type RecurringTemplateSyncRow = Pick<
  Database["public"]["Tables"]["recurring_transaction_templates"]["Row"],
  | "id"
  | "account_id"
  | "amount"
  | "currency_code"
  | "merchant_name"
  | "description"
  | "direction"
  | "frequency"
  | "category_id"
  | "transfer_source_account_id"
  | "is_active"
  | "start_date"
  | "day_of_month"
  | "sub_payments"
>;

interface SubPaymentEntry {
  currency_code: string;
  amount: number;
}

const IMPORT_DETAIL_MESSAGES = {
  monthlyToAnnual: (
    accountId: string,
    label: string,
    monthlyRate: number,
    annualRate: number
  ) =>
    `Cuenta ${accountId}: ${label} ${monthlyRate}% parece M.V.; convertido a ${annualRate}% E.A.`,
  rateOutOfRange: (
    accountId: string,
    label: string,
    rate: number,
    minRate: number,
    maxRate: number
  ) =>
    `Cuenta ${accountId}: ${label} ${rate}% E.A. fuera de rango (${minRate}%-${maxRate}%). Se ignora.`,
  recurringTemplateCreated: (accountName: string, currency: string) =>
    `Se creo el recurrente de pago de ${accountName} (${currency}) desde el extracto.`,
  recurringTemplateUpdated: (accountName: string, currency: string) =>
    `Se actualizo el recurrente de pago de ${accountName} (${currency}) desde el extracto.`,
  recurringTemplateSyncFailed: (
    accountName: string,
    currency: string,
    message: string
  ) =>
    `No se pudo sincronizar el recurrente de pago de ${accountName} (${currency}): ${message}`,
} as const;

import { sanitizeInterestRate, mvToEaPercent, MV_THRESHOLD } from "@zeta/shared";

const RECURRING_TEMPLATE_SYNC_SELECT =
  "id, account_id, amount, currency_code, merchant_name, description, direction, frequency, category_id, transfer_source_account_id, is_active, start_date, day_of_month, sub_payments";

function sanitizeEaRate(
  rawRate: number | null | undefined,
  kind: DebtKind,
  details: string[],
  accountId: string,
  label: string
): number | null {
  if (rawRate == null || !Number.isFinite(rawRate) || rawRate <= 0) return null;

  // Log conversion if rate looks monthly
  const accountType = kind === "credit_card" ? "CREDIT_CARD" : "LOAN";
  const mvThreshold = MV_THRESHOLD[accountType];
  if (rawRate < mvThreshold) {
    const converted = mvToEaPercent(rawRate);
    details.push(IMPORT_DETAIL_MESSAGES.monthlyToAnnual(accountId, label, rawRate, converted));
  }

  // Delegate to shared sanitization (conversion + bounds check)
  const result = sanitizeInterestRate(rawRate, accountType);
  if (result === null && rawRate > 0) {
    details.push(
      IMPORT_DETAIL_MESSAGES.rateOutOfRange(accountId, label, rawRate, mvThreshold, 150)
    );
  }

  return result;
}

function parsePayload(formData: FormData) {
  const rawPayload = formData.get("payload") as string;
  try {
    const result = importPayloadSchema.safeParse(JSON.parse(rawPayload));
    if (!result.success) {
      console.error(
        "[importTransactions] payload validation failed:",
        JSON.stringify(result.error.issues, null, 2),
      );
    }
    return result;
  } catch (error) {
    console.error("Error parsing import payload:", error);
    return null;
  }
}

function buildDecisionKey(statementIndex: number, transactionIndex: number): string {
  return `${statementIndex}:${transactionIndex}`;
}

/** Template key is per-account (not per-currency). Multi-currency payments merge into one template. */
function buildRecurringTemplateKey(accountId: string): string {
  return accountId;
}

function parseSubPayments(raw: unknown): SubPaymentEntry[] {
  return parseSubPaymentsShared(raw) ?? [];
}

function upsertSubPayment(
  existing: SubPaymentEntry[],
  currencyCode: string,
  amount: number,
  primaryCurrency: string,
): SubPaymentEntry[] {
  const updated = existing.filter((e) => e.currency_code !== currencyCode);
  updated.push({ currency_code: currencyCode, amount });
  // Primary currency first, then alphabetical
  updated.sort((a, b) => {
    const aPrimary = a.currency_code === primaryCurrency ? 0 : 1;
    const bPrimary = b.currency_code === primaryCurrency ? 0 : 1;
    if (aPrimary !== bPrimary) return aPrimary - bPrimary;
    return a.currency_code.localeCompare(b.currency_code);
  });
  return updated;
}

/**
 * Get the primary-currency amount from sub_payments. Only the primary-currency
 * entry drives the template.amount (used for occurrence expected_amount and
 * findMatchingOccurrence tolerance). Non-primary entries are display-only metadata.
 *
 * Falls back to the existing template amount if the primary currency isn't
 * present in sub_payments (e.g., only a secondary currency statement was imported).
 */
function getPrimaryCurrencyAmount(
  subPayments: SubPaymentEntry[],
  primaryCurrency: string,
  existingAmount: number | null,
): number {
  const primary = subPayments.find((sp) => sp.currency_code === primaryCurrency);
  if (primary) return Math.round(primary.amount * 100) / 100;
  // If primary currency not yet imported, keep the existing amount.
  // Never fall back to a secondary-currency amount — that would store
  // e.g. a USD value as COP, producing a nonsensical template.amount.
  return (existingAmount != null && existingAmount > 0) ? existingAmount : 0;
}

function getDayOfMonth(date: string): number | null {
  const parts = date.split("-");
  if (parts.length !== 3) return null;
  const day = Number(parts[2]);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

function shouldSyncCreditCardRecurring(params: {
  prevSnapshot: StatementSnapshotSyncRow | null;
  periodTo: string | null;
  paymentDueDate: string;
}): boolean {
  const { prevSnapshot, periodTo, paymentDueDate } = params;
  if (!prevSnapshot) return true;

  if (prevSnapshot.period_to && periodTo) {
    return periodTo >= prevSnapshot.period_to;
  }

  if (prevSnapshot.payment_due_date) {
    return paymentDueDate >= prevSnapshot.payment_due_date;
  }

  return true;
}

function buildDebtPaymentMerchantName(accountName: string): string {
  return `Pago ${accountName}`;
}

async function syncCreditCardRecurringTemplate(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  meta: StatementMetaForImport;
  account?: ImportedAccountRow;
  prevSnapshot: StatementSnapshotSyncRow | null;
  existingTemplate?: RecurringTemplateSyncRow;
  templateMap: Map<string, RecurringTemplateSyncRow>;
  details: string[];
}): Promise<void> {
  const cc = params.meta.creditCardMetadata;
  if (!cc?.payment_due_date) return;
  // Only sync recurring when minimum_payment is explicitly present.
  // total_payment_due is the full balance — it changes monthly and
  // would mislead the budget/recurring view.
  if (cc.minimum_payment == null || !Number.isFinite(cc.minimum_payment) || cc.minimum_payment <= 0) {
    const accountName = params.account?.name ?? "tarjeta";
    params.details.push(
      `⚠️ ${accountName} (${params.meta.currency}): no se detectó pago mínimo en el extracto — el pago recurrente no fue actualizado.` +
      (cc.total_payment_due != null ? ` El total a pagar es ${cc.total_payment_due.toLocaleString("es-CO")}, pero no se usa como recurrente porque cambia cada mes.` : "")
    );
    return;
  }
  if (
    !shouldSyncCreditCardRecurring({
      prevSnapshot: params.prevSnapshot,
      periodTo: params.meta.periodTo,
      paymentDueDate: cc.payment_due_date,
    })
  ) {
    return;
  }

  const dayOfMonth = getDayOfMonth(cc.payment_due_date);
  if (!dayOfMonth) return;

  const accountName = params.account?.name ?? "tarjeta";
  const primaryCurrency = params.account?.currency_code ?? params.meta.currency;
  const templateKey = buildRecurringTemplateKey(params.meta.accountId);
  const merchantName =
    params.existingTemplate?.merchant_name?.trim() ||
    buildDebtPaymentMerchantName(accountName);
  const description = params.existingTemplate?.description?.trim() || null;
  const currencyAmount = Math.round(cc.minimum_payment * 100) / 100;

  // Build updated sub_payments by merging this currency's payment into existing ones
  const existingSubPayments = parseSubPayments(params.existingTemplate?.sub_payments);
  const updatedSubPayments = upsertSubPayment(existingSubPayments, params.meta.currency, currencyAmount, primaryCurrency);
  // template.amount = primary-currency minimum only (sub_payments is display metadata)
  const totalAmount = getPrimaryCurrencyAmount(
    updatedSubPayments,
    primaryCurrency,
    params.existingTemplate ? Number(params.existingTemplate.amount) : null,
  );

  try {
    if (params.existingTemplate) {
      const { data, error } = await params.supabase
        .from("recurring_transaction_templates")
        .update({
          amount: totalAmount,
          currency_code: primaryCurrency as CurrencyCode,
          merchant_name: merchantName,
          description,
          start_date: cc.payment_due_date,
          day_of_month: dayOfMonth,
          sub_payments: updatedSubPayments as unknown as Database["public"]["Tables"]["recurring_transaction_templates"]["Row"]["sub_payments"],
        })
        .eq("user_id", params.userId)
        .eq("id", params.existingTemplate.id)
        .select(RECURRING_TEMPLATE_SYNC_SELECT)
        .single();

      if (error) throw error;
      params.templateMap.set(templateKey, data as RecurringTemplateSyncRow);
      await syncPendingOccurrenceAmounts(
        params.supabase,
        params.userId,
        params.existingTemplate.id,
        totalAmount,
      );
      params.details.push(
        IMPORT_DETAIL_MESSAGES.recurringTemplateUpdated(accountName, params.meta.currency)
      );
      return;
    }

    const { data, error } = await params.supabase
      .from("recurring_transaction_templates")
      .insert({
        user_id: params.userId,
        account_id: params.meta.accountId,
        transfer_source_account_id: null,
        amount: totalAmount,
        currency_code: primaryCurrency as CurrencyCode,
        direction: "INFLOW",
        frequency: "MONTHLY",
        merchant_name: merchantName,
        description,
        category_id: null,
        day_of_month: dayOfMonth,
        day_of_week: null,
        start_date: cc.payment_due_date,
        end_date: null,
        sub_payments: updatedSubPayments as unknown as Database["public"]["Tables"]["recurring_transaction_templates"]["Row"]["sub_payments"],
      })
      .select(RECURRING_TEMPLATE_SYNC_SELECT)
      .single();

    if (error) throw error;
    params.templateMap.set(templateKey, data as RecurringTemplateSyncRow);
    params.details.push(
      IMPORT_DETAIL_MESSAGES.recurringTemplateCreated(accountName, params.meta.currency)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    params.details.push(
      IMPORT_DETAIL_MESSAGES.recurringTemplateSyncFailed(
        accountName,
        params.meta.currency,
        message
      )
    );
  }
}

async function syncLoanRecurringTemplate(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  meta: StatementMetaForImport;
  account?: ImportedAccountRow;
  prevSnapshot: StatementSnapshotSyncRow | null;
  existingTemplate?: RecurringTemplateSyncRow;
  templateMap: Map<string, RecurringTemplateSyncRow>;
  details: string[];
}): Promise<void> {
  const ln = params.meta.loanMetadata;
  if (!ln?.payment_due_date || ln.total_payment_due == null || ln.total_payment_due <= 0) return;

  // Skip if this statement is older than one we already processed
  if (params.prevSnapshot) {
    const prevDue = params.prevSnapshot.payment_due_date;
    if (prevDue && ln.payment_due_date < prevDue) return;
  }

  const dayOfMonth = getDayOfMonth(ln.payment_due_date);
  if (!dayOfMonth) return;

  const accountName = params.account?.name ?? "préstamo";
  const primaryCurrency = params.account?.currency_code ?? params.meta.currency;
  const templateKey = buildRecurringTemplateKey(params.meta.accountId);
  const merchantName =
    params.existingTemplate?.merchant_name?.trim() ||
    buildDebtPaymentMerchantName(accountName);
  const description = params.existingTemplate?.description?.trim() || null;
  // Prefer minimum_payment (for banks that provide it), fall back to total_payment_due
  const currencyAmount = Math.round((ln.minimum_payment ?? ln.total_payment_due) * 100) / 100;

  // Build updated sub_payments
  const existingSubPayments = parseSubPayments(params.existingTemplate?.sub_payments);
  const updatedSubPayments = upsertSubPayment(existingSubPayments, params.meta.currency, currencyAmount, primaryCurrency);
  // template.amount = primary-currency minimum only (sub_payments is display metadata)
  const totalAmount = getPrimaryCurrencyAmount(
    updatedSubPayments,
    primaryCurrency,
    params.existingTemplate ? Number(params.existingTemplate.amount) : null,
  );

  try {
    if (params.existingTemplate) {
      const { data, error } = await params.supabase
        .from("recurring_transaction_templates")
        .update({
          amount: totalAmount,
          currency_code: primaryCurrency as CurrencyCode,
          merchant_name: merchantName,
          description,
          start_date: ln.payment_due_date,
          day_of_month: dayOfMonth,
          sub_payments: updatedSubPayments as unknown as Database["public"]["Tables"]["recurring_transaction_templates"]["Row"]["sub_payments"],
        })
        .eq("user_id", params.userId)
        .eq("id", params.existingTemplate.id)
        .select(RECURRING_TEMPLATE_SYNC_SELECT)
        .single();

      if (error) throw error;
      params.templateMap.set(templateKey, data as RecurringTemplateSyncRow);
      await syncPendingOccurrenceAmounts(
        params.supabase,
        params.userId,
        params.existingTemplate.id,
        totalAmount,
      );
      params.details.push(
        IMPORT_DETAIL_MESSAGES.recurringTemplateUpdated(accountName, params.meta.currency)
      );
      return;
    }

    const { data, error } = await params.supabase
      .from("recurring_transaction_templates")
      .insert({
        user_id: params.userId,
        account_id: params.meta.accountId,
        transfer_source_account_id: null,
        amount: totalAmount,
        currency_code: primaryCurrency as CurrencyCode,
        direction: "INFLOW",
        frequency: "MONTHLY",
        merchant_name: merchantName,
        description,
        category_id: null,
        day_of_month: dayOfMonth,
        day_of_week: null,
        start_date: ln.payment_due_date,
        end_date: null,
        sub_payments: updatedSubPayments as unknown as Database["public"]["Tables"]["recurring_transaction_templates"]["Row"]["sub_payments"],
      })
      .select(RECURRING_TEMPLATE_SYNC_SELECT)
      .single();

    if (error) throw error;
    params.templateMap.set(templateKey, data as RecurringTemplateSyncRow);
    params.details.push(
      IMPORT_DETAIL_MESSAGES.recurringTemplateCreated(accountName, params.meta.currency)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    params.details.push(
      IMPORT_DETAIL_MESSAGES.recurringTemplateSyncFailed(
        accountName,
        params.meta.currency,
        message
      )
    );
  }
}

async function fetchReconciliationCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  transactions: TransactionToImport[]
): Promise<Map<string, ReconciliationCandidate[]>> {
  const accountIds = [...new Set(transactions.map((tx) => tx.account_id))];
  if (accountIds.length === 0) return new Map();

  // Widen the window by the scorer's ±3-day tolerance: a manual transaction
  // dated just outside the statement's edges (e.g. May 31 vs statement's
  // June 1 posting) must still surface as a duplicate candidate.
  const dateValues = transactions.map((tx) => tx.transaction_date).sort();
  const from = toColombiaDateString(addDays(parseISO(dateValues[0] + "T12:00:00"), -3));
  const to = toColombiaDateString(
    addDays(parseISO(dateValues[dateValues.length - 1] + "T12:00:00"), 3),
  );

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, user_id, account_id, amount, direction, transaction_date, raw_description, merchant_name, clean_description, category_id, categorization_source, notes, reconciled_into_transaction_id, capture_method"
    )
    .eq("user_id", userId)
    .in("account_id", accountIds)
    .gte("transaction_date", from)
    .lte("transaction_date", to)
    .is("reconciled_into_transaction_id", null);
  if (error) {
    console.error("fetchReconciliationCandidates error:", error.message);
    return new Map();
  }

  const grouped = new Map<string, ReconciliationCandidate[]>();
  for (const row of data ?? []) {
    const list = grouped.get(row.account_id) ?? [];
    list.push(row as ReconciliationCandidate);
    grouped.set(row.account_id, list);
  }
  return grouped;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Page through a PostgREST query that may exceed Supabase's `max_rows` (1000).
 * Without this, an unbounded scan silently caps at 1000 rows — for balance
 * anchoring that means replaying only PART of the post-cutoff movements and
 * persisting a wrong balance. `fetchPage` must apply a stable ORDER BY so
 * `.range()` windows don't overlap.
 */
const POSTGREST_PAGE_SIZE = 1000;
async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  maxPages = 20,
): Promise<{ rows: T[]; errorMessage: string | null; truncated: boolean }> {
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * POSTGREST_PAGE_SIZE;
    const { data, error } = await fetchPage(from, from + POSTGREST_PAGE_SIZE - 1);
    if (error) return { rows, errorMessage: error.message, truncated: false };
    rows.push(...(data ?? []));
    if (!data || data.length < POSTGREST_PAGE_SIZE) {
      return { rows, errorMessage: null, truncated: false };
    }
  }
  return { rows, errorMessage: null, truncated: true };
}

/**
 * Minimal occurrence candidate used to gate the expensive per-transaction
 * occurrence-linking path during import. We fetch these ONCE for the whole
 * batch instead of issuing 1–3 queries per transaction inside the loop.
 */
type OccurrenceGateCandidate = {
  accountId: string;
  transferSourceAccountId: string | null;
  direction: "INFLOW" | "OUTFLOW";
  destinatarioId: string | null;
  occurrenceDate: string;
  expectedAmount: number;
};

/**
 * Fetch the occurrences (pending + system-paid) that could possibly match any
 * transaction in this import, in a single query. Returns `null` when the lookup
 * fails — callers treat null as "gate unavailable, attempt linking for every
 * transaction" so a transient error never silently drops a real link.
 */
async function fetchOccurrenceGateCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  transactions: TransactionToImport[],
): Promise<OccurrenceGateCandidate[] | null> {
  if (transactions.length === 0) return [];

  const dates = transactions.map((tx) => tx.transaction_date).sort();
  const min = toColombiaDateString(addDays(parseISO(dates[0] + "T12:00:00"), -4));
  const max = toColombiaDateString(
    addDays(parseISO(dates[dates.length - 1] + "T12:00:00"), 4),
  );

  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select(
      `occurrence_date, expected_amount, status,
       template:recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner(
         account_id, transfer_source_account_id, direction, is_active, destinatario_id
       )`,
    )
    .eq("user_id", userId)
    .in("status", ["pending", "paid"])
    .gte("occurrence_date", min)
    .lte("occurrence_date", max);

  if (error) {
    console.error("[importTransactions] occurrence gate lookup failed:", error.message);
    return null;
  }

  const candidates: OccurrenceGateCandidate[] = [];
  for (const row of data ?? []) {
    const template = (row as { template: {
      account_id: string;
      transfer_source_account_id: string | null;
      direction: "INFLOW" | "OUTFLOW";
      is_active: boolean;
      destinatario_id: string | null;
    } | null }).template;
    if (!template || template.is_active === false) continue;
    candidates.push({
      accountId: template.account_id,
      transferSourceAccountId: template.transfer_source_account_id,
      direction: template.direction,
      destinatarioId: template.destinatario_id,
      occurrenceDate: row.occurrence_date,
      expectedAmount: row.expected_amount,
    });
  }
  return candidates;
}

/**
 * Cheap pre-check: is there any occurrence this transaction could link to?
 * Uses the SAME shared tolerances as the authoritative matcher in
 * `findMatchingOccurrence`/`swapPhantomOccurrenceIfMatched` — ±3 days
 * (OCCURRENCE_AUTO_LINK_DAY_WINDOW) and `occurrenceAmountMatches` (1% direct,
 * 50% only when the destinatario anchor holds) — so it never skips a
 * transaction that would have matched.
 *
 * The bands MUST stay tight: an earlier ±4d/±51%-for-everything version let
 * dozens of small statement rows through on accounts with small recurring
 * templates (subscriptions), and each false-plausible burned 3-4 sequential
 * round-trips inside linkTransactionToOccurrence — the main reason a 240-row
 * savings import crawled past the proxy timeout.
 */
function hasPlausibleOccurrence(
  tx: TransactionToImport,
  candidates: OccurrenceGateCandidate[] | null,
): boolean {
  if (candidates === null) return true; // gate unavailable — preserve behavior
  if (candidates.length === 0) return false;

  const txTime = parseISO(tx.transaction_date + "T12:00:00").getTime();
  for (const occ of candidates) {
    const occTime = parseISO(occ.occurrenceDate + "T12:00:00").getTime();
    // Colombia has no DST, so noon-to-noon diffs are exact calendar days —
    // equivalent to the matcher's addDays(±window) date-range filter.
    const dayDiff = Math.abs(occTime - txTime) / 86_400_000;
    if (dayDiff > OCCURRENCE_AUTO_LINK_DAY_WINDOW) continue;

    const directMatch =
      occ.accountId === tx.account_id && occ.direction === tx.direction;
    if (directMatch) {
      if (occurrenceAmountMatches(occ.expectedAmount, tx.amount, false)) return true;
      const anchored =
        !!tx.destinatario_id && tx.destinatario_id === occ.destinatarioId;
      if (anchored && occurrenceAmountMatches(occ.expectedAmount, tx.amount, true)) {
        return true;
      }
      continue;
    }

    const crossMatch =
      tx.direction === "OUTFLOW" &&
      occ.direction === "INFLOW" &&
      occ.transferSourceAccountId === tx.account_id;
    if (crossMatch && occurrenceAmountMatches(occ.expectedAmount, tx.amount, false)) {
      return true;
    }
  }
  return false;
}

export async function previewImportReconciliation(
  items: Array<{
    statementIndex: number;
    transactionIndex: number;
    importedTransaction: TransactionToImport;
  }>
): Promise<ReconciliationPreviewResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { autoMerge: [], review: [], unmatched: [] };

  let groupedCandidates: Map<string, ReconciliationCandidate[]>;
  try {
    groupedCandidates = await fetchReconciliationCandidates(
      supabase,
      user.id,
      items.map((item) => item.importedTransaction)
    );
  } catch (err) {
    console.error("previewImportReconciliation: failed to fetch candidates", err);
    return { autoMerge: [], review: [], unmatched: [] };
  }
  const autoMerge: ReconciliationPreviewItem[] = [];
  const review: ReconciliationPreviewItem[] = [];
  const unmatched: ReconciliationPreviewResult["unmatched"] = [];

  for (const { statementIndex, transactionIndex, importedTransaction } of items) {
    const candidates = groupedCandidates.get(importedTransaction.account_id) ?? [];
    const result = findReconciliationCandidates(importedTransaction, candidates);
    const best = result.bestMatch;

    if (!best) {
      unmatched.push({ statementIndex, transactionIndex, importedTransaction });
      continue;
    }

    const candidate = candidates.find((item) => item.id === best.candidateId);
    if (!candidate) {
      unmatched.push({ statementIndex, transactionIndex, importedTransaction });
      continue;
    }

    const item: ReconciliationPreviewItem = {
      statementIndex,
      transactionIndex,
      importedTransaction,
      candidate: {
        id: candidate.id,
        raw_description: candidate.raw_description,
        merchant_name: candidate.merchant_name ?? null,
        transaction_date: candidate.transaction_date,
        amount: candidate.amount,
        category_id: candidate.category_id ?? null,
        notes: candidate.notes ?? null,
        score: best.score,
        decision: best.decision === "AUTO_MERGE" ? "AUTO_MERGE" : "REVIEW",
      },
    };

    if (best.decision === "AUTO_MERGE") autoMerge.push(item);
    else if (best.decision === "REVIEW") review.push(item);
    else unmatched.push({ statementIndex, transactionIndex, importedTransaction });
  }

  const preview = { autoMerge, review, unmatched };

  await trackProductEvent({
    event_name: "reconciliation_started",
    flow: "import",
    step: "reconcile",
    entry_point: "cta",
    success: true,
    metadata: {
      matches_auto: autoMerge.length,
      matches_review: review.length,
      matches_rejected: unmatched.length,
    },
  });

  return preview;
}

async function processStatementMeta(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  imported: number;
  skipped: number;
  statementMeta?: StatementMetaForImport[];
  details: string[];
  captureMethod: TransactionCaptureMethod;
}): Promise<{ accountUpdates: AccountUpdateResult[]; errors: number }> {
  const { supabase, userId, imported, skipped, statementMeta, details } = params;
  const accountUpdates: AccountUpdateResult[] = [];
  let errors = 0;

  // Only bank-verified statements (tier 1: PDF/EMAIL_PDF) may set account
  // balances, limits and snapshots directly. OCR screenshots (tier 2) are
  // partial captures — their balances flow through the per-transaction
  // applyAccountBalanceDelta path instead.
  if (!isBankVerifiedCapture(params.captureMethod)) return { accountUpdates, errors };

  if (!statementMeta || statementMeta.length === 0) return { accountUpdates, errors };

  const uniqueAccountIds = [...new Set(statementMeta.map((m) => m.accountId))];
  const { data: accountRows } = await supabase
    .from("accounts")
    .select("id, name, currency_code, currency_balances, account_type, is_payroll_deducted, current_balance")
    .eq("user_id", userId)
    .in("id", uniqueAccountIds);
  const accountMap = new Map(
    ((accountRows ?? []) as ImportedAccountRow[]).map((account) => [account.id, account])
  );

  const hasDebtMetadata = statementMeta.some((meta) => meta.creditCardMetadata || meta.loanMetadata);
  const recurringTemplateMap = new Map<string, RecurringTemplateSyncRow>();
  if (hasDebtMetadata) {
    const { data: recurringTemplates } = await supabase
      .from("recurring_transaction_templates")
      .select(RECURRING_TEMPLATE_SYNC_SELECT)
      .eq("user_id", userId)
      .in("account_id", uniqueAccountIds)
      .eq("direction", "INFLOW")
      .eq("frequency", "MONTHLY")
      // No category_id filter: the dedup key is the account. Filtering by
      // category_id IS NULL made the lookup miss user-categorized templates
      // and insert a duplicate template for the same debt account.
      // Inactive templates are INTENTIONALLY included (is_active DESC puts
      // active first): importing a statement for a paid-off-then-reopened
      // card resurrects its archived template instead of creating a second
      // one — the partial unique index only allows one ACTIVE per account.
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false });

    for (const template of (recurringTemplates ?? []) as RecurringTemplateSyncRow[]) {
      const key = buildRecurringTemplateKey(template.account_id);
      if (!recurringTemplateMap.has(key)) {
        recurringTemplateMap.set(key, template);
      }
    }
  }

  const pendingBalances = new Map<
    string,
    Record<string, Record<string, number | null>>
  >();
  for (const id of uniqueAccountIds) {
    const existing = accountMap.get(id)?.currency_balances;
    pendingBalances.set(
      id,
      (existing && typeof existing === "object" && !Array.isArray(existing)
        ? existing
        : {}) as Record<string, Record<string, number | null>>
    );
  }

  for (const meta of statementMeta) {
    const normalizedCcInterestRate = sanitizeEaRate(
      meta.creditCardMetadata?.interest_rate,
      "credit_card",
      details,
      meta.accountId,
      "tasa de interés"
    );
    const normalizedCcLateInterestRate = sanitizeEaRate(
      meta.creditCardMetadata?.late_interest_rate,
      "credit_card",
      details,
      meta.accountId,
      "tasa de mora"
    );
    const normalizedLoanInterestRate = sanitizeEaRate(
      meta.loanMetadata?.interest_rate,
      "loan",
      details,
      meta.accountId,
      "tasa de interés"
    );
    const normalizedLoanLateInterestRate = sanitizeEaRate(
      meta.loanMetadata?.late_interest_rate,
      "loan",
      details,
      meta.accountId,
      "tasa de mora"
    );

    // Fetch the most recent snapshot BEFORE this statement's period.
    // Uses period_to to find the chronologically preceding statement,
    // so re-imports and out-of-order historic imports both work correctly.
    let prevSnapshotQuery = supabase
      .from("statement_snapshots")
      .select("*")
      .eq("user_id", userId)
      .eq("account_id", meta.accountId)
      .eq("currency_code", meta.currency)
      .order("period_to", { ascending: false })
      .limit(1);

    if (meta.periodTo) {
      prevSnapshotQuery = prevSnapshotQuery.lt("period_to", meta.periodTo);
    } else if (meta.periodFrom) {
      prevSnapshotQuery = prevSnapshotQuery.lt("period_from", meta.periodFrom);
    }

    const { data: prevSnapshot } = await prevSnapshotQuery.maybeSingle();

    const snapshotRow = {
      user_id: userId,
      account_id: meta.accountId,
      period_from: meta.periodFrom,
      period_to: meta.periodTo,
      previous_balance: meta.summary?.previous_balance ?? null,
      total_credits: meta.summary?.total_credits ?? null,
      total_debits: meta.summary?.total_debits ?? null,
      final_balance: meta.summary?.final_balance ?? null,
      purchases_and_charges: meta.summary?.purchases_and_charges ?? null,
      interest_charged: meta.summary?.interest_charged ?? null,
      credit_limit: meta.creditCardMetadata?.credit_limit ?? null,
      available_credit: meta.creditCardMetadata?.available_credit ?? null,
      interest_rate: normalizedCcInterestRate ?? normalizedLoanInterestRate ?? null,
      late_interest_rate:
        normalizedCcLateInterestRate ?? normalizedLoanLateInterestRate ?? null,
      total_payment_due:
        meta.creditCardMetadata?.total_payment_due ?? meta.loanMetadata?.total_payment_due ?? null,
      minimum_payment:
        meta.creditCardMetadata?.minimum_payment ?? meta.loanMetadata?.minimum_payment ?? null,
      payment_due_date:
        meta.creditCardMetadata?.payment_due_date ?? meta.loanMetadata?.payment_due_date ?? null,
      remaining_balance: meta.loanMetadata?.remaining_balance ?? null,
      initial_amount: meta.loanMetadata?.initial_amount ?? null,
      installments_in_default: meta.loanMetadata?.installments_in_default ?? null,
      loan_number: meta.loanMetadata?.loan_number ?? null,
      transaction_count: meta.transactionCount,
      imported_count: imported,
      skipped_count: skipped,
      currency_code: meta.currency,
      source_filename: meta.sourceFilename ?? null,
    };

    let existingQuery = supabase
      .from("statement_snapshots")
      .select("id")
      .eq("user_id", userId)
      .eq("account_id", meta.accountId)
      .eq("currency_code", meta.currency);
    existingQuery = meta.periodFrom
      ? existingQuery.eq("period_from", meta.periodFrom)
      : existingQuery.is("period_from", null);
    existingQuery = meta.periodTo
      ? existingQuery.eq("period_to", meta.periodTo)
      : existingQuery.is("period_to", null);
    const { data: existingSnapshot } = await existingQuery.maybeSingle();

    const { error: snapshotError } = existingSnapshot
      ? await supabase
          .from("statement_snapshots")
          .update(snapshotRow)
          .eq("user_id", userId)
          .eq("id", existingSnapshot.id)
      : await supabase.from("statement_snapshots").insert(snapshotRow);

    // Handle the snapshot failure immediately — BEFORE mutating pendingBalances
    // or writing the account. Otherwise we'd leave a partial state (account
    // balance updated with no matching snapshot) and leak this currency's entry
    // into other statements of the same account in the payload.
    if (snapshotError) {
      errors++;
      const accountName = accountMap.get(meta.accountId)?.name ?? meta.accountId;
      details.push(
        `No se pudo aplicar el extracto de ${accountName} (${meta.currency}): ${snapshotError.message}`,
      );
      continue;
    }

    const account = accountMap.get(meta.accountId);

    // ── Savings balance anchoring ─────────────────────────────────────────
    // The statement's final balance is the truth AT the cutoff date, not
    // today. Anchor there and replay the post-cutoff movements the app
    // already tracks; if the user re-anchored the balance with a manual
    // adjustment after the cutoff, their balance wins and stays untouched.
    let savingsAnchor: AnchoredBalanceResult | null = null;
    const isSavingsStatement =
      !meta.creditCardMetadata && !meta.loanMetadata && meta.summary?.final_balance != null;
    if (isSavingsStatement) {
      const finalBalance = meta.summary!.final_balance!;
      const accountLabel = account?.name ?? meta.accountId;
      if (meta.periodTo) {
        const {
          rows: postCutoffTxs,
          errorMessage: postCutoffError,
          truncated: postCutoffTruncated,
        } = await fetchAllPages<{
          amount: number;
          direction: "INFLOW" | "OUTFLOW";
          raw_description: string | null;
        }>((from, to) =>
          supabase
            .from("transactions")
            .select("amount, direction, raw_description")
            .eq("user_id", userId)
            .eq("account_id", meta.accountId)
            .eq("currency_code", meta.currency as CurrencyCode)
            .eq("is_excluded", false)
            .is("reconciled_into_transaction_id", null)
            .gt("transaction_date", meta.periodTo!)
            .order("transaction_date", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        );

        if (postCutoffError || postCutoffTruncated) {
          // Can't know what happened after the cutoff — never stomp the live
          // balance with a stale statement figure.
          savingsAnchor = { keepExisting: true, balance: null, postCutoffCount: 0 };
          details.push(
            `⚠️ ${accountLabel}: no se pudieron verificar los movimientos posteriores al corte — el saldo actual no fue modificado.`,
          );
        } else {
          savingsAnchor = anchorStatementBalance({
            finalBalance,
            accountType: account?.account_type ?? "SAVINGS",
            postCutoffTransactions: postCutoffTxs.map((tx) => ({
              amount: Number(tx.amount),
              direction: tx.direction,
              rawDescription: tx.raw_description,
            })),
          });
          if (savingsAnchor.keepExisting) {
            details.push(
              `${accountLabel}: el saldo fue ajustado manualmente después del corte (${meta.periodTo}) — se mantiene el saldo actual de la cuenta.`,
            );
          } else if (savingsAnchor.postCutoffCount > 0) {
            details.push(
              `${accountLabel}: saldo = corte del extracto (${finalBalance.toLocaleString("es-CO")}) + ${savingsAnchor.postCutoffCount} movimiento(s) posteriores = ${savingsAnchor.balance.toLocaleString("es-CO")}.`,
            );
          }
        }
      } else {
        savingsAnchor = { keepExisting: false, balance: finalBalance, postCutoffCount: 0 };
      }

      // Balance guarantee: the app's movements inside the period must walk
      // previous_balance → final_balance. A mismatch means duplicated or
      // missing movements — surfaced instead of silently drifting.
      if (meta.periodFrom && meta.periodTo && meta.summary?.previous_balance != null) {
        const {
          rows: periodTxs,
          errorMessage: periodError,
          truncated: periodTruncated,
        } = await fetchAllPages<{ amount: number; direction: "INFLOW" | "OUTFLOW" }>(
          (from, to) =>
            supabase
              .from("transactions")
              .select("amount, direction")
              .eq("user_id", userId)
              .eq("account_id", meta.accountId)
              .eq("currency_code", meta.currency as CurrencyCode)
              .eq("is_excluded", false)
              .is("reconciled_into_transaction_id", null)
              .gte("transaction_date", meta.periodFrom!)
              .lte("transaction_date", meta.periodTo!)
              .order("transaction_date", { ascending: true })
              .order("id", { ascending: true })
              .range(from, to),
        );
        // A partial read would produce a false ⚠️/✓ — skip validation instead.
        if (!periodError && !periodTruncated) {
          const validation = validateStatementPeriodBalance({
            previousBalance: meta.summary.previous_balance,
            finalBalance,
            accountType: account?.account_type ?? "SAVINGS",
            periodTransactions: periodTxs.map((tx) => ({
              amount: Number(tx.amount),
              direction: tx.direction,
            })),
          });
          if (validation.matches) {
            details.push(
              `✓ ${accountLabel}: los movimientos del periodo cuadran con el saldo final del extracto (${finalBalance.toLocaleString("es-CO")}).`,
            );
          } else {
            const sign = validation.difference > 0 ? "sobran" : "faltan";
            details.push(
              `⚠️ ${accountLabel}: los movimientos del periodo no cuadran con el extracto — ${sign} ${Math.abs(validation.difference).toLocaleString("es-CO")} ${meta.currency}. Revisa duplicados o movimientos no importados.`,
            );
          }
        }
      }
    }

    const currencyEntry: Record<string, number | null> = {};
    if (meta.creditCardMetadata) {
      const cc = meta.creditCardMetadata;
      currencyEntry.credit_limit = cc.credit_limit ?? null;
      currencyEntry.available_balance = cc.available_credit ?? null;
      currencyEntry.interest_rate = normalizedCcInterestRate;
      currencyEntry.minimum_payment = cc.minimum_payment ?? null;
      currencyEntry.total_payment_due = cc.total_payment_due ?? null;
      if (cc.total_payment_due != null) {
        currencyEntry.current_balance = cc.total_payment_due;
      } else if (cc.credit_limit != null && cc.available_credit != null) {
        currencyEntry.current_balance = Math.max(cc.credit_limit - cc.available_credit, 0);
      } else {
        currencyEntry.current_balance = null;
      }
    } else if (meta.loanMetadata) {
      const ln = meta.loanMetadata;
      currencyEntry.current_balance = ln.remaining_balance ?? null;
      currencyEntry.interest_rate = normalizedLoanInterestRate;
      currencyEntry.total_payment_due = ln.total_payment_due ?? null;
    } else if (meta.summary?.final_balance != null) {
      if (savingsAnchor?.keepExisting) {
        // Preserve whatever balance the account already shows for this
        // currency — the user re-anchored it after the statement cutoff.
        const existingEntryBalance =
          pendingBalances.get(meta.accountId)?.[meta.currency]?.current_balance ?? null;
        currencyEntry.current_balance =
          existingEntryBalance ??
          (account?.currency_code === meta.currency && account?.current_balance != null
            ? Number(account.current_balance)
            : null);
      } else {
        currencyEntry.current_balance = savingsAnchor?.balance ?? meta.summary.final_balance;
      }
    }

    const balances = pendingBalances.get(meta.accountId)!;
    balances[meta.currency] = currencyEntry;

    const accountUpdate: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
    };

    // If user selected a different primary currency, update the account's currency_code
    // only from the statement that matches the chosen primary currency
    if (
      meta.primaryCurrency &&
      account?.currency_code !== meta.primaryCurrency &&
      meta.currency === meta.primaryCurrency
    ) {
      accountUpdate.currency_code = meta.primaryCurrency;
    }

    const isPrimaryCurrency =
      meta.primaryCurrency
        ? meta.currency === meta.primaryCurrency
        : account?.currency_code === meta.currency;

    if (meta.creditCardMetadata && isPrimaryCurrency) {
      const cc = meta.creditCardMetadata;
      if (cc.credit_limit != null) accountUpdate.credit_limit = cc.credit_limit;
      if (normalizedCcInterestRate != null) accountUpdate.interest_rate = normalizedCcInterestRate;
      if (cc.total_payment_due != null) {
        accountUpdate.current_balance = cc.total_payment_due;
      } else if (cc.credit_limit != null && cc.available_credit != null) {
        accountUpdate.current_balance = Math.max(cc.credit_limit - cc.available_credit, 0);
      }
      if (cc.available_credit != null) accountUpdate.available_balance = cc.available_credit;
      if (cc.payment_due_date) {
        accountUpdate.payment_day = new Date(cc.payment_due_date).getUTCDate();
      }
      if (cc.minimum_payment != null) accountUpdate.monthly_payment = cc.minimum_payment;
    } else if (meta.loanMetadata && isPrimaryCurrency) {
      const ln = meta.loanMetadata;
      if (ln.remaining_balance != null) accountUpdate.current_balance = ln.remaining_balance;
      if (normalizedLoanInterestRate != null) accountUpdate.interest_rate = normalizedLoanInterestRate;
      if (ln.payment_due_date) {
        accountUpdate.payment_day = new Date(ln.payment_due_date).getUTCDate();
      }
      const loanMonthly = ln.minimum_payment ?? ln.total_payment_due;
      if (loanMonthly != null) accountUpdate.monthly_payment = loanMonthly;
    } else if (
      !meta.creditCardMetadata &&
      !meta.loanMetadata &&
      meta.summary?.final_balance != null &&
      isPrimaryCurrency &&
      !savingsAnchor?.keepExisting
    ) {
      accountUpdate.current_balance = savingsAnchor?.balance ?? meta.summary.final_balance;
    }

    accountUpdate.currency_balances = balances;

    const { error: accountError } = await supabase
      .from("accounts")
      .update(accountUpdate)
      .eq("user_id", userId)
      .eq("id", meta.accountId);

    // The account write failed (snapshot already succeeded). Count it as an
    // error and skip the phantom accountUpdate + recurring sync, so callers
    // don't treat a failed import as success — e.g. the email-queue clear gate
    // and the per-statement errors counter, which for metadata-only loan
    // imports are the only success signal.
    if (accountError) {
      errors++;
      const accountName = account?.name ?? meta.accountId;
      details.push(
        `No se pudo aplicar el extracto de ${accountName} (${meta.currency}): ${accountError.message}`,
      );
      continue;
    }

    const diffs = computeSnapshotDiffs(prevSnapshot, snapshotRow);
    accountUpdates.push({
      accountId: meta.accountId,
      accountName: account?.name ?? "",
      diffs,
      isFirstImport: !prevSnapshot,
    });

    const templateKey = buildRecurringTemplateKey(meta.accountId);
    if (meta.creditCardMetadata) {
      await syncCreditCardRecurringTemplate({
        supabase,
        userId,
        meta,
        account,
        prevSnapshot,
        existingTemplate: recurringTemplateMap.get(templateKey),
        templateMap: recurringTemplateMap,
        details,
      });
    } else if (meta.loanMetadata && !account?.is_payroll_deducted) {
      await syncLoanRecurringTemplate({
        supabase,
        userId,
        meta,
        account,
        prevSnapshot,
        existingTemplate: recurringTemplateMap.get(templateKey),
        templateMap: recurringTemplateMap,
        details,
      });
    }
  }

  return { accountUpdates, errors };
}

export async function importTransactions(
  _prevState: ActionResult<ImportResult>,
  formData: FormData
): Promise<ActionResult<ImportResult>> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const parsed = parsePayload(formData);
  if (!parsed || !parsed.success) {
    const firstIssue = parsed && !parsed.success ? parsed.error.issues[0] : null;
    await trackProductEvent({
      event_name: "import_completed",
      flow: "import",
      step: "persist",
      entry_point: "cta",
      success: false,
      error_code: "invalid_payload",
    });
    return {
      success: false,
      error: firstIssue
        ? `No pudimos validar la importación: ${firstIssue.message}`
        : "No pudimos validar la importación. Intenta de nuevo.",
    };
  }

  const { transactions, statementMeta, reconciliationDecisions = [], captureMethod = "PDF_IMPORT" } = parsed.data;
  const normalizedStatementMeta: StatementMetaForImport[] | undefined = statementMeta?.map(
    (meta) => ({
      ...meta,
      creditCardMetadata: meta.creditCardMetadata ?? null,
      loanMetadata: meta.loanMetadata ?? null,
      sourceFilename: meta.sourceFilename,
    })
  );
  const decisionMap = new Map<string, ReconciliationDecisionInput>(
    reconciliationDecisions.map((decision) => [
      buildDecisionKey(decision.statementIndex, decision.transactionIndex),
      decision,
    ])
  );

  // Pre-fetch destinatario → tag mappings to auto-tag imported transactions
  const destIds = [...new Set(
    transactions.filter((tx) => tx.destinatario_id).map((tx) => tx.destinatario_id!)
  )];
  const destTagMap = new Map<string, string[]>();
  if (destIds.length > 0) {
    const { data: destTags } = await supabase
      .from("destinatario_tags")
      .select("destinatario_id, tag_id")
      .in("destinatario_id", destIds);
    for (const dt of destTags ?? []) {
      const existing = destTagMap.get(dt.destinatario_id) ?? [];
      existing.push(dt.tag_id);
      destTagMap.set(dt.destinatario_id, existing);
    }
  }

  // Pre-fetch tags for reconciliation candidates (avoid N+1 inside loop)
  const candidateIds = reconciliationDecisions
    .filter((d) => d.decision !== "KEEP_BOTH")
    .map((d) => d.candidateTransactionId);
  const existingTagMap = new Map<string, string[]>();
  if (candidateIds.length > 0) {
    const { data: candidateTags } = await supabase
      .from("transaction_tags")
      .select("transaction_id, tag_id")
      .in("transaction_id", candidateIds);
    for (const ct of candidateTags ?? []) {
      const existing = existingTagMap.get(ct.transaction_id) ?? [];
      existing.push(ct.tag_id);
      existingTagMap.set(ct.transaction_id, existing);
    }
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let autoMerged = 0;
  let manualMerged = 0;
  let leftAsSeparate = 0;
  const details: string[] = [];
  const balanceDeltaTxs: TransactionToImport[] = [];
  const pendingTagInserts: { transaction_id: string; tag_id: string; user_id: string }[] = [];

  type InsertedRow = {
    id: string;
    idempotency_key: string | null;
    category_id: string | null;
    categorization_source: Database["public"]["Enums"]["categorization_source"] | null;
    notes: string | null;
  };
  const INSERTED_SELECT = "id, idempotency_key, category_id, categorization_source, notes";

  function buildInsertRow(
    tx: TransactionToImport,
    idempotencyKey: string,
  ): Database["public"]["Tables"]["transactions"]["Insert"] {
    return {
      user_id: user!.id,
      account_id: tx.account_id,
      amount: tx.amount,
      currency_code: tx.currency_code as CurrencyCode,
      direction: tx.direction,
      transaction_date: tx.transaction_date,
      raw_description: tx.raw_description,
      clean_description: tx.raw_description,
      idempotency_key: idempotencyKey,
      provider: "OCR",
      capture_method: captureMethod,
      category_id: tx.category_id ?? null,
      notes: tx.notes ?? null,
      categorization_source: tx.categorization_source ?? "SYSTEM_DEFAULT",
      categorization_confidence: tx.categorization_confidence ?? null,
      status: "POSTED" as const,
      installment_current: tx.installment_current ?? null,
      installment_total: tx.installment_total ?? null,
      installment_group_id: tx.installment_group_id ?? null,
      original_amount: tx.original_amount ?? null,
      destinatario_id: tx.destinatario_id ?? null,
      merchant_name: tx.merchant_name ?? null,
    };
  }

  // ── 1. Idempotency keys (computed in parallel, not awaited one-by-one) ──
  // Use original_amount (full purchase price) for idempotency when available,
  // so re-imports of the same statement produce the same key regardless of
  // whether the parser previously used the full price or now uses the cuota.
  //
  // Identical rows WITHIN one statement are distinct real movements (a bank
  // statement never lists the same movement twice) — the occurrence index
  // keeps the 2nd/3rd copy from collapsing into the 1st's key and being
  // silently skipped. Counting is scoped per statement, so the same movement
  // in two uploaded statements (overlapping periods) still dedups.
  const occurrenceIndexes = assignStatementOccurrenceIndexes(
    transactions.map((tx) => ({
      importKey: tx.import_key,
      transactionDate: tx.transaction_date,
      amount: tx.amount,
      originalAmount: tx.original_amount,
      rawDescription: tx.raw_description,
      installmentCurrent: tx.installment_current,
    })),
  );
  const idempotencyKeys = await Promise.all(
    transactions.map((tx, index) =>
      computeIdempotencyKey({
        provider: "OCR",
        providerTransactionId:
          occurrenceIndexes[index] > 1 ? `occ${occurrenceIndexes[index]}` : undefined,
        transactionDate: tx.transaction_date,
        amount: tx.original_amount ?? tx.amount,
        rawDescription: tx.raw_description,
        installmentCurrent: tx.installment_current,
      }),
    ),
  );

  // ── 2. Pre-filter duplicates against already-imported rows in ONE pass ──
  // The `transactions` view has an INSTEAD OF trigger, so PostgREST `ON CONFLICT`
  // (upsert) is unavailable — we can't dedup at insert time. Instead we look up
  // existing idempotency keys up front, then batch-insert only the new rows.
  const uniqueKeys = [...new Set(idempotencyKeys)];
  const existingKeys = new Set<string>();
  // Independent reads — run the chunk lookups concurrently to cut latency.
  const existingKeyResults = await Promise.all(
    chunkArray(uniqueKeys, 100).map((chunk) =>
      supabase
        .from("transactions")
        .select("idempotency_key")
        .eq("user_id", user.id)
        .in("idempotency_key", chunk),
    ),
  );
  for (const { data: existingRows, error: existingErr } of existingKeyResults) {
    if (existingErr) {
      // Non-fatal: fall back to the DB unique constraint catching dupes during
      // insert (handled by the per-row fallback below).
      console.error("[importTransactions] existing-key lookup failed:", existingErr.message);
      continue;
    }
    for (const row of existingRows ?? []) {
      if (row.idempotency_key) existingKeys.add(row.idempotency_key);
    }
  }

  // ── 3. Build the insert set, skipping DB duplicates and intra-batch dupes ──
  type PreparedInsert = { tx: TransactionToImport; key: string; index: number };
  const seenKeys = new Set<string>();
  const toInsert: PreparedInsert[] = [];
  transactions.forEach((tx, index) => {
    const key = idempotencyKeys[index];
    if (existingKeys.has(key) || seenKeys.has(key)) {
      skipped++;
      return;
    }
    seenKeys.add(key);
    toInsert.push({ tx, key, index });
  });

  // ── 4. Batch-insert through the encrypted view, chunked. On a chunk error
  //    (e.g. a concurrent insert racing the same idempotency key) fall back to
  //    per-row inserts so good rows still land and dupes skip cleanly. ──
  const insertedByKey = new Map<string, InsertedRow>();
  for (const chunk of chunkArray(toInsert, 100)) {
    const rows = chunk.map(({ tx, key }) => buildInsertRow(tx, key));
    const { data: insertedRows, error: insertError } = await supabase
      .from("transactions")
      .insert(rows)
      .select(INSERTED_SELECT);

    if (insertError) {
      for (const { tx, key } of chunk) {
        const { data: single, error: singleErr } = await supabase
          .from("transactions")
          .insert(buildInsertRow(tx, key))
          .select(INSERTED_SELECT)
          .single();
        if (singleErr) {
          if (singleErr.code === "23505") {
            skipped++;
          } else {
            errors++;
            details.push(`${tx.raw_description}: ${singleErr.message}`);
          }
          continue;
        }
        if (single) {
          insertedByKey.set(key, single as InsertedRow);
          imported++;
        }
      }
      continue;
    }

    for (const row of (insertedRows ?? []) as InsertedRow[]) {
      if (row.idempotency_key) {
        insertedByKey.set(row.idempotency_key, row);
        imported++;
      }
    }
  }

  // ── 5. Pre-fetch occurrence candidates ONCE to gate the expensive per-tx
  //    linking path. Most imports (e.g. a savings statement with no recurring
  //    obligations on the account) skip linking entirely after this. ──
  const occurrenceCandidates = await fetchOccurrenceGateCandidates(
    supabase,
    user.id,
    transactions,
  );

  // ── 6. Batch-fetch reconciliation decision candidates in ONE pass. The old
  //    per-merge `.maybeSingle()` was a sequential round-trip per duplicate —
  //    with dozens of merges it dominated the import's wall-clock. ──
  const decisionCandidateMap = new Map<string, ReconciliationCandidate>();
  // Failure is tracked per candidate id (not one global flag): a single
  // failed chunk must not misclassify legitimately-absent candidates from
  // the chunks that succeeded.
  const failedCandidateIds = new Set<string>();
  if (candidateIds.length > 0) {
    const candidateChunks = chunkArray([...new Set(candidateIds)], 100);
    const candidateResults = await Promise.all(
      candidateChunks.map((chunk) =>
        supabase
          .from("transactions")
          .select(
            "id, user_id, account_id, amount, direction, transaction_date, raw_description, merchant_name, clean_description, category_id, categorization_source, notes, reconciled_into_transaction_id, capture_method"
          )
          .eq("user_id", user.id)
          .is("reconciled_into_transaction_id", null)
          .in("id", chunk),
      ),
    );
    candidateResults.forEach(({ data: candidateRows, error: candidateErr }, chunkIndex) => {
      if (candidateErr) {
        for (const id of candidateChunks[chunkIndex]) failedCandidateIds.add(id);
        console.error(
          "[importTransactions] decision-candidate lookup failed:",
          candidateErr.message,
        );
        return;
      }
      for (const row of candidateRows ?? []) {
        decisionCandidateMap.set(row.id, row as ReconciliationCandidate);
      }
    });
  }

  // ── 7. Post-insert pass: auto-tags, occurrence linking, reconciliation.
  //    Occurrence links stay sequential (two same-amount rows may compete for
  //    the same pending occurrence — sequential linking lets the second see the
  //    first's status change). Merge updates are independent per pair, so they
  //    are collected here and executed concurrently below. ──
  type MergeOp = {
    insertedId: string;
    existingId: string;
    score: number;
    merged: ReturnType<typeof mergeTransactionMetadata>;
  };
  const mergeOps: MergeOp[] = [];
  // The old per-merge re-query filtered `reconciled_into_transaction_id IS
  // NULL`, so a candidate claimed by an earlier merge in the same run came
  // back null for the next one. The batched snapshot is taken once, so that
  // guard must be replayed locally: a candidate can be claimed exactly once.
  const claimedCandidateIds = new Set<string>();

  for (const { tx, key, index } of toInsert) {
    const insertedTx = insertedByKey.get(key);
    if (!insertedTx) continue; // skipped (duplicate) or failed insert

    // Accumulate auto-tags from destinatario (batched after loop)
    const tagIds = tx.destinatario_id ? destTagMap.get(tx.destinatario_id) : undefined;
    if (tagIds) {
      for (const tag_id of tagIds) {
        pendingTagInserts.push({ transaction_id: insertedTx.id, tag_id, user_id: user.id });
      }
    }

    if (hasPlausibleOccurrence(tx, occurrenceCandidates)) {
      await linkTransactionToOccurrence(
        tx.account_id, tx.transaction_date,
        tx.amount, tx.direction, insertedTx.id,
        tx.destinatario_id ?? null,
        // Statement imports carry the debt-account side themselves (the card
        // statement's own abono row) — synthesizing a companion INFLOW here
        // would duplicate it when both statements are imported.
        { skipDebtCompanionLeg: true },
      );
    }

    const decision = tx.import_key
      ? decisionMap.get(tx.import_key)
      : decisionMap.get(buildDecisionKey(-1, index));
    if (!decision || decision.decision === "KEEP_BOTH") {
      balanceDeltaTxs.push(tx);
      leftAsSeparate++;
      continue;
    }

    if (claimedCandidateIds.has(decision.candidateTransactionId)) {
      // Another imported row already merged into this candidate — keep this
      // one as a separate transaction (matches the old sequential behavior).
      balanceDeltaTxs.push(tx);
      leftAsSeparate++;
      continue;
    }

    if (failedCandidateIds.has(decision.candidateTransactionId)) {
      // This candidate's lookup chunk errored — we can't tell "already
      // reconciled" from "lookup failed", so surface it instead of silently
      // keeping both.
      errors++;
      details.push(
        `Reconciliación: ${tx.raw_description}: no se pudo verificar la transacción duplicada.`,
      );
      continue;
    }

    const existingTx = decisionCandidateMap.get(decision.candidateTransactionId);
    if (!existingTx) {
      balanceDeltaTxs.push(tx);
      leftAsSeparate++;
      continue;
    }

    // Reconciled: existing tx already applied its balance delta, so do NOT
    // add to balanceDeltaTxs to avoid double-counting.
    const merged = mergeTransactionMetadata(existingTx, {
      category_id: insertedTx.category_id,
      categorization_source: insertedTx.categorization_source ?? undefined,
      notes: insertedTx.notes,
      capture_method: captureMethod,
    });

    claimedCandidateIds.add(existingTx.id);
    mergeOps.push({
      insertedId: insertedTx.id,
      existingId: existingTx.id,
      score: decision.score,
      merged,
    });

    // Copy existing transaction's tags to surviving (imported) transaction (pre-fetched)
    const existingTags = existingTagMap.get(existingTx.id);
    if (existingTags) {
      for (const tag_id of existingTags) {
        pendingTagInserts.push({ transaction_id: insertedTx.id, tag_id, user_id: user.id });
      }
    }

    if (decision.decision === "AUTO_MERGE") autoMerged++;
    else manualMerged++;
  }

  // ── 8. Apply the merge updates concurrently (chunked). Each pair touches
  //    two distinct rows and no pair overlaps another, so parallelism is safe. ──
  for (const chunk of chunkArray(mergeOps, 20)) {
    await Promise.all(
      chunk.flatMap((op) => [
        supabase
          .from("transactions")
          .update({
            category_id: op.merged.category_id ?? null,
            notes: op.merged.notes ?? null,
            capture_method: op.merged.capture_method,
          })
          .eq("user_id", user.id)
          .eq("id", op.insertedId),
        supabase
          .from("transactions")
          .update({
            reconciled_into_transaction_id: op.insertedId,
            reconciliation_score: op.score,
          })
          .eq("user_id", user.id)
          .eq("id", op.existingId),
      ]),
    );
  }

  // Auto-exclude manual balance adjustments covered by this import.
  // A statement covers its FULL period, so adjustments anywhere inside
  // [period_from, period_to] are superseded by the real movements — not just
  // those between the first and last imported transaction dates (a statement
  // whose movements start on the 5th still proves the balance from the 1st).
  let adjustmentsExcluded = 0;
  const accountDateRanges = new Map<string, { min: string; max: string }>();

  for (const tx of transactions) {
    const existing = accountDateRanges.get(tx.account_id);
    if (!existing) {
      accountDateRanges.set(tx.account_id, { min: tx.transaction_date, max: tx.transaction_date });
    } else {
      if (tx.transaction_date < existing.min) existing.min = tx.transaction_date;
      if (tx.transaction_date > existing.max) existing.max = tx.transaction_date;
    }
  }

  if (isBankVerifiedCapture(captureMethod)) {
    for (const meta of normalizedStatementMeta ?? []) {
      if (!meta.periodFrom && !meta.periodTo) continue;
      const existing = accountDateRanges.get(meta.accountId);
      if (!existing) {
        if (meta.periodFrom && meta.periodTo) {
          accountDateRanges.set(meta.accountId, { min: meta.periodFrom, max: meta.periodTo });
        }
        continue;
      }
      if (meta.periodFrom && meta.periodFrom < existing.min) existing.min = meta.periodFrom;
      if (meta.periodTo && meta.periodTo > existing.max) existing.max = meta.periodTo;
    }
  }

  const exclusionCounts = await Promise.all(
    [...accountDateRanges].map(async ([accountId, range]) => {
      const { data: adjustments } = await supabase
        .from("transactions")
        .select("id")
        .eq("user_id", user.id)
        .eq("account_id", accountId)
        .eq("is_excluded", false)
        .like("raw_description", `${MANUAL_BALANCE_ADJUSTMENT_PREFIX}%`)
        .gte("transaction_date", range.min)
        .lte("transaction_date", range.max);

      if (!adjustments || adjustments.length === 0) return 0;

      const ids = adjustments.map((a) => a.id);
      await supabase
        .from("transactions")
        .update({ is_excluded: true })
        .eq("user_id", user.id)
        .in("id", ids);

      return ids.length;
    }),
  );
  adjustmentsExcluded += exclusionCounts.reduce((sum, count) => sum + count, 0);

  if (adjustmentsExcluded > 0) {
    details.push(`${adjustmentsExcluded} ajuste(s) manual(es) reemplazado(s) por transacciones del extracto`);
  }

  const { accountUpdates, errors: metaErrors } = await processStatementMeta({
    supabase,
    userId: user.id,
    imported,
    skipped,
    statementMeta: normalizedStatementMeta,
    details,
    captureMethod,
  });
  // Snapshot/account write failures must surface in the result so the email
  // queue isn't cleared on a failed import and the results screen reports it.
  errors += metaErrors;

  // Ensure occurrence rows are generated for any newly created/updated templates
  await ensureCurrentOccurrences();

  // Tier-2 imports fall back to per-tx balance deltas. The meta-balance
  // exclusion only applies when processStatementMeta actually RAN (tier 1) —
  // otherwise a screenshot whose parser emitted metadata would skip BOTH
  // balance paths and leave the account stale.
  if (balanceDeltaTxs.length > 0) {
    const accountsWithMetaBalance = new Set<string>();
    if (isBankVerifiedCapture(captureMethod)) {
      for (const meta of normalizedStatementMeta ?? []) {
        if (meta.creditCardMetadata || meta.loanMetadata || meta.summary?.final_balance != null) {
          accountsWithMetaBalance.add(meta.accountId);
        }
      }
    }

    const txsByAccount = new Map<string, TransactionToImport[]>();
    for (const tx of balanceDeltaTxs) {
      if (accountsWithMetaBalance.has(tx.account_id)) continue;
      const list = txsByAccount.get(tx.account_id) ?? [];
      list.push(tx);
      txsByAccount.set(tx.account_id, list);
    }

    if (txsByAccount.size > 0) {
      const accountIds = [...txsByAccount.keys()];
      const { data: balanceAccounts, error: balanceError } = await supabase
        .from("accounts")
        .select("id, account_type, current_balance, currency_code, currency_balances, credit_limit, available_balance")
        .eq("user_id", user.id)
        .in("id", accountIds);

      if (balanceError) {
        console.error("Failed to fetch accounts for balance delta:", balanceError.message);
      }

      for (const account of balanceAccounts ?? []) {
        const txs = txsByAccount.get(account.id);
        if (!txs) continue;

        let balance = Number(account.current_balance ?? 0);
        for (const tx of txs) {
          balance = applyAccountBalanceDelta({
            currentBalance: balance,
            accountType: account.account_type,
            direction: tx.direction,
            amount: tx.amount,
          });
        }

        const existingBalances =
          account.currency_balances &&
          typeof account.currency_balances === "object" &&
          !Array.isArray(account.currency_balances)
            ? (account.currency_balances as Record<string, Record<string, number | null>>)
            : {};
        const currencyKey = account.currency_code ?? txs[0].currency_code;
        const currencyEntry = existingBalances[currencyKey];

        // Keep `available_balance` consistent with the new `current_balance`
        // for credit cards. The debt views derive their balance via
        // `computeDebtBalance()`, which PREFERS `credit_limit - available_balance`
        // over `current_balance` — so a stale `available_balance` (last set by a
        // bank-verified PDF statement) would otherwise make the debt page lag the
        // accounts page after a Tier-2 (OCR/email) delta. We recompute it here so
        // both reads agree. Per-currency `credit_limit` wins over the
        // account-level column when present.
        const isDebt =
          account.account_type === "CREDIT_CARD" || account.account_type === "LOAN";
        const creditLimit =
          (typeof currencyEntry?.credit_limit === "number" ? currencyEntry.credit_limit : null) ??
          (account.credit_limit != null ? Number(account.credit_limit) : null);
        const recomputedAvailable =
          account.account_type === "CREDIT_CARD" && creditLimit != null && creditLimit > 0
            ? Math.max(creditLimit - balance, 0)
            : null;

        existingBalances[currencyKey] = {
          ...currencyEntry,
          current_balance: balance,
          ...(recomputedAvailable != null ? { available_balance: recomputedAvailable } : {}),
          // `total_payment_due` is a statement-time figure; once a delta import
          // moves the live balance it's stale. Clear it for every debt account:
          // `computeDebtFromCurrencyBalance()` (multi-currency) checks
          // `total_payment_due` BEFORE both the credit_limit−available formula and
          // the `current_balance` fallback, so a leftover value would otherwise
          // shadow the freshly updated balance on the debt page — including for
          // loans and credit cards without a credit limit.
          ...(isDebt ? { total_payment_due: null } : {}),
        };

        const { error: updateError } = await supabase
          .from("accounts")
          .update({
            current_balance: balance,
            currency_balances: existingBalances,
            ...(recomputedAvailable != null ? { available_balance: recomputedAvailable } : {}),
          })
          .eq("user_id", user.id)
          .eq("id", account.id);

        if (updateError) {
          console.error("Failed to update balance for account", account.id, updateError.message);
        }
      }
    }
  }

  // Batch-insert all accumulated transaction tags
  if (pendingTagInserts.length > 0) {
    const { error: tagError } = await supabase
      .from("transaction_tags")
      .upsert(pendingTagInserts, { onConflict: "transaction_id,tag_id", ignoreDuplicates: true });
    if (tagError) {
      console.error("Failed to auto-tag imported transactions:", tagError.message);
      details.push(`Auto-etiquetado parcial: ${tagError.message}`);
    }
  }

  // Best-effort subscription detection — never fails the import
  try {
    await runSubscriptionDetection();
  } catch {
    // detection is best-effort; never fail the import on it
  }

  revalidateFinancialViews();
  updateTag("snapshots");
  updateTag("impact");
  updateTag("tags");

  // Analytics events are independent — fire them concurrently.
  const productEvents: Promise<unknown>[] = [
    trackProductEvent({
      event_name: "import_completed",
      flow: "import",
      step: "persist",
      entry_point: "cta",
      success: true,
      metadata: {
        imported,
        skipped,
        errors,
        autoMerged,
        manualMerged,
        leftAsSeparate,
        account_updates: accountUpdates.length,
        statement_meta_count: normalizedStatementMeta?.length ?? 0,
      },
    }),
  ];

  if (autoMerged > 0) {
    productEvents.push(
      trackProductEvent({
        event_name: "reconciliation_auto_merge_applied",
        flow: "import",
        step: "persist",
        entry_point: "cta",
        success: true,
        metadata: {
          matches_auto: autoMerged,
        },
      }),
    );
  }

  if (manualMerged > 0) {
    productEvents.push(
      trackProductEvent({
        event_name: "reconciliation_manual_merge_confirmed",
        flow: "import",
        step: "persist",
        entry_point: "cta",
        success: true,
        metadata: {
          matches_review: manualMerged,
        },
      }),
    );
  }

  if (leftAsSeparate > 0) {
    productEvents.push(
      trackProductEvent({
        event_name: "reconciliation_match_rejected",
        flow: "import",
        step: "persist",
        entry_point: "cta",
        success: true,
        metadata: {
          matches_rejected: leftAsSeparate,
        },
      }),
    );
  }

  await Promise.all(productEvents);

  return {
    success: true,
    data: {
      imported,
      skipped,
      errors,
      details,
      autoMerged,
      manualMerged,
      leftAsSeparate,
      adjustmentsExcluded,
      accountUpdates,
    },
  };
}
