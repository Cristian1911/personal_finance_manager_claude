"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { accountSchema } from "@/lib/validators/account";
import type { ActionResult } from "@/types/actions";
import type { Account } from "@/types/domain";

export async function getAccounts(): Promise<ActionResult<Account[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}

export async function getAccount(id: string): Promise<ActionResult<Account>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", id)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

function combineDateFields(formData: FormData, monthKey: string, yearKey: string): string | undefined {
  const month = formData.get(monthKey);
  const year = formData.get(yearKey);
  if (!month || !year) return undefined;
  return `${year}-${String(Number(month)).padStart(2, "0")}-01`;
}

function buildAccountInsertData(formData: FormData) {
  const baseData = {
    name: formData.get("name"),
    account_type: formData.get("account_type"),
    institution_name: formData.get("institution_name") || undefined,
    current_balance: formData.get("current_balance"),
    currency_code: formData.get("currency_code"),
    credit_limit: formData.get("credit_limit") || undefined,
    interest_rate: formData.get("interest_rate") || undefined,
    cutoff_day: formData.get("cutoff_day") || undefined,
    payment_day: formData.get("payment_day") || undefined,
    loan_amount: formData.get("loan_amount") || undefined,
    monthly_payment: formData.get("monthly_payment") || undefined,
    loan_start_date: combineDateFields(formData, "loan_start_month", "loan_start_year"),
    loan_end_date: combineDateFields(formData, "loan_end_month", "loan_end_year"),
    initial_investment: formData.get("initial_investment") || undefined,
    expected_return_rate: formData.get("expected_return_rate") || undefined,
    maturity_date: combineDateFields(formData, "maturity_month", "maturity_year"),
    color: formData.get("color") || undefined,
    icon: formData.get("icon") || undefined,
    mask: formData.get("mask") || undefined,
  };

  // Filter out undefined/null values for cleaner insert
  return Object.fromEntries(
    Object.entries(baseData).filter(([_, v]) => v !== undefined && v !== "")
  );
}

export async function createAccount(
  _prevState: ActionResult<Account>,
  formData: FormData
): Promise<ActionResult<Account>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const data = buildAccountInsertData(formData);

  const parsed = accountSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Get next display_order
  const { count } = await supabase
    .from("accounts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: result, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      ...parsed.data,
      display_order: (count ?? 0) + 1,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { success: true, data: result };
}

export async function updateAccount(
  id: string,
  _prevState: ActionResult<Account>,
  formData: FormData
): Promise<ActionResult<Account>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const data = buildAccountInsertData(formData);

  const parsed = accountSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data: result, error } = await supabase
    .from("accounts")
    .update(parsed.data)
    .eq("user_id", user.id)
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { success: true, data: result };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase.from("accounts").delete().eq("user_id", user.id).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true, data: undefined };
}
