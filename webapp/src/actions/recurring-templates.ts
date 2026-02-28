"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { recurringTemplateSchema } from "@/lib/validators/recurring-template";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { getNextOccurrence, getOccurrencesBetween } from "@venti5/shared";
import { addDays } from "date-fns";
import { z } from "zod";
import type { ActionResult } from "@/types/actions";
import type { Database } from "@/types/database";
import type {
  RecurringTemplate,
  RecurringTemplateWithRelations,
  UpcomingRecurrence,
} from "@/types/domain";

const DEBT_ACCOUNT_TYPES = new Set(["CREDIT_CARD", "LOAN"]);
const DEBT_PAYMENT_CATEGORY_ID = "a0000001-0001-4000-8000-000000000019";
const TRANSFER_CATEGORY_ID = "a0000001-0001-4000-8000-000000000020";

const TEMPLATE_SELECT = `
  *,
  account:accounts!recurring_transaction_templates_account_id_fkey(id, name, icon, color, account_type, currency_code),
  category:categories!recurring_transaction_templates_category_id_fkey(id, name, name_es, icon, color),
  transfer_source_account:accounts!recurring_transaction_templates_transfer_source_account_id_fkey(id, name, account_type, currency_code)
`;

async function computeRecurringGroupUuid(templateId: string, occurrenceDate: string) {
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

function applyBalanceDelta(params: {
  currentBalance: number;
  accountType: string;
  direction: "INFLOW" | "OUTFLOW";
  amount: number;
}): number {
  const isDebtAccount = DEBT_ACCOUNT_TYPES.has(params.accountType);
  if (isDebtAccount) {
    if (params.direction === "INFLOW") return params.currentBalance - params.amount;
    return params.currentBalance + params.amount;
  }
  if (params.direction === "INFLOW") return params.currentBalance + params.amount;
  return params.currentBalance - params.amount;
}

export async function getRecurringTemplates(): Promise<
  ActionResult<RecurringTemplateWithRelations[]>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("recurring_transaction_templates")
    .select(TEMPLATE_SELECT)
    .order("is_active", { ascending: false })
    .order("merchant_name");

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as RecurringTemplateWithRelations[] };
}

export async function getRecurringTemplate(
  id: string
): Promise<ActionResult<RecurringTemplateWithRelations>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("recurring_transaction_templates")
    .select(TEMPLATE_SELECT)
    .eq("user_id", user.id)
    .eq("id", id)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as RecurringTemplateWithRelations };
}

export async function createRecurringTemplate(
  _prevState: ActionResult<RecurringTemplate>,
  formData: FormData
): Promise<ActionResult<RecurringTemplate>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    day_of_month: formData.get("day_of_month") || undefined,
    day_of_week: formData.get("day_of_week") || undefined,
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const payload = { ...parsed.data };
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, account_type")
    .eq("id", payload.account_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError || !account) {
    return { success: false, error: "Cuenta inválida para este usuario." };
  }

  if (DEBT_ACCOUNT_TYPES.has(account.account_type)) {
    payload.direction = "INFLOW";
    payload.category_id = null;
    if (!payload.transfer_source_account_id) {
      return { success: false, error: "Selecciona la cuenta origen para el pago de deuda." };
    }
    if (payload.transfer_source_account_id === payload.account_id) {
      return { success: false, error: "La cuenta origen no puede ser la misma cuenta de deuda." };
    }
  } else {
    payload.transfer_source_account_id = null;
  }

  const { data, error } = await supabase
    .from("recurring_transaction_templates")
    .insert({
      user_id: user.id,
      ...payload,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/recurrentes");
  revalidatePath("/dashboard");
  return { success: true, data };
}

export async function updateRecurringTemplate(
  id: string,
  _prevState: ActionResult<RecurringTemplate>,
  formData: FormData
): Promise<ActionResult<RecurringTemplate>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    day_of_month: formData.get("day_of_month") || undefined,
    day_of_week: formData.get("day_of_week") || undefined,
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const payload = { ...parsed.data };
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, account_type")
    .eq("id", payload.account_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError || !account) {
    return { success: false, error: "Cuenta inválida para este usuario." };
  }

  if (DEBT_ACCOUNT_TYPES.has(account.account_type)) {
    payload.direction = "INFLOW";
    payload.category_id = null;
    if (!payload.transfer_source_account_id) {
      return { success: false, error: "Selecciona la cuenta origen para el pago de deuda." };
    }
    if (payload.transfer_source_account_id === payload.account_id) {
      return { success: false, error: "La cuenta origen no puede ser la misma cuenta de deuda." };
    }
  } else {
    payload.transfer_source_account_id = null;
  }

  const { data, error } = await supabase
    .from("recurring_transaction_templates")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/recurrentes");
  revalidatePath("/dashboard");
  return { success: true, data };
}

export async function deleteRecurringTemplate(
  id: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("recurring_transaction_templates")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/recurrentes");
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

export async function toggleRecurringTemplate(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("recurring_transaction_templates")
    .update({ is_active: isActive })
    .eq("user_id", user.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/recurrentes");
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

const recurringOccurrencePaymentSchema = z.object({
  templateId: z.string().uuid(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  actualAmount: z.coerce.number().positive(),
  sourceAccountId: z.string().uuid().nullable().optional(),
});

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
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
};
type RecurringTxDraft = {
  account_id: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  raw_description: string;
  merchant_name: string;
  category_id: string | null;
  notes: string;
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
  const isDebtPaymentTemplate = DEBT_ACCOUNT_TYPES.has(params.template.account.account_type);
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
    .select("id, name, account_type, current_balance")
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
        },
        {
          account_id: params.targetAccount.id,
          amount: params.actualAmount,
          direction: "INFLOW",
          raw_description: `Abono deuda desde ${sourceAccount.name} - ${baseLabel}`,
          merchant_name: baseLabel,
          category_id: DEBT_PAYMENT_CATEGORY_ID,
          notes: "Abono de deuda marcado desde checklist recurrente",
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
      is_recurring: true,
      recurrence_group_id: params.recurrenceGroupId,
      categorization_source: tx.category_id ? "USER_CREATED" : "SYSTEM_DEFAULT",
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
}): Promise<void> {
  for (const tx of params.createdTxs) {
    const account = params.accountMap.get(tx.account_id);
    if (!account) continue;

    const nextBalance = applyBalanceDelta({
      currentBalance: account.current_balance,
      accountType: account.account_type,
      direction: tx.direction,
      amount: tx.amount,
    });

    account.current_balance = nextBalance;
    await params.supabase
      .from("accounts")
      .update({ current_balance: nextBalance })
      .eq("id", account.id)
      .eq("user_id", params.userId);
  }
}

export async function recordRecurringOccurrencePayment(input: {
  templateId: string;
  occurrenceDate: string;
  paymentDate?: string;
  actualAmount: number;
  sourceAccountId?: string | null;
}): Promise<ActionResult<{ created: number; alreadyRecorded: number }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const occurrenceValidationError = validateOccurrenceMatchesTemplate(
    template,
    payload.occurrenceDate
  );
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

  await updateBalancesForCreatedTransactions({
    supabase,
    userId: user.id,
    accountMap: loadedAccounts.accountMap,
    createdTxs: inserted.createdTxs,
  });

  revalidatePath("/recurrentes");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/deudas");

  return {
    success: true,
    data: {
      created: inserted.created,
      alreadyRecorded: inserted.alreadyRecorded,
    },
  };
}

/**
 * Get upcoming recurring payments for the next N days.
 * Computes occurrences on the fly from active templates.
 */
export async function getUpcomingRecurrences(
  days: number = 30
): Promise<UpcomingRecurrence[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: templates } = await supabase
    .from("recurring_transaction_templates")
    .select(TEMPLATE_SELECT)
    .eq("is_active", true);

  if (!templates || templates.length === 0) return [];

  const now = new Date();
  const rangeEnd = addDays(now, days);

  const upcoming: UpcomingRecurrence[] = [];

  for (const template of templates as RecurringTemplateWithRelations[]) {
    const dates = getOccurrencesBetween(
      template.start_date,
      template.frequency,
      template.end_date,
      now,
      rangeEnd
    );

    for (const date of dates) {
      upcoming.push({ template, next_date: date });
    }
  }

  // Sort by date ascending
  upcoming.sort((a, b) => a.next_date.localeCompare(b.next_date));

  return upcoming;
}

/**
 * Get monthly totals for active recurring templates.
 */
export async function getRecurringSummary(): Promise<{
  totalMonthlyExpenses: number;
  totalMonthlyIncome: number;
  activeCount: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return { totalMonthlyExpenses: 0, totalMonthlyIncome: 0, activeCount: 0 };

  const { data: templates } = await supabase
    .from("recurring_transaction_templates")
    .select("amount, direction, frequency, accounts!recurring_transaction_templates_account_id_fkey(account_type)")
    .eq("is_active", true);

  if (!templates)
    return { totalMonthlyExpenses: 0, totalMonthlyIncome: 0, activeCount: 0 };

  let totalMonthlyExpenses = 0;
  let totalMonthlyIncome = 0;

  for (const t of templates) {
    // Normalize to monthly equivalent
    const monthlyAmount = toMonthlyAmount(t.amount, t.frequency);
    const accountType = (t.accounts as { account_type?: string } | null)?.account_type;
    const isDebtPayment = !!accountType && DEBT_ACCOUNT_TYPES.has(accountType);
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
  };
}

function toMonthlyAmount(
  amount: number,
  frequency: string
): number {
  switch (frequency) {
    case "WEEKLY":
      return amount * 4.33;
    case "BIWEEKLY":
      return amount * 2.17;
    case "MONTHLY":
      return amount;
    case "QUARTERLY":
      return amount / 3;
    case "ANNUAL":
      return amount / 12;
    default:
      return amount;
  }
}
