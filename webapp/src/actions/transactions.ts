"use server";

import { revalidateTag } from "next/cache";
import { autoCategorize, computeIdempotencyKey } from "@zeta/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import {
  quickCapturePreviewSchema,
  transactionFiltersSchema,
  transactionSchema,
} from "@/lib/validators/transaction";
import { parseMonth, monthStartStr, monthEndStr } from "@/lib/utils/date";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";
import {
  applyAccountBalanceDelta,
  reverseAccountBalanceDelta,
} from "@/lib/utils/account-balance";
import type { ActionResult, PaginatedResult } from "@/types/actions";
import type { Transaction } from "@/types/domain";

type PersistTransactionParams = {
  userId: string;
  account_id: string;
  amount: number;
  currency_code: Transaction["currency_code"];
  direction: Transaction["direction"];
  transaction_date: string;
  raw_description?: string | null;
  merchant_name?: string | null;
  category_id?: string | null;
  notes?: string | null;
  capture_method?: Transaction["capture_method"];
  capture_input_text?: string | null;
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

function revalidateFinancialViews() {
  revalidateTag("accounts", "zeta");
  revalidateTag("dashboard:accounts", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
  revalidateTag("dashboard:cashflow", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  revalidateTag("categorize", "zeta");
  revalidateTag("debt", "zeta");
  revalidateTag("budgets", "zeta");
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
      raw_description: params.raw_description ?? null,
      clean_description: params.merchant_name || params.raw_description || null,
      merchant_name: params.merchant_name ?? null,
      category_id: params.category_id ?? null,
      notes: params.notes ?? null,
      idempotency_key: idempotencyKey,
      provider: "MANUAL",
      capture_method: params.capture_method ?? "MANUAL_FORM",
      capture_input_text: params.capture_input_text ?? null,
      categorization_source: params.category_id ? "USER_CREATED" : "SYSTEM_DEFAULT",
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

export async function getTransactions(
  filters: Record<string, string | undefined>
): Promise<PaginatedResult<Transaction>> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { data: [], count: 0, page: 1, pageSize: 20, totalPages: 0 };

  const parsed = transactionFiltersSchema.safeParse(filters);
  const params = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 20, showExcluded: false as const };

  const { page, pageSize } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (params.month && !params.dateFrom && !params.dateTo) {
    const target = parseMonth(params.month);
    params.dateFrom = monthStartStr(target);
    params.dateTo = monthEndStr(target);
  }

  const buildQuery = () => {
    let query = supabase
      .from("transactions")
      .select("*", { count: "exact" })
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (params.accountId) query = query.eq("account_id", params.accountId);
    if (params.categoryId) query = query.eq("category_id", params.categoryId);
    if (params.direction) query = query.eq("direction", params.direction);
    if (params.dateFrom) query = query.gte("transaction_date", params.dateFrom);
    if (params.dateTo) query = query.lte("transaction_date", params.dateTo);
    if (params.search) {
      // Escape PostgREST filter special characters to prevent filter injection
      const sanitized = params.search
        .slice(0, 200)
        .replace(/[\\%_]/g, (c) => `\\${c}`)
        .replace(/[.,()]/g, "");
      query = query.or(
        `merchant_name.ilike.%${sanitized}%,raw_description.ilike.%${sanitized}%,clean_description.ilike.%${sanitized}%`
      );
    }
    if (params.amountMin !== undefined) query = query.gte("amount", params.amountMin);
    if (params.amountMax !== undefined) query = query.lte("amount", params.amountMax);
    if (!params.showExcluded) query = query.eq("is_excluded", false);

    return query;
  };

  const { data, error, count } = await executeVisibleTransactionQuery(buildQuery);
  if (error) return { data: [], count: 0, page, pageSize, totalPages: 0 };

  return {
    data: data ?? [],
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getTransaction(id: string): Promise<ActionResult<Transaction>> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await executeVisibleTransactionQuery(() =>
    supabase.from("transactions").select("*").eq("user_id", user.id).eq("id", id).single()
  );

  if (error) return { success: false, error: error.message };
  return { success: true, data };
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
    raw_description: formData.get("raw_description") || undefined,
    merchant_name: formData.get("merchant_name") || undefined,
    category_id: formData.get("category_id") || undefined,
    notes: formData.get("notes") || undefined,
    capture_input_text: formData.get("capture_input_text") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return persistTransaction(supabase, {
    userId: user.id,
    ...parsed.data,
    merchant_name: parsed.data.merchant_name || parsed.data.raw_description || null,
    capture_method: "MANUAL_FORM",
  });
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
    raw_description: formData.get("raw_description"),
    merchant_name: formData.get("merchant_name"),
    category_id: formData.get("category_id") || undefined,
    notes: formData.get("notes") || undefined,
    capture_input_text: formData.get("capture_input_text"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const suggestion =
    parsed.data.category_id ?? autoCategorize(parsed.data.merchant_name)?.category_id ?? null;

  return persistTransaction(supabase, {
    userId: user.id,
    ...parsed.data,
    category_id: suggestion,
    capture_method: "TEXT_QUICK_CAPTURE",
  });
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

  const { data, error } = await supabase
    .from("transactions")
    .update({
      ...parsed.data,
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
