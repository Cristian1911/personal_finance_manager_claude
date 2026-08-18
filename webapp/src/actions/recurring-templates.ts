"use server";

import { updateTag, cacheTag, cacheLife } from "next/cache";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { flowClassColumns } from "@/lib/utils/flow-class-columns";
import { recurringTemplateSchema } from "@/lib/validators/recurring-template";
import { parseSubPayments } from "@/lib/utils/sub-payments";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { applyAccountBalanceDelta, isDebtAccountType } from "@/lib/utils/account-balance";
import {
  buildDebtBalanceUpdatePayload,
  deactivateTemplatesForPaidOffAccount,
} from "@/lib/debt/payoff";
import { toMonthlyAmount } from "@/lib/utils/recurring";
import { ensureCurrentOccurrences, ensureOccurrencesForRange, linkTransactionToOccurrence } from "@/actions/occurrences";
import { syncPendingOccurrenceAmounts } from "@/lib/utils/occurrence-sync";
import {
  getOccurrencesBetween,
  getNextOccurrence,
  TRANSFER_CATEGORY_ID,
  getDebtPaymentCategoryId,
} from "@zeta/shared";
import { addDays, endOfMonth, startOfMonth } from "date-fns";
import { toISODateString } from "@/lib/utils/date";
import { upsertSubscriptionFromTemplate } from "@/actions/subscriptions";
import { z } from "zod";
import { uuidStr } from "@/lib/validators/shared";
import type { ActionResult } from "@/types/actions";
import type { Database } from "@/types/database";
import type {
  RecurringTemplate,
  RecurringTemplateWithRelations,
  SubPayment,
  UpcomingRecurrence,
} from "@/types/domain";

const TEMPLATE_SELECT = `
  *,
  account:accounts!recurring_transaction_templates_account_id_fkey(id, name, icon, color, account_type, currency_code, mask, bank_key),
  category:categories!recurring_transaction_templates_category_id_fkey(id, name, name_es, icon, color),
  transfer_source_account:accounts!recurring_transaction_templates_transfer_source_account_id_fkey(id, name, account_type, currency_code)
`;

export async function computeRecurringGroupUuid(templateId: string, occurrenceDate: string) {
  const payload = `${templateId}|${occurrenceDate}`;
  const data = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer).slice(0, 16));

  // Force RFC-compatible version/variant bits so Postgres UUID parsing accepts it.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// ─── Cached inner functions ───────────────────────────────────────────────────

async function getRecurringTemplatesCached(
  userId: string,
  accessToken: string
): Promise<RecurringTemplateWithRelations[]> {
  "use cache";
  cacheTag("recurring");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("recurring_transaction_templates")
    .select(TEMPLATE_SELECT)
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("merchant_name");

  if (error) throw error;
  return (data ?? []) as RecurringTemplateWithRelations[];
}

async function getRecurringTemplateCached(
  userId: string,
  id: string,
  accessToken: string
): Promise<RecurringTemplateWithRelations> {
  "use cache";
  cacheTag("recurring");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("recurring_transaction_templates")
    .select(TEMPLATE_SELECT)
    .eq("user_id", userId)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as RecurringTemplateWithRelations;
}

async function getUpcomingRecurrencesCached(
  userId: string,
  days: number,
  todayStr: string,
  accessToken: string
): Promise<UpcomingRecurrence[]> {
  "use cache";
  cacheTag("recurring", "occurrences");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const now = new Date(`${todayStr}T00:00:00`);
  const rangeEnd = addDays(now, days);
  const rangeEndStr = toISODateString(rangeEnd);

  // Read pending occurrences directly — the materialized table is the source
  // of truth. Computing dates in JS from active templates would silently
  // drift after merges or schedule edits.
  // !inner + template.is_active filter pushes the paused-template exclusion
  // down to PostgREST so we don't ship rows we'd discard in JS.
  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select(`
      occurrence_date,
      template:recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner(
        ${TEMPLATE_SELECT}
      )
    `)
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("template.is_active", true)
    .gte("occurrence_date", todayStr)
    .lte("occurrence_date", rangeEndStr)
    .order("occurrence_date");

  if (error) throw error;

  const upcoming: UpcomingRecurrence[] = [];
  for (const row of data ?? []) {
    const template = row.template as RecurringTemplateWithRelations | null;
    if (!template) continue;
    upcoming.push({ template, next_date: row.occurrence_date });
  }

  return upcoming;
}

async function getRecurringSummaryCached(
  userId: string,
  todayStr: string,
  accessToken: string,
): Promise<{
  totalMonthlyExpenses: number;
  totalMonthlyIncome: number;
  activeCount: number;
  overdueCount: number;
}> {
  "use cache";
  cacheTag("recurring");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const [templatesRes, overdueRes] = await Promise.all([
    supabase
      .from("recurring_transaction_templates")
      .select("amount, direction, frequency, accounts!recurring_transaction_templates_account_id_fkey(account_type)")
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase
      .from("recurring_occurrences")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending")
      .lt("occurrence_date", todayStr),
  ]);

  const templates = templatesRes.data;
  const overdueCount = overdueRes.count ?? 0;

  if (!templates)
    return { totalMonthlyExpenses: 0, totalMonthlyIncome: 0, activeCount: 0, overdueCount };

  let totalMonthlyExpenses = 0;
  let totalMonthlyIncome = 0;

  for (const t of templates) {
    const monthlyAmount = toMonthlyAmount(t.amount, t.frequency);
    const accountType = (t.accounts as { account_type?: string } | null)?.account_type;
    // "Abono a deuda" = an INFLOW on a debt account; an OUTFLOW debt charge is a
    // plain expense caught by the `t.direction === "OUTFLOW"` clause below.
    const isDebtPayment = !!accountType && isDebtAccountType(accountType) && t.direction === "INFLOW";
    if (t.direction === "OUTFLOW" || isDebtPayment) {
      totalMonthlyExpenses += monthlyAmount;
    } else {
      totalMonthlyIncome += monthlyAmount;
    }
  }

  return {
    totalMonthlyExpenses,
    totalMonthlyIncome,
    activeCount: templates.length,
    overdueCount,
  };
}

// ─── Public wrappers ──────────────────────────────────────────────────────────

export async function getRecurringTemplates(): Promise<
  ActionResult<RecurringTemplateWithRelations[]>
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getRecurringTemplatesCached(user.id, accessToken);
    return { success: true, data };
  } catch (error) {
    console.error("Error loading recurring templates:", error);
    return { success: false, error: "Error al cargar las plantillas recurrentes" };
  }
}

export async function getRecurringTemplate(
  id: string
): Promise<ActionResult<RecurringTemplateWithRelations>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getRecurringTemplateCached(user.id, id, accessToken);
    return { success: true, data };
  } catch (error) {
    console.error("Error loading recurring template:", error);
    return { success: false, error: "Error al cargar la plantilla recurrente" };
  }
}

// Normalizes a parsed template payload against its account type. On a debt
// account the template's direction is the discriminator:
//   • INFLOW  → "Abono a deuda": paid as a transfer from a source account.
//   • OUTFLOW → "Gasto con la tarjeta": a recurring charge billed to the card
//     that increases the debt — no transfer source.
// Mutates `payload` in place. Returns an error message, or null when valid.
function normalizeDebtTemplatePayload(
  payload: {
    account_id: string;
    direction: "INFLOW" | "OUTFLOW";
    category_id?: string | null;
    transfer_source_account_id?: string | null;
  },
  accountType: string,
): string | null {
  if (isDebtAccountType(accountType) && payload.direction === "INFLOW") {
    payload.category_id = payload.category_id ?? getDebtPaymentCategoryId(accountType);
    if (!payload.transfer_source_account_id) {
      return "Selecciona la cuenta origen para el pago de deuda.";
    }
    if (payload.transfer_source_account_id === payload.account_id) {
      return "La cuenta origen no puede ser la misma cuenta de deuda.";
    }
  } else {
    // Non-debt template, or an OUTFLOW charge on a debt account — no transfer.
    payload.transfer_source_account_id = null;
  }
  return null;
}

// Shared body for the two create-template actions. Parses + validates form
// data, verifies the account, applies DEBT-account normalization, and inserts.
// Omits sub_payments when null to sidestep stale PostgREST schema caches.
async function insertRecurringTemplateFromFormData(
  formData: FormData,
  user: { id: string },
  supabase: SupabaseClient<Database>,
): Promise<ActionResult<RecurringTemplate>> {
  const parsed = recurringTemplateSchema.safeParse({
    account_id: formData.get("account_id"),
    transfer_source_account_id: formData.get("transfer_source_account_id") || undefined,
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code"),
    direction: formData.get("direction"),
    frequency: formData.get("frequency"),
    merchant_name: formData.get("merchant_name"),
    description: formData.get("description") || undefined,
    category_id: formData.get("category_id") || undefined,
    destinatario_id: formData.get("destinatario_id") || undefined,
    day_of_month: formData.get("day_of_month") || undefined,
    day_of_week: formData.get("day_of_week") || undefined,
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date") || undefined,
    sub_payments: formData.get("sub_payments") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { sub_payments, ...payload } = parsed.data;
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, account_type")
    .eq("id", payload.account_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError || !account) {
    return { success: false, error: "Cuenta inválida para este usuario." };
  }

  const debtError = normalizeDebtTemplatePayload(payload, account.account_type);
  if (debtError) return { success: false, error: debtError };

  const subPaymentsValue = sub_payments && sub_payments.length > 0
    ? (sub_payments as unknown as Database["public"]["Tables"]["recurring_transaction_templates"]["Row"]["sub_payments"])
    : null;

  const insertPayload: Database["public"]["Tables"]["recurring_transaction_templates"]["Insert"] = {
    user_id: user.id,
    ...payload,
    ...(subPaymentsValue !== null ? { sub_payments: subPaymentsValue } : {}),
  };

  const { data, error } = await supabase
    .from("recurring_transaction_templates")
    .insert(insertPayload)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function createRecurringTemplate(
  _prevState: ActionResult<RecurringTemplate>,
  formData: FormData
): Promise<ActionResult<RecurringTemplate>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Validate BEFORE writing — a post-insert error would leave an orphan
  // template that duplicates on retry.
  const isSubscription = formData.get("is_subscription") === "true";
  if (isSubscription && !formData.get("destinatario_id")) {
    return { success: false, error: "Una suscripción necesita un destinatario." };
  }

  const result = await insertRecurringTemplateFromFormData(formData, user, supabase);
  if (!result.success) return result;

  await upsertSubscriptionFromTemplate(
    supabase,
    user.id,
    { id: result.data.id, destinatario_id: result.data.destinatario_id, currency_code: result.data.currency_code },
    isSubscription,
  );

  await ensureCurrentOccurrences();
  // Full fan-out: a new template affects charts, budgets, debt projections,
  // and account metrics — not just recurring/occurrences.
  revalidateFinancialViews();
  return result;
}

export async function createRecurringTemplateFromTransaction(
  transactionId: string,
  _prevState: ActionResult<RecurringTemplate>,
  formData: FormData,
): Promise<ActionResult<RecurringTemplate>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Tx lookup + existing-link check in parallel — both only need user.id.
  // Link column lives on the occurrence side (recurring_occurrences.transaction_id).
  const [txRes, linkRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, account_id, amount, direction, transaction_date, destinatario_id")
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("recurring_occurrences")
      .select("id")
      .eq("transaction_id", transactionId)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (txRes.error || !txRes.data) {
    return { success: false, error: "Transacción no encontrada" };
  }
  if (linkRes.data) {
    return { success: false, error: "Esta transacción ya está vinculada a una recurrente." };
  }

  const tx = txRes.data;
  const result = await insertRecurringTemplateFromFormData(formData, user, supabase);
  if (!result.success) return result;

  // Widen the generator window to cover the tx's date — otherwise a tx from
  // a previous month fails to auto-link (findMatchingOccurrence uses ±3 days
  // around tx.transaction_date). linkTransactionToOccurrence → markOccurrencePaid
  // flips the occurrence to paid; no-op when no match.
  const txDate = new Date(`${tx.transaction_date}T12:00:00`);
  const now = new Date();
  const rangeStart = startOfMonth(txDate < now ? txDate : now);
  const rangeEnd = addDays(endOfMonth(now), 14);
  await ensureOccurrencesForRange(rangeStart, rangeEnd);
  // Use the saved template's destinatario_id (the user's final pick), not the
  // tx's own. If the user changed the picker mid-promote, matching on the old
  // tx destinatario would miss the anchored primary pass.
  await linkTransactionToOccurrence(
    tx.account_id,
    tx.transaction_date,
    tx.amount,
    tx.direction,
    tx.id,
    result.data.destinatario_id ?? null,
  );

  revalidateFinancialViews();
  return result;
}

export async function updateRecurringTemplate(
  id: string,
  _prevState: ActionResult<RecurringTemplate>,
  formData: FormData
): Promise<ActionResult<RecurringTemplate>> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const parsed = recurringTemplateSchema.safeParse({
    account_id: formData.get("account_id"),
    transfer_source_account_id: formData.get("transfer_source_account_id") || undefined,
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code"),
    direction: formData.get("direction"),
    frequency: formData.get("frequency"),
    merchant_name: formData.get("merchant_name"),
    description: formData.get("description") || undefined,
    category_id: formData.get("category_id") || undefined,
    destinatario_id: formData.get("destinatario_id") || undefined,
    day_of_month: formData.get("day_of_month") || undefined,
    day_of_week: formData.get("day_of_week") || undefined,
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date") || undefined,
    sub_payments: formData.get("sub_payments") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { sub_payments, ...payload } = parsed.data;
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, account_type")
    .eq("id", payload.account_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError || !account) {
    return { success: false, error: "Cuenta inválida para este usuario." };
  }

  const debtError = normalizeDebtTemplatePayload(payload, account.account_type);
  if (debtError) return { success: false, error: debtError };

  const subPaymentsValue = sub_payments && sub_payments.length > 0
    ? (sub_payments as unknown as Database["public"]["Tables"]["recurring_transaction_templates"]["Row"]["sub_payments"])
    : null;

  // Omit sub_payments when null — sidesteps stale PostgREST schema caches.
  const updatePayload: Database["public"]["Tables"]["recurring_transaction_templates"]["Update"] = {
    ...payload,
    ...(subPaymentsValue !== null ? { sub_payments: subPaymentsValue } : {}),
  };

  // Validate BEFORE writing — a post-update error would persist the change
  // while skipping occurrence regeneration and cache revalidation.
  const isSubscription = formData.get("is_subscription") === "true";
  if (isSubscription && !payload.destinatario_id) {
    return { success: false, error: "Una suscripción necesita un destinatario." };
  }

  const { data, error } = await supabase
    .from("recurring_transaction_templates")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await upsertSubscriptionFromTemplate(
    supabase,
    user.id,
    { id: data.id, destinatario_id: data.destinatario_id, currency_code: data.currency_code },
    isSubscription,
  );

  await ensureCurrentOccurrences();

  // Realign pending occurrences to the edited amount — ensureCurrentOccurrences
  // uses ON CONFLICT DO NOTHING, so an already-generated pending occurrence
  // would otherwise keep its stale expected_amount and diverge from the template.
  await syncPendingOccurrenceAmounts(supabase, user.id, data.id, Number(data.amount));

  // Full fan-out: template edits affect charts, budgets, debt projections,
  // and account metrics — not just recurring/occurrences.
  revalidateFinancialViews();
  return { success: true, data };
}

export async function deleteRecurringTemplate(
  id: string
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("recurring_transaction_templates")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  updateTag("recurring");
  updateTag("occurrences");
  updateTag("dashboard:hero");
  updateTag("attention");
  return { success: true, data: undefined };
}

export async function toggleRecurringTemplate(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("recurring_transaction_templates")
    .update({ is_active: isActive })
    .eq("user_id", user.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  await ensureCurrentOccurrences();

  updateTag("recurring");
  updateTag("occurrences");
  updateTag("dashboard:hero");
  updateTag("attention");
  return { success: true, data: undefined };
}

const recurringOccurrencePaymentSchema = z.object({
  templateId: uuidStr("ID de plantilla invalido"),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  actualAmount: z.coerce.number().positive(),
  sourceAccountId: uuidStr("ID de cuenta invalido").nullable().optional(),
});

type ServerSupabase = SupabaseClient<Database>;
type RecurringOccurrencePaymentInput = z.infer<typeof recurringOccurrencePaymentSchema>;
type RecurringPaymentTemplate = {
  id: string;
  user_id: string;
  account_id: string;
  transfer_source_account_id: string | null;
  amount: number;
  currency_code: Database["public"]["Enums"]["currency_code"];
  direction: "INFLOW" | "OUTFLOW";
  merchant_name: string | null;
  description: string | null;
  category_id: string | null;
  start_date: string;
  end_date: string | null;
  frequency: Database["public"]["Enums"]["recurrence_frequency"];
  account: {
    id: string;
    name: string;
    account_type: string;
  };
};
type PaymentAccountRow = {
  id: string;
  name: string;
  account_type: string;
  current_balance: number;
  credit_limit: number | null;
  currency_balances: Record<string, Record<string, unknown>> | null;
};
type RecurringTxDraft = {
  account_id: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  raw_description: string;
  merchant_name: string;
  category_id: string | null;
  notes: string;
  /** Type of the account this leg is recorded against. */
  account_type: string | null;
  /**
   * Type of the other leg's account. A debt-payment template emits two legs
   * that share no transfer_group_id, so without this the outflow leg would be
   * classified from its wording alone — "Transferencia a X" reads as a plain
   * SELF_TRANSFER at 0.7 when it is structurally a DEBT_PAYMENT.
   */
  counterpart_account_type?: string | null;
};
type CreatedTxDelta = {
  account_id: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
};

async function fetchRecurringPaymentTemplate(params: {
  supabase: ServerSupabase;
  templateId: string;
  userId: string;
}): Promise<RecurringPaymentTemplate | null> {
  const { data } = await params.supabase
    .from("recurring_transaction_templates")
    .select(
      `id, user_id, account_id, transfer_source_account_id, amount, currency_code, direction, merchant_name, description, category_id, start_date, end_date, frequency,
       account:accounts!recurring_transaction_templates_account_id_fkey(id, name, account_type)`
    )
    .eq("id", params.templateId)
    .eq("user_id", params.userId)
    .single();

  return (data as RecurringPaymentTemplate | null) ?? null;
}

function validateOccurrenceMatchesTemplate(
  template: RecurringPaymentTemplate,
  occurrenceDate: string
): string | null {
  const targetDate = new Date(`${occurrenceDate}T12:00:00`);
  const occurrences = getOccurrencesBetween(
    template.start_date,
    template.frequency,
    template.end_date,
    targetDate,
    targetDate
  );
  if (!occurrences.includes(occurrenceDate)) {
    return "La fecha no coincide con la recurrencia de la plantilla.";
  }
  return null;
}

function resolveSourceAccountSelection(params: {
  template: RecurringPaymentTemplate;
  sourceAccountId?: string | null;
}): {
  isDebtPaymentTemplate: boolean;
  effectiveSourceAccountId: string | null;
  error: string | null;
} {
  // Only an INFLOW template on a debt account is an "abono" (transfer). An
  // OUTFLOW template on a debt account is a recurring charge billed to the
  // card — a single transaction, no source account.
  const isDebtPaymentTemplate =
    isDebtAccountType(params.template.account.account_type) &&
    params.template.direction === "INFLOW";
  const effectiveSourceAccountId =
    params.sourceAccountId ?? params.template.transfer_source_account_id ?? null;

  if (isDebtPaymentTemplate && !effectiveSourceAccountId) {
    return {
      isDebtPaymentTemplate,
      effectiveSourceAccountId,
      error: "Debes indicar la cuenta origen para registrar el pago de deuda.",
    };
  }
  if (isDebtPaymentTemplate && effectiveSourceAccountId === params.template.account_id) {
    return {
      isDebtPaymentTemplate,
      effectiveSourceAccountId,
      error: "La cuenta origen no puede ser la misma cuenta de deuda.",
    };
  }

  return { isDebtPaymentTemplate, effectiveSourceAccountId, error: null };
}

async function persistTemplateSourceAccountIfNeeded(params: {
  supabase: ServerSupabase;
  userId: string;
  template: RecurringPaymentTemplate;
  isDebtPaymentTemplate: boolean;
  effectiveSourceAccountId: string | null;
}): Promise<void> {
  if (
    params.isDebtPaymentTemplate &&
    params.effectiveSourceAccountId &&
    params.effectiveSourceAccountId !== params.template.transfer_source_account_id
  ) {
    await params.supabase
      .from("recurring_transaction_templates")
      .update({ transfer_source_account_id: params.effectiveSourceAccountId })
      .eq("id", params.template.id)
      .eq("user_id", params.userId);
  }
}

async function loadPaymentAccounts(params: {
  supabase: ServerSupabase;
  userId: string;
  targetAccountId: string;
  effectiveSourceAccountId: string | null;
}): Promise<{
  accountMap: Map<string, PaymentAccountRow> | null;
  targetAccount: PaymentAccountRow | null;
  error: string | null;
}> {
  const accountIds = [
    params.targetAccountId,
    ...(params.effectiveSourceAccountId ? [params.effectiveSourceAccountId] : []),
  ];

  const { data: accountRows, error } = await params.supabase
    .from("accounts")
    .select("id, name, account_type, current_balance, credit_limit, currency_balances")
    .in("id", accountIds)
    .eq("user_id", params.userId);

  if (error || !accountRows) {
    return {
      accountMap: null,
      targetAccount: null,
      error: "No se pudieron cargar las cuentas involucradas.",
    };
  }

  const accountMap = new Map(
    (accountRows as PaymentAccountRow[]).map((acc) => [acc.id, acc])
  );
  const targetAccount = accountMap.get(params.targetAccountId) ?? null;

  if (!targetAccount) {
    return {
      accountMap: null,
      targetAccount: null,
      error: "No se encontró la cuenta destino del pago.",
    };
  }

  return { accountMap, targetAccount, error: null };
}

function buildRecurringPaymentTransactions(params: {
  template: RecurringPaymentTemplate;
  actualAmount: number;
  isDebtPaymentTemplate: boolean;
  effectiveSourceAccountId: string | null;
  targetAccount: PaymentAccountRow;
  accountMap: Map<string, PaymentAccountRow>;
}): { txs: RecurringTxDraft[] | null; error: string | null } {
  const baseLabel =
    params.template.merchant_name || params.template.description || "Pago recurrente";

  if (params.isDebtPaymentTemplate) {
    const sourceAccount = params.effectiveSourceAccountId
      ? params.accountMap.get(params.effectiveSourceAccountId)
      : null;

    if (!sourceAccount) {
      return {
        txs: null,
        error: "No se encontró la cuenta origen para esta transferencia.",
      };
    }

    return {
      txs: [
        {
          account_id: sourceAccount.id,
          amount: params.actualAmount,
          direction: "OUTFLOW",
          raw_description: `Transferencia a ${params.targetAccount.name} - ${baseLabel}`,
          merchant_name: `Transferencia a ${params.targetAccount.name}`,
          category_id: TRANSFER_CATEGORY_ID,
          notes: "Pago recurrente marcado desde checklist",
          account_type: sourceAccount.account_type,
          counterpart_account_type: params.targetAccount.account_type,
        },
        {
          account_id: params.targetAccount.id,
          amount: params.actualAmount,
          direction: "INFLOW",
          raw_description: `Abono deuda desde ${sourceAccount.name} - ${baseLabel}`,
          merchant_name: baseLabel,
          category_id: params.template.category_id ?? getDebtPaymentCategoryId(params.targetAccount.account_type),
          notes: "Abono de deuda marcado desde checklist recurrente",
          account_type: params.targetAccount.account_type,
          counterpart_account_type: sourceAccount.account_type,
        },
      ],
      error: null,
    };
  }

  return {
    txs: [
      {
        account_id: params.template.account_id,
        amount: params.actualAmount,
        direction: params.template.direction,
        raw_description: baseLabel,
        merchant_name: baseLabel,
        category_id: params.template.category_id,
        notes: "Transacción recurrente marcada desde checklist",
        account_type:
          params.accountMap.get(params.template.account_id)?.account_type ?? null,
      },
    ],
    error: null,
  };
}

async function insertRecurringTransactions(params: {
  supabase: ServerSupabase;
  userId: string;
  template: RecurringPaymentTemplate;
  payload: RecurringOccurrencePaymentInput;
  effectivePaymentDate: string;
  recurrenceGroupId: string;
  txs: RecurringTxDraft[];
}): Promise<{
  created: number;
  alreadyRecorded: number;
  createdTxs: CreatedTxDelta[];
  error: string | null;
}> {
  let created = 0;
  let alreadyRecorded = 0;
  const createdTxs: CreatedTxDelta[] = [];

  for (const tx of params.txs) {
    const recurrenceIdentity =
      `${params.template.id}|${params.payload.occurrenceDate}|${tx.account_id}|${tx.direction}`;
    const idempotencyKey = await computeIdempotencyKey({
      provider: "RECURRING_CHECKLIST",
      providerTransactionId: recurrenceIdentity,
      transactionDate: params.payload.occurrenceDate,
      amount: tx.amount,
      rawDescription: tx.raw_description,
    });

    const { error } = await params.supabase.from("transactions").insert({
      user_id: params.userId,
      account_id: tx.account_id,
      amount: tx.amount,
      currency_code: params.template.currency_code,
      direction: tx.direction,
      transaction_date: params.effectivePaymentDate,
      raw_description: tx.raw_description,
      clean_description: tx.merchant_name,
      merchant_name: tx.merchant_name,
      category_id: tx.category_id,
      notes: tx.notes,
      idempotency_key: idempotencyKey,
      provider: "MANUAL",
      status: "POSTED",
      capture_method: "MANUAL_FORM",
      is_recurring: true,
      recurrence_group_id: params.recurrenceGroupId,
      categorization_source: tx.category_id ? "USER_CREATED" : "SYSTEM_DEFAULT",
      // The two legs of a debt-payment template share no transfer_group_id, so
      // the linked branch does not apply. matchedAccountType is the right input
      // and says literally what is true: money leaving a liquid account toward
      // an account this user owns and owes on. The INFLOW leg needs nothing —
      // its own account being a card or loan already settles it.
      ...flowClassColumns({
        direction: tx.direction,
        accountType: tx.account_type,
        description: tx.merchant_name || tx.raw_description,
        matchedAccountType: tx.counterpart_account_type,
      }),
    });

    if (error) {
      if (error.code === "23505") {
        alreadyRecorded++;
        continue;
      }
      return { created, alreadyRecorded, createdTxs, error: error.message };
    }

    created++;
    createdTxs.push({
      account_id: tx.account_id,
      amount: tx.amount,
      direction: tx.direction,
    });
  }

  return { created, alreadyRecorded, createdTxs, error: null };
}

async function updateBalancesForCreatedTransactions(params: {
  supabase: ServerSupabase;
  userId: string;
  accountMap: Map<string, PaymentAccountRow>;
  createdTxs: CreatedTxDelta[];
  currencyCode: string;
}): Promise<void> {
  for (const tx of params.createdTxs) {
    const account = params.accountMap.get(tx.account_id);
    if (!account) continue;

    const nextBalance = applyAccountBalanceDelta({
      currentBalance: account.current_balance,
      accountType: account.account_type,
      direction: tx.direction,
      amount: tx.amount,
    });

    account.current_balance = nextBalance;

    const updatePayload: Record<string, unknown> = isDebtAccountType(account.account_type)
      ? buildDebtBalanceUpdatePayload(account, nextBalance, params.currencyCode)
      : { current_balance: nextBalance };
    if (
      isDebtAccountType(account.account_type) &&
      account.currency_balances &&
      !account.currency_balances[params.currencyCode]
    ) {
      console.warn(
        "[updateBalancesForCreatedTransactions] currency_balances missing key — /deudas may read stale debt",
        { accountId: account.id, currencyCode: params.currencyCode }
      );
    }

    const { error: balanceError } = await params.supabase
      .from("accounts")
      .update(updatePayload)
      .eq("id", account.id)
      .eq("user_id", params.userId);

    if (balanceError) {
      console.error(
        "[updateBalancesForCreatedTransactions] balance update failed",
        { accountId: account.id, error: balanceError.message }
      );
      continue;
    }

    // Payoff lifecycle: a debt that just reached 0 stops generating cuotas.
    if (isDebtAccountType(account.account_type) && nextBalance <= 0) {
      await deactivateTemplatesForPaidOffAccount({
        supabase: params.supabase,
        userId: params.userId,
        accountId: account.id,
      });
    }
  }
}

export async function recordRecurringOccurrencePayment(input: {
  templateId: string;
  occurrenceDate: string;
  paymentDate?: string;
  actualAmount: number;
  sourceAccountId?: string | null;
}): Promise<ActionResult<{ created: number; alreadyRecorded: number }>> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const parsed = recurringOccurrencePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const payload = parsed.data;
  const template = await fetchRecurringPaymentTemplate({
    supabase,
    templateId: payload.templateId,
    userId: user.id,
  });
  if (!template) {
    return { success: false, error: "No se encontró la plantilla recurrente." };
  }

  let occurrenceValidationError = validateOccurrenceMatchesTemplate(
    template,
    payload.occurrenceDate
  );
  if (occurrenceValidationError) {
    // Schedule math is not the source of truth for dates: a materialized
    // occurrence can sit off-schedule on purpose (MONTHLY days drift via
    // statement imports and the generator's prune exclusion keeps them).
    // Accept any date that exists as a real occurrence row for the template —
    // callers resolving the date from planning_entries.occurrence_id land
    // here when the linked occurrence drifted.
    const { data: materialized } = await supabase
      .from("recurring_occurrences")
      .select("id")
      .eq("user_id", user.id)
      .eq("template_id", payload.templateId)
      .eq("occurrence_date", payload.occurrenceDate)
      .limit(1)
      .maybeSingle();
    if (materialized) occurrenceValidationError = null;
  }
  if (occurrenceValidationError) {
    return { success: false, error: occurrenceValidationError };
  }

  const sourceSelection = resolveSourceAccountSelection({
    template,
    sourceAccountId: payload.sourceAccountId,
  });
  if (sourceSelection.error) {
    return { success: false, error: sourceSelection.error };
  }

  await persistTemplateSourceAccountIfNeeded({
    supabase,
    userId: user.id,
    template,
    isDebtPaymentTemplate: sourceSelection.isDebtPaymentTemplate,
    effectiveSourceAccountId: sourceSelection.effectiveSourceAccountId,
  });

  const loadedAccounts = await loadPaymentAccounts({
    supabase,
    userId: user.id,
    targetAccountId: template.account_id,
    effectiveSourceAccountId: sourceSelection.effectiveSourceAccountId,
  });
  if (loadedAccounts.error || !loadedAccounts.accountMap || !loadedAccounts.targetAccount) {
    return { success: false, error: loadedAccounts.error ?? "No se pudieron cargar las cuentas involucradas." };
  }

  const builtTxs = buildRecurringPaymentTransactions({
    template,
    actualAmount: payload.actualAmount,
    isDebtPaymentTemplate: sourceSelection.isDebtPaymentTemplate,
    effectiveSourceAccountId: sourceSelection.effectiveSourceAccountId,
    targetAccount: loadedAccounts.targetAccount,
    accountMap: loadedAccounts.accountMap,
  });
  if (builtTxs.error || !builtTxs.txs) {
    return { success: false, error: builtTxs.error ?? "No se pudieron construir las transacciones del pago." };
  }

  const effectivePaymentDate = payload.paymentDate ?? payload.occurrenceDate;
  const recurrenceGroupId = await computeRecurringGroupUuid(
    template.id,
    payload.occurrenceDate
  );

  const inserted = await insertRecurringTransactions({
    supabase,
    userId: user.id,
    template,
    payload,
    effectivePaymentDate,
    recurrenceGroupId,
    txs: builtTxs.txs,
  });
  if (inserted.error) {
    return { success: false, error: inserted.error };
  }

  // Mark the matching occurrence as paid and propagate template tags.
  if (inserted.created > 0) {
    // Get all created transaction IDs via the known recurrence_group_id
    const { data: createdRows } = await supabase
      .from("transactions")
      .select("id")
      .eq("recurrence_group_id", recurrenceGroupId)
      .eq("user_id", user.id);

    const createdIds = (createdRows ?? []).map((r) => r.id);

    if (createdIds.length > 0) {
      await supabase
        .from("recurring_occurrences")
        .update({
          status: "paid" as const,
          transaction_id: createdIds[0],
          paid_at: new Date().toISOString(),
        })
        .eq("template_id", payload.templateId)
        .eq("occurrence_date", payload.occurrenceDate)
        .eq("user_id", user.id)
        .eq("status", "pending");

      // Copy template tags onto every created transaction.
      const { data: tagRows } = await supabase
        .from("recurring_template_tags")
        .select("tag_id")
        .eq("recurring_template_id", payload.templateId)
        .eq("user_id", user.id);

      const tagIds = (tagRows ?? []).map((r) => r.tag_id);
      if (tagIds.length > 0) {
        const joinRows = createdIds.flatMap((txId) =>
          tagIds.map((tagId) => ({
            transaction_id: txId,
            tag_id: tagId,
            user_id: user.id,
          })),
        );
        const { error: tagUpsertErr } = await supabase
          .from("transaction_tags")
          .upsert(joinRows, { onConflict: "transaction_id,tag_id", ignoreDuplicates: true });
        if (tagUpsertErr) {
          // Soft failure: occurrence is already marked paid and transactions exist.
          // Tags are secondary metadata — log and continue rather than rolling back.
          console.error(
            "Failed to copy recurring template tags to transactions:",
            tagUpsertErr.message,
          );
        } else {
          updateTag("tags");
        }
      }
    }
  }

  await updateBalancesForCreatedTransactions({
    supabase,
    userId: user.id,
    accountMap: loadedAccounts.accountMap,
    createdTxs: inserted.createdTxs,
    currencyCode: template.currency_code,
  });

  revalidateFinancialViews();
  updateTag("occurrences");
  updateTag("recurring");
  updateTag("impact");
  updateTag("cashflow-planner");

  return {
    success: true,
    data: {
      created: inserted.created,
      alreadyRecorded: inserted.alreadyRecorded,
    },
  };
}

/**
 * Get upcoming recurring payments for the next N days, sourced from the
 * materialized recurring_occurrences table.
 */
export async function getUpcomingRecurrences(
  days: number = 30
): Promise<UpcomingRecurrence[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];

  // Make sure pending rows exist for the lookahead window before reading.
  const now = new Date();
  await ensureOccurrencesForRange(now, addDays(now, days));

  return getUpcomingRecurrencesCached(user.id, days, toISODateString(now), accessToken);
}

/**
 * Get monthly totals for active recurring templates.
 */
export async function getRecurringSummary(): Promise<{
  totalMonthlyExpenses: number;
  totalMonthlyIncome: number;
  activeCount: number;
  overdueCount: number;
}> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken)
    return { totalMonthlyExpenses: 0, totalMonthlyIncome: 0, activeCount: 0, overdueCount: 0 };
  return getRecurringSummaryCached(user.id, toISODateString(new Date()), accessToken);
}

// ─── Impact preview ──────────────────────────────────────────────────────────

export interface TemplateImpact {
  pendingCount: number;
  pendingTotal: number;
  within14Days: { count: number; total: number };
  planningEntriesCount: number;
  nextOccurrenceDate: string | null;
  monthlyAmount: number;
  direction: "INFLOW" | "OUTFLOW";
  templateName: string;
}

export async function getRecurringTemplateImpact(
  templateId: string
): Promise<ActionResult<TemplateImpact>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const idCheck = uuidStr("ID de plantilla inválido").safeParse(templateId);
  if (!idCheck.success) return { success: false, error: idCheck.error.issues[0].message };

  try {
    const now = new Date();
    const today = toISODateString(now);
    const in14Days = toISODateString(addDays(now, 14));

    const [templateRes, occurrencesRes, planningRes] = await Promise.all([
      supabase
        .from("recurring_transaction_templates")
        .select("id, merchant_name, description, amount, direction, frequency, start_date, end_date, account:accounts!recurring_transaction_templates_account_id_fkey(account_type)")
        .eq("id", templateId)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("recurring_occurrences")
        .select("id, occurrence_date, expected_amount")
        .eq("template_id", templateId)
        .eq("user_id", user.id)
        .eq("status", "pending"),
      supabase
        .from("planning_entries")
        .select("id")
        .eq("recurring_template_id", templateId)
        .eq("user_id", user.id),
    ]);

    if (templateRes.error || !templateRes.data) {
      return { success: false, error: "No se encontró la plantilla." };
    }

    const template = templateRes.data;
    const occurrences = occurrencesRes.data ?? [];
    const planningEntries = planningRes.data ?? [];

    const pendingCount = occurrences.length;
    const pendingTotal = occurrences.reduce((sum, o) => sum + o.expected_amount, 0);

    const near = occurrences.filter(
      (o) => o.occurrence_date >= today && o.occurrence_date <= in14Days
    );

    // Resolve effective direction (debt accounts = INFLOW template but behaves as OUTFLOW obligation)
    const accountType = (template.account as { account_type?: string } | null)?.account_type;
    // Only an INFLOW abono behaves as an OUTFLOW obligation; an OUTFLOW charge
    // already is an OUTFLOW, so its effective direction is just its direction.
    const isDebtPayment = !!accountType && isDebtAccountType(accountType) && template.direction === "INFLOW";
    const effectiveDirection: "INFLOW" | "OUTFLOW" = isDebtPayment ? "OUTFLOW" : template.direction;

    const nextDate = getNextOccurrence(
      template.start_date,
      template.frequency,
      template.end_date
    ) ?? null;

    return {
      success: true,
      data: {
        pendingCount,
        pendingTotal,
        within14Days: { count: near.length, total: near.reduce((s, o) => s + o.expected_amount, 0) },
        planningEntriesCount: planningEntries.length,
        nextOccurrenceDate: nextDate,
        monthlyAmount: toMonthlyAmount(template.amount, template.frequency),
        direction: effectiveDirection,
        templateName: template.merchant_name ?? template.description ?? "Recurrente",
      },
    };
  } catch (error) {
    console.error("Error calculating template impact:", error);
    return { success: false, error: "Error al calcular el impacto de la plantilla." };
  }
}

// ─── Merge / Split ──────────────────────────────────────────────────────────

/**
 * Merge two recurring templates into one. The "keep" template absorbs the
 * "absorb" template. Both must belong to the same account and user.
 *
 * - The absorb template's currency+amount becomes a sub_payment entry on the keep template
 * - The keep template's amount stays as its primary-currency minimum
 * - Conflicting occurrences (same date) are deleted from the absorb template
 * - Remaining occurrences are reassigned to the keep template
 * - The absorb template is deleted
 */
export async function mergeRecurringTemplates(
  keepId: string,
  absorbId: string,
): Promise<ActionResult<RecurringTemplate>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const keepCheck = uuidStr("ID de plantilla inválido").safeParse(keepId);
  const absorbCheck = uuidStr("ID de plantilla inválido").safeParse(absorbId);
  if (!keepCheck.success) return { success: false, error: keepCheck.error.issues[0].message };
  if (!absorbCheck.success) return { success: false, error: absorbCheck.error.issues[0].message };
  if (keepId === absorbId) return { success: false, error: "No puedes combinar una plantilla consigo misma." };

  // Load both templates
  const [keepRes, absorbRes] = await Promise.all([
    supabase
      .from("recurring_transaction_templates")
      .select("*, account:accounts!recurring_transaction_templates_account_id_fkey(id, currency_code)")
      .eq("id", keepId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("recurring_transaction_templates")
      .select("*")
      .eq("id", absorbId)
      .eq("user_id", user.id)
      .single(),
  ]);

  if (keepRes.error || !keepRes.data) return { success: false, error: "No se encontró la plantilla principal." };
  if (absorbRes.error || !absorbRes.data) return { success: false, error: "No se encontró la plantilla a combinar." };

  const keep = keepRes.data;
  const absorb = absorbRes.data;

  if (keep.account_id !== absorb.account_id) {
    return { success: false, error: "Ambas plantillas deben pertenecer a la misma cuenta." };
  }

  // Build merged sub_payments
  const existingSubPayments: SubPayment[] = parseSubPayments(keep.sub_payments) ?? [];
  const absorbSubPayments: SubPayment[] = parseSubPayments(absorb.sub_payments) ?? [];

  // Start from the keep template's sub_payments (or create entry from its amount/currency)
  const merged = new Map<string, number>();
  if (existingSubPayments.length > 0) {
    for (const sp of existingSubPayments) merged.set(sp.currency_code, sp.amount);
  } else {
    merged.set(keep.currency_code, keep.amount);
  }

  // Add the absorb template's sub_payments (or its amount/currency)
  if (absorbSubPayments.length > 0) {
    for (const sp of absorbSubPayments) {
      merged.set(sp.currency_code, (merged.get(sp.currency_code) ?? 0) + sp.amount);
    }
  } else {
    const existing = merged.get(absorb.currency_code) ?? 0;
    merged.set(absorb.currency_code, existing + absorb.amount);
  }

  const primaryCurrency = (keep.account as { currency_code: string } | null)?.currency_code ?? keep.currency_code;
  const subPayments: SubPayment[] = Array.from(merged.entries())
    .map(([currency_code, amount]) => ({ currency_code, amount }))
    .sort((a, b) => {
      if (a.currency_code === primaryCurrency) return -1;
      if (b.currency_code === primaryCurrency) return 1;
      return a.currency_code.localeCompare(b.currency_code);
    });

  // template.amount = primary-currency entry only
  const primaryAmount = merged.get(primaryCurrency) ?? keep.amount;

  try {
    // 1. Update the keep template
    const { data: updated, error: updateError } = await supabase
      .from("recurring_transaction_templates")
      .update({
        amount: primaryAmount,
        currency_code: primaryCurrency as Database["public"]["Enums"]["currency_code"],
        sub_payments: subPayments as unknown as Database["public"]["Tables"]["recurring_transaction_templates"]["Row"]["sub_payments"],
      })
      .eq("id", keepId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 2. Delete only PENDING conflicting occurrences (same date on both templates).
    // Paid/skipped occurrences are preserved by reassigning them.
    const { data: keepOccDates } = await supabase
      .from("recurring_occurrences")
      .select("occurrence_date")
      .eq("template_id", keepId)
      .eq("user_id", user.id);

    if (keepOccDates && keepOccDates.length > 0) {
      const dates = keepOccDates.map((o) => o.occurrence_date);
      await supabase
        .from("recurring_occurrences")
        .delete()
        .eq("template_id", absorbId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .in("occurrence_date", dates);
    }

    // 3. Reassign remaining occurrences from absorb to keep.
    // Pending occurrences get the merged amount; paid/skipped keep historical amounts.
    await supabase
      .from("recurring_occurrences")
      .update({ template_id: keepId, expected_amount: primaryAmount })
      .eq("template_id", absorbId)
      .eq("user_id", user.id)
      .eq("status", "pending");

    await supabase
      .from("recurring_occurrences")
      .update({ template_id: keepId })
      .eq("template_id", absorbId)
      .eq("user_id", user.id);

    // 3.5. Re-align keep's pending occurrences with its own schedule.
    // The reassign in step 3 can move pending rows onto dates the absorbed
    // template generated (e.g. day 6) that don't match the keep template's
    // own day_of_month/frequency (e.g. day 4). Left untouched, the dashboard
    // would show two upcoming entries per cycle instead of one.
    // Paid/skipped rows are preserved as historical records regardless of
    // date alignment — only pending rows are filtered against the schedule.
    const { data: keepPendingRows } = await supabase
      .from("recurring_occurrences")
      .select("id, occurrence_date")
      .eq("template_id", keepId)
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (keepPendingRows && keepPendingRows.length > 0) {
      const sorted = [...keepPendingRows].sort((a, b) =>
        a.occurrence_date.localeCompare(b.occurrence_date),
      );
      const earliest = new Date(`${sorted[0].occurrence_date}T12:00:00`);
      const latest = new Date(`${sorted[sorted.length - 1].occurrence_date}T12:00:00`);
      const lookaheadEnd = addDays(new Date(), 90);
      const rangeEnd = latest > lookaheadEnd ? latest : lookaheadEnd;
      const expectedDates = new Set(
        getOccurrencesBetween(
          keep.start_date,
          keep.frequency,
          keep.end_date,
          earliest,
          rangeEnd,
        ),
      );
      const orphanIds = sorted
        .filter((row) => !expectedDates.has(row.occurrence_date))
        .map((row) => row.id);
      if (orphanIds.length > 0) {
        await supabase
          .from("recurring_occurrences")
          .delete()
          .in("id", orphanIds)
          .eq("user_id", user.id);
      }
    }

    // Align expected_amount on every surviving pending row to the merged
    // primary amount. The original keep pending still carry the pre-merge
    // amount; without this they'd render the old number while the reassigned
    // rows show the new merged amount.
    await supabase
      .from("recurring_occurrences")
      .update({ expected_amount: primaryAmount })
      .eq("template_id", keepId)
      .eq("user_id", user.id)
      .eq("status", "pending");

    // 4. Delete the absorbed template
    await supabase
      .from("recurring_transaction_templates")
      .delete()
      .eq("id", absorbId)
      .eq("user_id", user.id);

    revalidateFinancialViews();

    return { success: true, data: updated };
  } catch (error) {
    console.error("Error merging templates:", error);
    return { success: false, error: "Error al combinar las plantillas." };
  }
}

/**
 * Split a sub_payment entry out of a template into its own standalone template.
 * The original template keeps everything except the split-out currency entry.
 */
export async function splitSubPayment(
  templateId: string,
  currencyCode: string,
): Promise<ActionResult<RecurringTemplate>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const idCheck = uuidStr("ID de plantilla inválido").safeParse(templateId);
  if (!idCheck.success) return { success: false, error: idCheck.error.issues[0].message };

  const { data: template, error: fetchError } = await supabase
    .from("recurring_transaction_templates")
    .select("*, account:accounts!recurring_transaction_templates_account_id_fkey(id, currency_code)")
    .eq("id", templateId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !template) return { success: false, error: "No se encontró la plantilla." };

  const subPayments = parseSubPayments(template.sub_payments);
  if (!subPayments || subPayments.length < 2) {
    return { success: false, error: "La plantilla no tiene desglose de monedas para separar." };
  }

  const splitEntry = subPayments.find((sp) => sp.currency_code === currencyCode);
  if (!splitEntry) {
    return { success: false, error: `No se encontró la entrada de ${currencyCode} en el desglose.` };
  }

  const remainingSubPayments = subPayments.filter((sp) => sp.currency_code !== currencyCode);
  const accountCurrency = (template.account as { currency_code: string } | null)?.currency_code ?? template.currency_code;

  // If splitting the primary currency, switch to the next available currency
  const nextPrimary = remainingSubPayments.find((sp) => sp.currency_code === accountCurrency)
    ?? remainingSubPayments[0];
  const newPrimaryAmount = nextPrimary.amount;
  const newCurrencyCode = nextPrimary.currency_code;

  try {
    // 1. Update original template — remove the split entry
    const subPaymentsValue = remainingSubPayments.length > 1
      ? (remainingSubPayments as unknown as Database["public"]["Tables"]["recurring_transaction_templates"]["Row"]["sub_payments"])
      : null; // If only one currency left, clear sub_payments

    await supabase
      .from("recurring_transaction_templates")
      .update({
        amount: newPrimaryAmount,
        currency_code: newCurrencyCode as Database["public"]["Enums"]["currency_code"],
        sub_payments: subPaymentsValue,
      })
      .eq("id", templateId)
      .eq("user_id", user.id);

    // 2. Create new template for the split-out currency
    const { data: newTemplate, error: insertError } = await supabase
      .from("recurring_transaction_templates")
      .insert({
        user_id: user.id,
        account_id: template.account_id,
        transfer_source_account_id: template.transfer_source_account_id,
        amount: splitEntry.amount,
        currency_code: currencyCode as Database["public"]["Enums"]["currency_code"],
        direction: template.direction,
        frequency: template.frequency,
        is_active: template.is_active,
        merchant_name: template.merchant_name
          ? `${template.merchant_name} (${currencyCode})`
          : null,
        description: template.description,
        category_id: template.category_id,
        day_of_month: template.day_of_month,
        day_of_week: template.day_of_week,
        start_date: template.start_date,
        end_date: template.end_date,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await ensureCurrentOccurrences();
    revalidateFinancialViews();

    return { success: true, data: newTemplate };
  } catch (error) {
    console.error("Error splitting sub_payment:", error);
    return { success: false, error: "Error al separar la moneda de la plantilla." };
  }
}

/**
 * Get templates eligible for merging with a given template.
 * Returns templates for the same account, same direction, same frequency.
 */
export async function getMergeableTemplates(
  templateId: string,
): Promise<ActionResult<RecurringTemplateWithRelations[]>> {
  const { supabase, user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  const idCheck = uuidStr("ID inválido").safeParse(templateId);
  if (!idCheck.success) return { success: false, error: idCheck.error.issues[0].message };

  const { data: source, error: srcErr } = await supabase
    .from("recurring_transaction_templates")
    .select("account_id, direction, frequency")
    .eq("id", templateId)
    .eq("user_id", user.id)
    .single();

  if (srcErr || !source) return { success: false, error: "No se encontró la plantilla." };

  const { data: candidates, error } = await supabase
    .from("recurring_transaction_templates")
    .select(TEMPLATE_SELECT)
    .eq("user_id", user.id)
    .eq("account_id", source.account_id)
    .eq("direction", source.direction)
    .eq("frequency", source.frequency)
    .neq("id", templateId)
    .eq("is_active", true);

  if (error) return { success: false, error: error.message };

  return { success: true, data: (candidates ?? []) as RecurringTemplateWithRelations[] };
}


