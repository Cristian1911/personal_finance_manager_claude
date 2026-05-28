"use server";

import { cacheTag, cacheLife, updateTag } from "next/cache";
import { createCachedClient } from "@/lib/supabase/cached";
import {
  autoCategorize,
  computeIdempotencyKey,
  computeMonthlyAggregates,
  type MonthlyAggregatesResult,
} from "@zeta/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDestinatario, matchTransactionToDestinatario } from "@/actions/destinatarios";
import { createRecurringTemplate } from "@/actions/recurring-templates";
import type { Database } from "@/types/database";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { getIsDemoFilter, getDemoAccountIds } from "@/lib/demo-filter";
import {
  quickCapturePreviewSchema,
  transactionCreateOptionsSchema,
  transactionFiltersSchema,
  transactionSchema,
} from "@/lib/validators/transaction";
import { parseMonth, monthStartStr, monthEndStr } from "@/lib/utils/date";
import {
  applyAccountBalanceDelta,
  reverseAccountBalanceDelta,
} from "@/lib/utils/account-balance";
import type { ActionResult, PaginatedResult } from "@/types/actions";
import type { Transaction, TransactionLocation, TransactionWithAccount } from "@/types/domain";

type PersistTransactionParams = {
  userId: string;
  account_id: string;
  amount: number;
  currency_code: Transaction["currency_code"];
  direction: Transaction["direction"];
  transaction_date: string;
  transaction_time?: string | null;
  raw_description?: string | null;
  merchant_name?: string | null;
  category_id?: string | null;
  destinatario_id?: string | null;
  notes?: string | null;
  capture_method?: Transaction["capture_method"];
  capture_input_text?: string | null;
  is_subscription?: boolean;
  location_id?: string | null;
};

type BalanceAccountRow = {
  id: string;
  account_type: string;
  current_balance: number;
};

type BalanceTransactionRow = Pick<
  Transaction,
  "account_id" | "amount" | "direction" | "is_excluded"
>;

type RelatedSetup = {
  destinatarioId: string | null;
  recurringTemplateId: string | null;
  merchantName: string | null;
};

async function loadBalanceAccounts(
  supabase: SupabaseClient<Database>,
  userId: string,
  accountIds: string[]
): Promise<ActionResult<Map<string, BalanceAccountRow>>> {
  const uniqueIds = [...new Set(accountIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return { success: true, data: new Map() };
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("id, account_type, current_balance")
    .eq("user_id", userId)
    .in("id", uniqueIds);

  if (error) {
    return { success: false, error: error.message };
  }

  const accountMap = new Map(
    (data ?? []).map((account) => [
      account.id,
      {
        id: account.id,
        account_type: account.account_type,
        current_balance: account.current_balance ?? 0,
      },
    ])
  );

  return { success: true, data: accountMap };
}

async function adjustBalancesForTransactionChanges(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  changes: Array<{
    existingTx?: BalanceTransactionRow;
    nextTx?: BalanceTransactionRow;
  }>;
}): Promise<ActionResult<void>> {
  const accountLookup = await loadBalanceAccounts(
    params.supabase,
    params.userId,
    params.changes.flatMap((change) => [
      change.existingTx?.account_id ?? "",
      change.nextTx?.account_id ?? "",
    ])
  );

  if (!accountLookup.success) {
    return { success: false, error: accountLookup.error };
  }

  const accountMap = accountLookup.data;
  const dirtyAccounts = new Set<string>();

  for (const change of params.changes) {
    if (change.existingTx && !change.existingTx.is_excluded) {
      const account = accountMap.get(change.existingTx.account_id);
      if (!account) {
        return { success: false, error: "Cuenta no encontrada para reversar balance" };
      }

      account.current_balance = reverseAccountBalanceDelta({
        currentBalance: account.current_balance,
        accountType: account.account_type,
        direction: change.existingTx.direction,
        amount: change.existingTx.amount,
      });
      dirtyAccounts.add(account.id);
    }

    if (change.nextTx && !change.nextTx.is_excluded) {
      const account = accountMap.get(change.nextTx.account_id);
      if (!account) {
        return { success: false, error: "Cuenta no encontrada para aplicar balance" };
      }

      account.current_balance = applyAccountBalanceDelta({
        currentBalance: account.current_balance,
        accountType: account.account_type,
        direction: change.nextTx.direction,
        amount: change.nextTx.amount,
      });
      dirtyAccounts.add(account.id);
    }
  }

  for (const accountId of dirtyAccounts) {
    const account = accountMap.get(accountId);
    if (!account) continue;

    const { error } = await params.supabase
      .from("accounts")
      .update({ current_balance: account.current_balance })
      .eq("user_id", params.userId)
      .eq("id", accountId);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: true, data: undefined };
}

import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { linkTransactionToOccurrence } from "@/actions/occurrences";

function getRecurringScheduleFields(
  startDate: string,
  frequency: NonNullable<
    ReturnType<typeof transactionCreateOptionsSchema.parse>["recurring_frequency"]
  >
) {
  const [year, month, day] = startDate.split("-").map(Number);
  const anchor = new Date(year, (month ?? 1) - 1, day ?? 1);

  if (Number.isNaN(anchor.getTime())) {
    return { day_of_month: null, day_of_week: null };
  }

  if (frequency === "WEEKLY" || frequency === "BIWEEKLY") {
    return {
      day_of_month: null,
      day_of_week: anchor.getDay(),
    };
  }

  return {
    day_of_month: anchor.getDate(),
    day_of_week: null,
  };
}

async function cleanupPreparedSetup(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  destinatarioId?: string | null;
  recurringTemplateId?: string | null;
}) {
  if (params.recurringTemplateId) {
    await params.supabase
      .from("recurring_transaction_templates")
      .delete()
      .eq("user_id", params.userId)
      .eq("id", params.recurringTemplateId);
  }

  if (params.destinatarioId) {
    await params.supabase
      .from("destinatario_rules")
      .delete()
      .eq("user_id", params.userId)
      .eq("destinatario_id", params.destinatarioId);

    await params.supabase
      .from("destinatarios")
      .delete()
      .eq("user_id", params.userId)
      .eq("id", params.destinatarioId);
  }
}

async function prepareRelatedSetup(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  core: ReturnType<typeof transactionSchema.parse>;
  options: ReturnType<typeof transactionCreateOptionsSchema.parse>;
  baseState: ActionResult<Transaction>;
}): Promise<ActionResult<RelatedSetup>> {
  const baseMerchantName =
    params.core.merchant_name?.trim() || params.core.raw_description?.trim() || null;

  let destinatarioId: string | null = null;
  let recurringTemplateId: string | null = null;
  let merchantName = baseMerchantName;

  if (params.options.create_destinatario) {
    const destinatarioName =
      params.options.destinatario_name?.trim() || baseMerchantName;

    if (!destinatarioName) {
      return {
        success: false,
        error: "Ingresa una descripción o un nombre para crear el destinatario.",
      };
    }

    const destinatarioFormData = new FormData();
    destinatarioFormData.set("name", destinatarioName);
    destinatarioFormData.set("is_active", "true");

    if (params.core.category_id) {
      destinatarioFormData.set("default_category_id", params.core.category_id);
    }

    const pattern = baseMerchantName || destinatarioName;
    if (pattern.trim().length >= 2) {
      destinatarioFormData.set("patterns", JSON.stringify([pattern.trim()]));
    }

    const destinatarioResult = await createDestinatario(
      params.baseState as ActionResult<never>,
      destinatarioFormData
    );

    if (!destinatarioResult.success) {
      return { success: false, error: destinatarioResult.error };
    }

    destinatarioId = destinatarioResult.data.id;
    merchantName = destinatarioResult.data.name;
  }

  if (params.options.create_recurring_template) {
    const recurringName = merchantName?.trim() || params.options.destinatario_name?.trim();

    if (!recurringName) {
      await cleanupPreparedSetup({
        supabase: params.supabase,
        userId: params.userId,
        destinatarioId,
      });
      return {
        success: false,
        error: "Agrega una descripción para crear el pago recurrente.",
      };
    }

    const recurringStartDate =
      params.options.recurring_start_date ?? params.core.transaction_date;
    const recurringFormData = new FormData();
    const recurringDirection = params.core.direction;
    const scheduleFields = getRecurringScheduleFields(
      recurringStartDate,
      params.options.recurring_frequency
    );

    recurringFormData.set("account_id", params.core.account_id);
    recurringFormData.set("amount", String(params.core.amount));
    recurringFormData.set("currency_code", params.core.currency_code);
    recurringFormData.set("direction", recurringDirection);
    recurringFormData.set("frequency", params.options.recurring_frequency);
    recurringFormData.set("merchant_name", recurringName);
    recurringFormData.set("start_date", recurringStartDate);

    if (params.core.notes?.trim()) {
      recurringFormData.set("description", params.core.notes.trim());
    }

    if (params.core.category_id) {
      recurringFormData.set("category_id", params.core.category_id);
    }

    if (scheduleFields.day_of_month != null) {
      recurringFormData.set("day_of_month", String(scheduleFields.day_of_month));
    }

    if (scheduleFields.day_of_week != null) {
      recurringFormData.set("day_of_week", String(scheduleFields.day_of_week));
    }

    if (params.options.recurring_transfer_source_account_id) {
      recurringFormData.set(
        "transfer_source_account_id",
        params.options.recurring_transfer_source_account_id
      );
    }

    const recurringResult = await createRecurringTemplate(
      params.baseState as ActionResult<never>,
      recurringFormData
    );

    if (!recurringResult.success) {
      await cleanupPreparedSetup({
        supabase: params.supabase,
        userId: params.userId,
        destinatarioId,
      });
      return { success: false, error: recurringResult.error };
    }

    recurringTemplateId = recurringResult.data.id;
  }

  return {
    success: true,
    data: {
      destinatarioId,
      recurringTemplateId,
      merchantName,
    },
  };
}

async function persistTransaction(
  supabase: SupabaseClient<Database>,
  params: PersistTransactionParams
): Promise<ActionResult<Transaction>> {
  const idempotencyKey = await computeIdempotencyKey({
    provider: "MANUAL",
    transactionDate: params.transaction_date,
    amount: params.amount,
    rawDescription: params.raw_description ?? params.merchant_name ?? "",
  });

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: params.userId,
      account_id: params.account_id,
      amount: params.amount,
      currency_code: params.currency_code,
      direction: params.direction,
      transaction_date: params.transaction_date,
      transaction_time: params.transaction_time ?? null,
      raw_description: params.raw_description ?? null,
      clean_description: params.merchant_name || params.raw_description || null,
      merchant_name: params.merchant_name ?? null,
      category_id: params.category_id ?? null,
      destinatario_id: params.destinatario_id ?? null,
      notes: params.notes ?? null,
      idempotency_key: idempotencyKey,
      provider: "MANUAL",
      capture_method: params.capture_method ?? "MANUAL_FORM",
      capture_input_text: params.capture_input_text ?? null,
      categorization_source: params.category_id ? "USER_CREATED" : "SYSTEM_DEFAULT",
      is_subscription: params.is_subscription ?? false,
      location_id: params.location_id ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Esta transacción ya existe (duplicada)" };
    }
    return { success: false, error: error.message };
  }

  const balanceResult = await adjustBalancesForTransactionChanges({
    supabase,
    userId: params.userId,
    changes: [{ nextTx: data }],
  });

  if (!balanceResult.success) {
    return { success: false, error: balanceResult.error };
  }

  revalidateFinancialViews();
  return { success: true, data };
}

// ─── Cached transaction listing ──────────────────────────────────────────────

async function getTransactionsCached(
  userId: string,
  accessToken: string,
  page: number,
  pageSize: number,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  accountId: string | undefined,
  categoryId: string | undefined,
  direction: string | undefined,
  search: string | undefined,
  amountMin: number | undefined,
  amountMax: number | undefined,
  source: string | undefined,
  showExcluded: boolean,
  tagId: string | undefined,
): Promise<PaginatedResult<TransactionWithAccount>> {
  "use cache";
  cacheTag("transactions");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Tag filter: pre-fetch matching transaction IDs
  let taggedTransactionIds: string[] | null = null;
  if (tagId) {
    const { data: taggedIds } = await supabase
      .from("transaction_tags")
      .select("transaction_id")
      .eq("tag_id", tagId);

    if (taggedIds && taggedIds.length > 0) {
      taggedTransactionIds = taggedIds.map((r) => r.transaction_id);
    } else {
      return { data: [], count: 0, page, pageSize, totalPages: 0 };
    }
  }

  const isDemo = await getIsDemoFilter(userId);
  const demoAccountIds = await getDemoAccountIds(supabase, userId, isDemo);
  if (!demoAccountIds) return { data: [], count: 0, page, pageSize, totalPages: 0 };

  let query = supabase
    .from("transactions")
    .select("*, account:accounts!transactions_account_id_fkey(id, name, icon, color), category:categories!transactions_category_id_fkey(id, name, name_es, icon, color), destinatario:destinatarios!transactions_destinatario_id_fkey(id, name)", { count: "exact" })
    .eq("user_id", userId)
    .in("account_id", demoAccountIds)
    .order("transaction_date", { ascending: false })
    .order("transaction_time", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (accountId) query = query.eq("account_id", accountId);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (direction) query = query.eq("direction", direction as "INFLOW" | "OUTFLOW");
  if (dateFrom) query = query.gte("transaction_date", dateFrom);
  if (dateTo) query = query.lte("transaction_date", dateTo);
  if (search) {
    const sanitized = search
      .slice(0, 200)
      .replace(/[\\%_]/g, (c) => `\\${c}`)
      .replace(/[.,()]/g, "");
    query = query.or(
      `merchant_name.ilike.%${sanitized}%,raw_description.ilike.%${sanitized}%,clean_description.ilike.%${sanitized}%`
    );
  }
  if (amountMin !== undefined) query = query.gte("amount", amountMin);
  if (amountMax !== undefined) query = query.lte("amount", amountMax);
  if (source) query = query.eq("capture_method", source as Database["public"]["Enums"]["transaction_capture_method"]);
  if (!showExcluded) query = query.eq("is_excluded", false);
  if (taggedTransactionIds) query = query.in("id", taggedTransactionIds);

  const { data, error, count } = await query.is("reconciled_into_transaction_id", null);
  if (error) throw error;

  return {
    data: (data ?? []) as unknown as TransactionWithAccount[],
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getTransactions(
  filters: Record<string, string | undefined>
): Promise<PaginatedResult<TransactionWithAccount>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { data: [], count: 0, page: 1, pageSize: 20, totalPages: 0 };

  const parsed = transactionFiltersSchema.safeParse(filters);
  const params = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 20, showExcluded: false as const };

  if (params.month && !params.dateFrom && !params.dateTo) {
    const target = parseMonth(params.month);
    params.dateFrom = monthStartStr(target);
    params.dateTo = monthEndStr(target);
  }

  try {
    return await getTransactionsCached(
      user.id, accessToken,
      params.page, params.pageSize,
      params.dateFrom, params.dateTo,
      params.accountId, params.categoryId,
      params.direction, params.search,
      params.amountMin, params.amountMax,
      params.source, params.showExcluded ?? false,
      params.tagId,
    );
  } catch {
    return { data: [], count: 0, page: params.page, pageSize: params.pageSize, totalPages: 0 };
  }
}

// ─── Monthly aggregates (Resumen del mes / LECTURA card) ────────────────────
//
// Canonical aggregation for the Movimientos summary card. The list endpoint
// (`getTransactionsCached`) returns a paginated `data[]` and an unfiltered
// `count`, so reducing inflows/outflows/uncategorized from that response gives
// page-1-only totals (the bug behind the 2026-05-21 live walkthrough's 7-33×
// divergence). This action does a slim SELECT for the entire month and
// reduces via the shared `computeMonthlyAggregates` helper that mobile uses
// too — same numbers by construction.

async function getMonthlyAggregatesCached(
  userId: string,
  accessToken: string,
  dateFrom: string,
  dateTo: string,
  accountId: string | undefined,
): Promise<MonthlyAggregatesResult> {
  "use cache";
  cacheTag("transactions");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const isDemo = await getIsDemoFilter(userId);
  const demoAccountIds = await getDemoAccountIds(supabase, userId, isDemo);
  if (!demoAccountIds) {
    return {
      count: 0,
      totalInflow: 0,
      totalOutflow: 0,
      uncategorizedCount: 0,
      daysByDate: [],
    };
  }

  let query = supabase
    .from("transactions")
    .select(
      "amount, direction, account_id, category_id, is_excluded, reconciled_into_transaction_id, transaction_date",
    )
    .eq("user_id", userId)
    .in("account_id", demoAccountIds)
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo)
    .is("reconciled_into_transaction_id", null);

  if (accountId) query = query.eq("account_id", accountId);

  const { data, error } = await query;
  if (error) throw error;

  // Resolve debt accounts once so the helper can skip debt-INFLOWs from totalInflow.
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, account_type")
    .eq("user_id", userId);
  const debtAccountIds = new Set(
    (accounts ?? [])
      .filter((a) => a.account_type === "CREDIT_CARD" || a.account_type === "LOAN")
      .map((a) => a.id),
  );

  return computeMonthlyAggregates(data ?? [], { debtAccountIds });
}

/**
 * Public entry for the Movimientos card. Always month-scoped (defaults to the
 * current month if `month` is missing) — the calling page may render a label
 * like "Mayo 2026" without passing a URL param, and the count must agree
 * with the label.
 */
export async function getMonthlyAggregates(
  month?: string,
  accountId?: string,
): Promise<ActionResult<MonthlyAggregatesResult>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const target = parseMonth(month);
    const dateFrom = monthStartStr(target);
    const dateTo = monthEndStr(target);
    const data = await getMonthlyAggregatesCached(
      user.id,
      accessToken,
      dateFrom,
      dateTo,
      accountId,
    );
    return { success: true, data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al cargar el resumen mensual";
    return { success: false, error: message };
  }
}

async function getTransactionCached(
  userId: string,
  id: string,
  accessToken: string,
): Promise<Transaction> {
  "use cache";
  cacheTag("transactions");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .is("reconciled_into_transaction_id", null)
    .single();

  if (error) throw error;
  return data;
}

export async function getTransaction(id: string): Promise<ActionResult<Transaction>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getTransactionCached(user.id, id, accessToken);
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cargar la transacción";
    return { success: false, error: message };
  }
}

async function getTransactionLocationCached(
  userId: string,
  locationId: string,
  accessToken: string,
): Promise<TransactionLocation | null> {
  "use cache";
  cacheTag("transactions");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  // `transaction_locations` view is not yet in the regenerated Database types
  // (manual patch covered transactions/profiles columns only). Narrow the cast
  // to just the `data` field so misuse upstream still type-checks.
  const { data, error } = await supabase
    .from("transaction_locations" as never)
    .select("*")
    .eq("id", locationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as TransactionLocation | null;
}

/**
 * Fetch the encrypted location row linked to a transaction (if any).
 * Returns null when no location is linked or the row is missing.
 * Webapp consumes this for the transaction-detail "Ubicación" block — capture
 * itself is mobile-only. Cached under the `"transactions"` tag so a mutation
 * elsewhere on the transaction (which invalidates `transactions`) also drops
 * the linked-location cache.
 */
export async function getTransactionLocation(
  locationId: string,
): Promise<ActionResult<TransactionLocation | null>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getTransactionLocationCached(user.id, locationId, accessToken);
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cargar la ubicación";
    return { success: false, error: message };
  }
}

// ─── Recent transactions (dashboard) ────────────────────────────────────────

export type RecentTransaction = {
  id: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  account_id: string;
  category_id: string | null;
  destinatario_id: string | null;
  recurrence_group_id: string | null;
  merchant_name: string | null;
  clean_description: string | null;
  transaction_date: string;
  currency_code: string;
  categories: { name_es: string | null; name: string; icon: string } | null;
  accounts: {
    name: string;
    color: string | null;
    mask: string | null;
    bank_key: string | null;
    account_type: Database["public"]["Enums"]["account_type"];
  } | null;
  destinatario: { id: string; name: string } | null;
  transaction_tags: Array<{
    tag: { id: string; name: string; color: string | null; group: { color: string | null } | null };
  }>;
};

async function getRecentTransactionsCached(
  userId: string,
  accessToken: string,
  isDemo: boolean,
): Promise<RecentTransaction[]> {
  "use cache";
  cacheTag("transactions");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const demoAccountIds = await getDemoAccountIds(supabase, userId, isDemo);
  if (!demoAccountIds) return [];

  const { data } = await supabase
    .from("transactions")
    .select(`
      id, amount, direction, account_id, category_id, destinatario_id, recurrence_group_id, merchant_name, clean_description,
      transaction_date, currency_code,
      categories!transactions_category_id_fkey(name_es, name, icon),
      accounts!transactions_account_id_fkey(name, color, mask, bank_key, account_type),
      destinatario:destinatarios!transactions_destinatario_id_fkey(id, name),
      transaction_tags!transaction_tags_transaction_id_fkey(tag:tags(id, name, color, group:tag_groups(color)))
    `)
    .eq("user_id", userId)
    .in("account_id", demoAccountIds)
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null)
    .order("transaction_date", { ascending: false })
    .order("transaction_time", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(5);

  return (data ?? []) as unknown as RecentTransaction[];
}

export async function getRecentTransactions(): Promise<RecentTransaction[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  const isDemo = await getIsDemoFilter(user.id);
  return getRecentTransactionsCached(user.id, accessToken, isDemo);
}

export async function createTransaction(
  _prevState: ActionResult<Transaction>,
  formData: FormData
): Promise<ActionResult<Transaction>> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const parsed = transactionSchema.safeParse({
    account_id: formData.get("account_id"),
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code"),
    direction: formData.get("direction"),
    transaction_date: formData.get("transaction_date"),
    transaction_time: formData.get("transaction_time") || undefined,
    raw_description: formData.get("raw_description") || undefined,
    merchant_name: formData.get("merchant_name") || undefined,
    category_id: formData.get("category_id") || undefined,
    destinatario_id: formData.get("destinatario_id") || undefined,
    notes: formData.get("notes") || undefined,
    capture_input_text: formData.get("capture_input_text") || undefined,
    is_subscription: formData.get("is_subscription"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const optionsParsed = transactionCreateOptionsSchema.safeParse({
    create_destinatario: formData.get("create_destinatario"),
    destinatario_name: formData.get("destinatario_name") || undefined,
    create_recurring_template: formData.get("create_recurring_template"),
    recurring_frequency: formData.get("recurring_frequency") || undefined,
    recurring_start_date: formData.get("recurring_start_date") || undefined,
    recurring_transfer_source_account_id:
      formData.get("recurring_transfer_source_account_id") || undefined,
  });

  if (!optionsParsed.success) {
    return { success: false, error: optionsParsed.error.issues[0].message };
  }

  const relatedSetup = await prepareRelatedSetup({
    supabase,
    userId: user.id,
    core: parsed.data,
    options: optionsParsed.data,
    baseState: _prevState,
  });

  if (!relatedSetup.success) {
    return relatedSetup;
  }

  const normalizedMerchantName =
    relatedSetup.data.merchantName ||
    parsed.data.merchant_name ||
    parsed.data.raw_description ||
    null;

  const finalDestinatarioId =
    relatedSetup.data.destinatarioId ?? parsed.data.destinatario_id ?? null;

  const transactionResult = await persistTransaction(supabase, {
    userId: user.id,
    ...parsed.data,
    merchant_name: normalizedMerchantName,
    destinatario_id: finalDestinatarioId,
    capture_method: "MANUAL_FORM",
  });

  if (!transactionResult.success) {
    await cleanupPreparedSetup({
      supabase,
      userId: user.id,
      destinatarioId: relatedSetup.data.destinatarioId,
      recurringTemplateId: relatedSetup.data.recurringTemplateId,
    });
    return transactionResult;
  }

  await linkTransactionToOccurrence(
    parsed.data.account_id, parsed.data.transaction_date,
    parsed.data.amount, parsed.data.direction, transactionResult.data.id,
    finalDestinatarioId,
  );

  return transactionResult;
}

export async function createQuickCaptureTransaction(
  _prevState: ActionResult<Transaction>,
  formData: FormData
): Promise<ActionResult<Transaction>> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const parsed = quickCapturePreviewSchema.safeParse({
    account_id: formData.get("account_id"),
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code"),
    direction: formData.get("direction"),
    transaction_date: formData.get("transaction_date"),
    transaction_time: formData.get("transaction_time") || undefined,
    raw_description: formData.get("raw_description"),
    merchant_name: formData.get("merchant_name"),
    category_id: formData.get("category_id") || undefined,
    notes: formData.get("notes") || undefined,
    capture_input_text: formData.get("capture_input_text"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const matchText = parsed.data.merchant_name ?? parsed.data.raw_description ?? "";
  const destMatch = await matchTransactionToDestinatario(user.id, matchText);

  let categoryId = parsed.data.category_id ?? null;
  let destinatarioId: string | null = null;

  if (destMatch) {
    destinatarioId = destMatch.destinatario_id;
    categoryId = categoryId ?? destMatch.category_id;
  }

  if (!categoryId) {
    categoryId = autoCategorize(parsed.data.merchant_name)?.category_id ?? null;
  }

  const result = await persistTransaction(supabase, {
    userId: user.id,
    ...parsed.data,
    category_id: categoryId,
    destinatario_id: destinatarioId,
    capture_method: "TEXT_QUICK_CAPTURE",
  });

  if (result.success) {
    await linkTransactionToOccurrence(
      parsed.data.account_id, parsed.data.transaction_date,
      parsed.data.amount, parsed.data.direction, result.data.id,
      destinatarioId,
    );
  }

  return result;
}

export async function updateTransaction(
  id: string,
  _prevState: ActionResult<Transaction>,
  formData: FormData
): Promise<ActionResult<Transaction>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = transactionSchema.safeParse({
    account_id: formData.get("account_id"),
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code"),
    direction: formData.get("direction"),
    transaction_date: formData.get("transaction_date"),
    transaction_time: formData.get("transaction_time") || undefined,
    raw_description: formData.get("raw_description") || undefined,
    merchant_name: formData.get("merchant_name") || undefined,
    category_id: formData.get("category_id") || undefined,
    notes: formData.get("notes") || undefined,
    capture_input_text: formData.get("capture_input_text") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data: existing, error: existingError } = await supabase
    .from("transactions")
    .select("account_id, amount, direction, is_excluded, category_id")
    .eq("user_id", user.id)
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    return { success: false, error: existingError?.message ?? "Transacción no encontrada" };
  }

  const categoryChanged = existing?.category_id !== parsed.data.category_id;

  // `updateTransaction` reuses `transactionSchema` but does not read the
  // `is_subscription` / `destinatario_id` form fields. Strip them from the
  // spread so their Zod defaults (false / undefined) don't overwrite the
  // existing row on every edit.
  const {
    is_subscription: _ignoredIsSubscription,
    destinatario_id: _ignoredDestinatarioId,
    ...updatableFields
  } = parsed.data;

  const { data, error } = await supabase
    .from("transactions")
    .update({
      ...updatableFields,
      clean_description: parsed.data.merchant_name || parsed.data.raw_description || null,
      ...(categoryChanged ? { categorization_source: "USER_OVERRIDE" as const } : {}),
    })
    .eq("user_id", user.id)
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  const balanceResult = await adjustBalancesForTransactionChanges({
    supabase,
    userId: user.id,
    changes: [
      {
        existingTx: {
          account_id: existing.account_id,
          amount: existing.amount,
          direction: existing.direction,
          is_excluded: existing.is_excluded,
        },
        nextTx: {
          account_id: data.account_id,
          amount: data.amount,
          direction: data.direction,
          is_excluded: data.is_excluded,
        },
      },
    ],
  });

  if (!balanceResult.success) {
    return { success: false, error: balanceResult.error };
  }

  revalidateFinancialViews();
  return { success: true, data };
}

/**
 * Patch the `notes` field on a single transaction. Lightweight counterpart to
 * `updateTransaction` for inline/autosave flows (detail page textarea).
 * Notes don't affect balances or categorization, so we skip the balance-change
 * reconciliation path.
 */
export async function updateTransactionNotes(
  id: string,
  notes: string | null,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const normalized = notes?.trim() ? notes.trim() : null;
  if (normalized && normalized.length > 2000) {
    return { success: false, error: "La nota es demasiado larga (máx 2000 caracteres)" };
  }

  const { error } = await supabase
    .from("transactions")
    .update({ notes: normalized })
    .eq("user_id", user.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  // Narrow invalidation — notes don't affect aggregates, so we only bust the
  // transactions read cache (which serves getTransactionCached + list queries).
  updateTag("transactions");
  return { success: true, data: undefined };
}

export async function updateTransactionTitle(
  id: string,
  title: string | null,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const normalized = title?.trim() ? title.trim() : null;
  if (normalized && normalized.length > 200) {
    return { success: false, error: "El título es demasiado largo (máx 200 caracteres)" };
  }

  // merchant_name is the display title. title_locked records that the user set
  // it so destinatario auto-assign won't clobber it. Clearing the title (null)
  // also unlocks → the row falls back to clean_description and can be
  // re-normalised by future matches.
  const { error } = await supabase
    .from("transactions")
    .update({ merchant_name: normalized, title_locked: normalized !== null })
    .eq("user_id", user.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  updateTag("transactions");
  return { success: true, data: undefined };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const { data: existing, error: existingError } = await supabase
    .from("transactions")
    .select("account_id, amount, direction, is_excluded")
    .eq("user_id", user.id)
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    return { success: false, error: existingError?.message ?? "Transacción no encontrada" };
  }

  const { error } = await supabase.from("transactions").delete().eq("user_id", user.id).eq("id", id);

  if (error) return { success: false, error: error.message };

  const balanceResult = await adjustBalancesForTransactionChanges({
    supabase,
    userId: user.id,
    changes: [{ existingTx: existing }],
  });

  if (!balanceResult.success) {
    return { success: false, error: balanceResult.error };
  }

  revalidateFinancialViews();
  return { success: true, data: undefined };
}

export async function toggleExcludeTransaction(
  id: string,
  excluded: boolean
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const { data: existing, error: existingError } = await supabase
    .from("transactions")
    .select("account_id, amount, direction, is_excluded")
    .eq("user_id", user.id)
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    return { success: false, error: existingError?.message ?? "Transacción no encontrada" };
  }

  const { error } = await supabase
    .from("transactions")
    .update({ is_excluded: excluded })
    .eq("user_id", user.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  const balanceResult = await adjustBalancesForTransactionChanges({
    supabase,
    userId: user.id,
    changes: [
      {
        existingTx: existing,
        nextTx: { ...existing, is_excluded: excluded },
      },
    ],
  });

  if (!balanceResult.success) {
    return { success: false, error: balanceResult.error };
  }

  revalidateFinancialViews();
  return { success: true, data: undefined };
}

export async function bulkExcludeTransactions(
  ids: string[],
  excluded: boolean
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const { data: existing, error: existingError } = await supabase
    .from("transactions")
    .select("account_id, amount, direction, is_excluded, id")
    .eq("user_id", user.id)
    .in("id", ids);

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  const { error } = await supabase
    .from("transactions")
    .update({ is_excluded: excluded })
    .eq("user_id", user.id)
    .in("id", ids);

  if (error) return { success: false, error: error.message };

  const balanceResult = await adjustBalancesForTransactionChanges({
    supabase,
    userId: user.id,
    changes: (existing ?? []).map((tx) => ({
      existingTx: {
        account_id: tx.account_id,
        amount: tx.amount,
        direction: tx.direction,
        is_excluded: tx.is_excluded,
      },
      nextTx: {
        account_id: tx.account_id,
        amount: tx.amount,
        direction: tx.direction,
        is_excluded: excluded,
      },
    })),
  });

  if (!balanceResult.success) {
    return { success: false, error: balanceResult.error };
  }

  revalidateFinancialViews();
  return { success: true, data: undefined };
}
