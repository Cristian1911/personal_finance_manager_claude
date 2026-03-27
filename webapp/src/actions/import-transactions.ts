"use server";

import { revalidateTag } from "next/cache";
import {
  computeSnapshotDiffs,
  findReconciliationCandidates,
  mergeTransactionMetadata,
  type ReconciliationCandidate,
} from "@zeta/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { importPayloadSchema } from "@/lib/validators/import";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import {
  applyVisibleTransactionFilter,
  isMissingReconciliationColumnError,
} from "@/lib/utils/transactions";
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

type DebtKind = "credit_card" | "loan";
type CurrencyCode = Database["public"]["Enums"]["currency_code"];
type ImportedAccountRow = Pick<
  Database["public"]["Tables"]["accounts"]["Row"],
  "id" | "name" | "currency_code" | "currency_balances" | "account_type"
>;
type StatementSnapshotSyncRow = Pick<
  Database["public"]["Tables"]["statement_snapshots"]["Row"],
  "period_to" | "payment_due_date"
>;
type RecurringTemplateSyncRow = Pick<
  Database["public"]["Tables"]["recurring_transaction_templates"]["Row"],
  | "id"
  | "account_id"
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
>;

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
  "id, account_id, currency_code, merchant_name, description, direction, frequency, category_id, transfer_source_account_id, is_active, start_date, day_of_month";

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
    return importPayloadSchema.safeParse(JSON.parse(rawPayload));
  } catch {
    return null;
  }
}

function buildDecisionKey(statementIndex: number, transactionIndex: number): string {
  return `${statementIndex}:${transactionIndex}`;
}

function buildRecurringTemplateKey(accountId: string, currency: string): string {
  return `${accountId}:${currency.toUpperCase()}`;
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
  if (cc.total_payment_due == null || !Number.isFinite(cc.total_payment_due) || cc.total_payment_due <= 0) {
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
  const templateKey = buildRecurringTemplateKey(params.meta.accountId, params.meta.currency);
  const merchantName =
    params.existingTemplate?.merchant_name?.trim() ||
    buildDebtPaymentMerchantName(accountName);
  const description = params.existingTemplate?.description?.trim() || null;
  const amount = Math.round(cc.total_payment_due * 100) / 100;

  try {
    if (params.existingTemplate) {
      const { data, error } = await params.supabase
        .from("recurring_transaction_templates")
        .update({
          amount,
          currency_code: params.meta.currency as CurrencyCode,
          merchant_name: merchantName,
          description,
          start_date: cc.payment_due_date,
          day_of_month: dayOfMonth,
        })
        .eq("user_id", params.userId)
        .eq("id", params.existingTemplate.id)
        .select(RECURRING_TEMPLATE_SYNC_SELECT)
        .single();

      if (error) throw error;
      params.templateMap.set(templateKey, data as RecurringTemplateSyncRow);
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
        amount,
        currency_code: params.meta.currency as CurrencyCode,
        direction: "INFLOW",
        frequency: "MONTHLY",
        merchant_name: merchantName,
        description,
        category_id: null,
        day_of_month: dayOfMonth,
        day_of_week: null,
        start_date: cc.payment_due_date,
        end_date: null,
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
  transactions: TransactionToImport[]
): Promise<Map<string, ReconciliationCandidate[]>> {
  const accountIds = [...new Set(transactions.map((tx) => tx.account_id))];
  if (accountIds.length === 0) return new Map();

  const dateValues = transactions.map((tx) => tx.transaction_date).sort();
  const from = dateValues[0];
  const to = dateValues[dateValues.length - 1];

  const { data, error } = await applyVisibleTransactionFilter(
    supabase
      .from("transactions")
      .select(
        "id, user_id, account_id, amount, direction, transaction_date, raw_description, merchant_name, clean_description, category_id, categorization_source, notes, reconciled_into_transaction_id, capture_method"
      )
      .in("account_id", accountIds)
      .in("capture_method", ["MANUAL_FORM", "TEXT_QUICK_CAPTURE"])
      .gte("transaction_date", from)
      .lte("transaction_date", to)
  );
  if (error) {
    const queryError = error as any;
    if (isMissingReconciliationColumnError(queryError) || queryError?.code === "42703") {
      return new Map();
    }
    throw queryError;
  }

  const grouped = new Map<string, ReconciliationCandidate[]>();
  for (const row of data ?? []) {
    const list = grouped.get(row.account_id) ?? [];
    list.push(row as ReconciliationCandidate);
    grouped.set(row.account_id, list);
  }
  return grouped;
}

export async function previewImportReconciliation(
  items: Array<{
    statementIndex: number;
    transactionIndex: number;
    importedTransaction: TransactionToImport;
  }>
): Promise<ReconciliationPreviewResult> {
  const { supabase } = await getAuthenticatedClient();
  const groupedCandidates = await fetchReconciliationCandidates(
    supabase,
    items.map((item) => item.importedTransaction)
  );
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
}): Promise<AccountUpdateResult[]> {
  const { supabase, userId, imported, skipped, statementMeta, details } = params;
  const accountUpdates: AccountUpdateResult[] = [];

  if (!statementMeta || statementMeta.length === 0) return accountUpdates;

  const uniqueAccountIds = [...new Set(statementMeta.map((m) => m.accountId))];
  const { data: accountRows } = await supabase
    .from("accounts")
    .select("id, name, currency_code, currency_balances, account_type")
    .eq("user_id", userId)
    .in("id", uniqueAccountIds);
  const accountMap = new Map(
    ((accountRows ?? []) as ImportedAccountRow[]).map((account) => [account.id, account])
  );

  const hasCreditCardMetadata = statementMeta.some((meta) => meta.creditCardMetadata);
  const recurringTemplateMap = new Map<string, RecurringTemplateSyncRow>();
  if (hasCreditCardMetadata) {
    const { data: recurringTemplates } = await supabase
      .from("recurring_transaction_templates")
      .select(RECURRING_TEMPLATE_SYNC_SELECT)
      .eq("user_id", userId)
      .in("account_id", uniqueAccountIds)
      .eq("direction", "INFLOW")
      .eq("frequency", "MONTHLY")
      .is("category_id", null)
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false });

    for (const template of (recurringTemplates ?? []) as RecurringTemplateSyncRow[]) {
      const key = buildRecurringTemplateKey(template.account_id, template.currency_code);
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

    const { data: prevSnapshot } = await supabase
      .from("statement_snapshots")
      .select("*")
      .eq("user_id", userId)
      .eq("account_id", meta.accountId)
      .eq("currency_code", meta.currency)
      .order("period_to", { ascending: false })
      .limit(1)
      .maybeSingle();

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

    if (existingSnapshot) {
      await supabase
        .from("statement_snapshots")
        .update(snapshotRow)
        .eq("id", existingSnapshot.id);
    } else {
      await supabase.from("statement_snapshots").insert(snapshotRow);
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
      currencyEntry.current_balance = meta.summary.final_balance;
    }

    const balances = pendingBalances.get(meta.accountId)!;
    balances[meta.currency] = currencyEntry;

    const account = accountMap.get(meta.accountId);
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
      if (ln.minimum_payment != null) accountUpdate.monthly_payment = ln.minimum_payment;
    } else if (
      !meta.creditCardMetadata &&
      !meta.loanMetadata &&
      meta.summary?.final_balance != null &&
      isPrimaryCurrency
    ) {
      accountUpdate.current_balance = meta.summary.final_balance;
    }

    accountUpdate.currency_balances = balances;

    await supabase.from("accounts").update(accountUpdate).eq("user_id", userId).eq("id", meta.accountId);

    const diffs = computeSnapshotDiffs(prevSnapshot, snapshotRow);
    accountUpdates.push({
      accountId: meta.accountId,
      accountName: account?.name ?? "",
      diffs,
      isFirstImport: !prevSnapshot,
    });

    if (meta.creditCardMetadata) {
      await syncCreditCardRecurringTemplate({
        supabase,
        userId,
        meta,
        account,
        prevSnapshot,
        existingTemplate: recurringTemplateMap.get(
          buildRecurringTemplateKey(meta.accountId, meta.currency)
        ),
        templateMap: recurringTemplateMap,
        details,
      });
    }
  }

  return accountUpdates;
}

export async function importTransactions(
  _prevState: ActionResult<ImportResult>,
  formData: FormData
): Promise<ActionResult<ImportResult>> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const parsed = parsePayload(formData);
  if (!parsed || !parsed.success) {
    await trackProductEvent({
      event_name: "import_completed",
      flow: "import",
      step: "persist",
      entry_point: "cta",
      success: false,
      error_code: "invalid_payload",
    });
    return { success: false, error: "Datos inválidos" };
  }

  const { transactions, statementMeta, reconciliationDecisions = [] } = parsed.data;
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

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let autoMerged = 0;
  let manualMerged = 0;
  let leftAsSeparate = 0;
  const details: string[] = [];

  for (const [txIndex, tx] of transactions.entries()) {
    // Use original_amount (full purchase price) for idempotency when available,
    // so re-imports of the same statement produce the same key regardless of
    // whether the parser previously used the full price or now uses the cuota.
    const idempotencyKey = await computeIdempotencyKey({
      provider: "OCR",
      transactionDate: tx.transaction_date,
      amount: tx.original_amount ?? tx.amount,
      rawDescription: tx.raw_description,
      installmentCurrent: tx.installment_current,
    });

    const { data: insertedTx, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: tx.account_id,
        amount: tx.amount,
        currency_code: tx.currency_code,
        direction: tx.direction,
        transaction_date: tx.transaction_date,
        raw_description: tx.raw_description,
        clean_description: tx.raw_description,
        idempotency_key: idempotencyKey,
        provider: "OCR",
        capture_method: "PDF_IMPORT",
        category_id: tx.category_id ?? null,
        notes: tx.notes ?? null,
        categorization_source: tx.categorization_source ?? "SYSTEM_DEFAULT",
        categorization_confidence: tx.categorization_confidence ?? null,
        status: "POSTED",
        installment_current: tx.installment_current ?? null,
        installment_total: tx.installment_total ?? null,
        installment_group_id: tx.installment_group_id ?? null,
        original_amount: tx.original_amount ?? null,
        destinatario_id: tx.destinatario_id ?? null,
        merchant_name: tx.merchant_name ?? null,
      })
      .select("id, category_id, notes")
      .single();

    if (error) {
      if (error.code === "23505") {
        skipped++;
      } else {
        errors++;
        details.push(`${tx.raw_description}: ${error.message}`);
      }
      continue;
    }

    imported++;

    const decision = tx.import_key
      ? decisionMap.get(tx.import_key)
      : decisionMap.get(buildDecisionKey(-1, txIndex));
    if (!decision || decision.decision === "KEEP_BOTH") {
      leftAsSeparate++;
      continue;
    }

    const { data: manualTx, error: manualTxError } = await applyVisibleTransactionFilter(
      supabase
        .from("transactions")
        .select(
          "id, user_id, account_id, amount, direction, transaction_date, raw_description, merchant_name, clean_description, category_id, categorization_source, notes, reconciled_into_transaction_id"
        )
        .eq("id", decision.candidateTransactionId)
    ).maybeSingle();
    if (manualTxError && !isMissingReconciliationColumnError(manualTxError)) {
      throw manualTxError;
    }

    if (!manualTx) {
      leftAsSeparate++;
      continue;
    }

    const merged = mergeTransactionMetadata(manualTx as ReconciliationCandidate, {
      category_id: insertedTx.category_id,
      notes: insertedTx.notes,
    });

    await supabase
      .from("transactions")
      .update({
        category_id: merged.category_id ?? null,
        notes: merged.notes ?? null,
        capture_method: merged.capture_method,
      })
      .eq("user_id", user.id)
      .eq("id", insertedTx.id);

    await supabase
      .from("transactions")
      .update({
        reconciled_into_transaction_id: insertedTx.id,
        reconciliation_score: decision.score,
      })
      .eq("user_id", user.id)
      .eq("id", manualTx.id);

    if (decision.decision === "AUTO_MERGE") autoMerged++;
    else manualMerged++;
  }

  // Auto-exclude manual balance adjustments covered by this import
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

  for (const [accountId, range] of accountDateRanges) {
    const { data: adjustments } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("account_id", accountId)
      .eq("is_excluded", false)
      .like("raw_description", "Ajuste manual de saldo%")
      .gte("transaction_date", range.min)
      .lte("transaction_date", range.max);

    if (adjustments && adjustments.length > 0) {
      const ids = adjustments.map((a) => a.id);
      await supabase
        .from("transactions")
        .update({ is_excluded: true })
        .eq("user_id", user.id)
        .in("id", ids);

      adjustmentsExcluded += ids.length;
    }
  }

  if (adjustmentsExcluded > 0) {
    details.push(`${adjustmentsExcluded} ajuste(s) manual(es) reemplazado(s) por transacciones del extracto`);
  }

  const accountUpdates = await processStatementMeta({
    supabase,
    userId: user.id,
    imported,
    skipped,
    statementMeta: normalizedStatementMeta,
    details,
  });

  revalidateTag("accounts", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
  revalidateTag("dashboard:accounts", "zeta");
  revalidateTag("dashboard:cashflow", "zeta");
  revalidateTag("categorize", "zeta");
  revalidateTag("snapshots", "zeta");
  revalidateTag("debt", "zeta");
  revalidateTag("budgets", "zeta");

  await trackProductEvent({
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
  });

  if (autoMerged > 0) {
    await trackProductEvent({
      event_name: "reconciliation_auto_merge_applied",
      flow: "import",
      step: "persist",
      entry_point: "cta",
      success: true,
      metadata: {
        matches_auto: autoMerged,
      },
    });
  }

  if (manualMerged > 0) {
    await trackProductEvent({
      event_name: "reconciliation_manual_merge_confirmed",
      flow: "import",
      step: "persist",
      entry_point: "cta",
      success: true,
      metadata: {
        matches_review: manualMerged,
      },
    });
  }

  if (leftAsSeparate > 0) {
    await trackProductEvent({
      event_name: "reconciliation_match_rejected",
      flow: "import",
      step: "persist",
      entry_point: "cta",
      success: true,
      metadata: {
        matches_rejected: leftAsSeparate,
      },
    });
  }

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
