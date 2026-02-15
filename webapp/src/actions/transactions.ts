"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transactionSchema, transactionFiltersSchema } from "@/lib/validators/transaction";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { parseMonth, monthStartStr, monthEndStr } from "@/lib/utils/date";
import type { ActionResult, PaginatedResult } from "@/types/actions";
import type { Transaction } from "@/types/domain";

export async function getTransactions(
  filters: Record<string, string | undefined>
): Promise<PaginatedResult<Transaction>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: [], count: 0, page: 1, pageSize: 20, totalPages: 0 };

  const parsed = transactionFiltersSchema.safeParse(filters);
  const params = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 20, showExcluded: false as const };

  const { page, pageSize } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  // If month is set but dateFrom/dateTo are not, derive them
  if (params.month && !params.dateFrom && !params.dateTo) {
    const target = parseMonth(params.month);
    params.dateFrom = monthStartStr(target);
    params.dateTo = monthEndStr(target);
  }

  if (params.accountId) {
    query = query.eq("account_id", params.accountId);
  }
  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }
  if (params.direction) {
    query = query.eq("direction", params.direction);
  }
  if (params.dateFrom) {
    query = query.gte("transaction_date", params.dateFrom);
  }
  if (params.dateTo) {
    query = query.lte("transaction_date", params.dateTo);
  }
  if (params.search) {
    query = query.or(
      `merchant_name.ilike.%${params.search}%,raw_description.ilike.%${params.search}%,clean_description.ilike.%${params.search}%`
    );
  }
  if (params.amountMin !== undefined) {
    query = query.gte("amount", params.amountMin);
  }
  if (params.amountMax !== undefined) {
    query = query.lte("amount", params.amountMax);
  }
  if (!params.showExcluded) {
    query = query.eq("is_excluded", false);
  }

  const { data, error, count } = await query;

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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function createTransaction(
  _prevState: ActionResult<Transaction>,
  formData: FormData
): Promise<ActionResult<Transaction>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const idempotencyKey = await computeIdempotencyKey({
    provider: "MANUAL",
    transactionDate: parsed.data.transaction_date,
    amount: parsed.data.amount,
    rawDescription: parsed.data.raw_description,
  });

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: parsed.data.account_id,
      amount: parsed.data.amount,
      currency_code: parsed.data.currency_code,
      direction: parsed.data.direction,
      transaction_date: parsed.data.transaction_date,
      raw_description: parsed.data.raw_description,
      clean_description: parsed.data.merchant_name || parsed.data.raw_description,
      merchant_name: parsed.data.merchant_name,
      category_id: parsed.data.category_id,
      notes: parsed.data.notes,
      idempotency_key: idempotencyKey,
      provider: "MANUAL",
      categorization_source: parsed.data.category_id ? "USER_CREATED" : "SYSTEM_DEFAULT",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Esta transacción ya existe (duplicada)" };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return { success: true, data };
}

export async function updateTransaction(
  id: string,
  _prevState: ActionResult<Transaction>,
  formData: FormData
): Promise<ActionResult<Transaction>> {
  const supabase = await createClient();

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
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Check if category changed to set USER_OVERRIDE
  const { data: existing } = await supabase
    .from("transactions")
    .select("category_id")
    .eq("id", id)
    .single();

  const categoryChanged = existing?.category_id !== parsed.data.category_id;

  const { data, error } = await supabase
    .from("transactions")
    .update({
      ...parsed.data,
      clean_description: parsed.data.merchant_name || parsed.data.raw_description,
      ...(categoryChanged ? { categorization_source: "USER_OVERRIDE" as const } : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true, data };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return { success: true, data: undefined };
}

export async function toggleExcludeTransaction(
  id: string,
  excluded: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ is_excluded: excluded })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

export async function bulkExcludeTransactions(
  ids: string[],
  excluded: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ is_excluded: excluded })
    .in("id", ids);

  if (error) return { success: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}
