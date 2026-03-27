"use server";

import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountSchema } from "@/lib/validators/account";
import { computeIdempotencyKey } from "@zeta/shared";
import { getDirectionForBalanceDelta } from "@/lib/utils/account-balance";
import {
  parseCurrencyBalanceMap,
  resolveCurrencyBalanceCurrentValue,
  type CurrencyBalanceEntry,
} from "@/lib/utils/currency-balances";
import type { Database } from "@/types/database";
import type { ActionResult } from "@/types/actions";
import type { Account, CurrencyCode } from "@/types/domain";

// ─── Cached inner functions ───────────────────────────────────────────────────

async function getAccountsCached(userId: string): Promise<Account[]> {
  "use cache";
  cacheTag("accounts");
  cacheLife("zeta");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function getAccountCached(userId: string, id: string): Promise<Account> {
  "use cache";
  cacheTag("accounts");
  cacheLife("zeta");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// ─── Public wrappers ──────────────────────────────────────────────────────────

export async function getAccounts(): Promise<ActionResult<Account[]>> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const data = await getAccountsCached(user.id);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar las cuentas" };
  }
}

export async function getAccount(id: string): Promise<ActionResult<Account>> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const data = await getAccountCached(user.id, id);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar la cuenta" };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    show_in_dashboard: formData.has("show_in_dashboard") ? formData.get("show_in_dashboard") === "on" : false,
  };

  // Filter out undefined/null values for cleaner insert
  return Object.fromEntries(
    Object.entries(baseData).filter(([_, v]) => v !== undefined && v !== "")
  );
}

type ReconcileBalanceInput = {
  currentBalance?: number;
  currencyBalances?: Record<string, number>;
  notes?: string;
};

function buildPrimaryCurrencyEntry(account: Account): CurrencyBalanceEntry {
  return {
    current_balance: account.current_balance ?? 0,
    credit_limit: account.credit_limit,
    available_balance: account.available_balance,
    interest_rate: account.interest_rate,
    minimum_payment: account.monthly_payment,
    total_payment_due: null,
  };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createAccount(
  _prevState: ActionResult<Account>,
  formData: FormData
): Promise<ActionResult<Account>> {
  const { supabase, user } = await getAuthenticatedClient();

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

  revalidateTag("accounts", "zeta");
  revalidateTag("dashboard:accounts", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  revalidateTag("debt", "zeta");
  return { success: true, data: result };
}

export async function updateAccount(
  id: string,
  _prevState: ActionResult<Account>,
  formData: FormData
): Promise<ActionResult<Account>> {
  const { supabase, user } = await getAuthenticatedClient();

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

  revalidateTag("accounts", "zeta");
  revalidateTag("dashboard:accounts", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  revalidateTag("debt", "zeta");
  return { success: true, data: result };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase.from("accounts").delete().eq("user_id", user.id).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidateTag("accounts", "zeta");
  revalidateTag("dashboard:accounts", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  revalidateTag("debt", "zeta");
  return { success: true, data: undefined };
}

export async function toggleDashboardVisibility(
  accountId: string,
  show: boolean
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("accounts")
    .update({ show_in_dashboard: show })
    .eq("user_id", user.id)
    .eq("id", accountId);

  if (error) return { success: false, error: error.message };

  revalidateTag("accounts", "zeta");
  revalidateTag("dashboard:accounts", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  return { success: true, data: undefined };
}

export async function reconcileBalance(
  accountId: string,
  input: ReconcileBalanceInput
): Promise<ActionResult<{ delta: number; currencyDeltas: Record<string, number> }>> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  // Fetch account and validate ownership
  const { data: account, error: fetchError } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", accountId)
    .single();

  if (fetchError || !account) {
    return { success: false, error: fetchError?.message ?? "Cuenta no encontrada" };
  }

  const requestedBalances =
    input.currencyBalances && Object.keys(input.currencyBalances).length > 0
      ? input.currencyBalances
      : input.currentBalance != null
        ? { [account.currency_code]: input.currentBalance }
        : {};

  const currencyDeltas: Record<string, number> = {};
  const existingCurrencyBalances = parseCurrencyBalanceMap(account.currency_balances);
  const shouldPersistCurrencyBalances =
    account.currency_balances !== null ||
    Object.keys(requestedBalances).some((currency) => currency !== account.currency_code);
  const now = new Date().toISOString();
  const adjustmentRows: Database["public"]["Tables"]["transactions"]["Insert"][] = [];

  for (const [currency, newBalance] of Object.entries(requestedBalances)) {
    if (!Number.isFinite(newBalance) || newBalance < 0) {
      return { success: false, error: `Saldo invalido para ${currency}` };
    }

    const baseEntry =
      currency === account.currency_code
        ? {
            ...buildPrimaryCurrencyEntry(account),
            ...(existingCurrencyBalances[currency] ?? {}),
          }
        : (existingCurrencyBalances[currency] ?? {
            current_balance: null,
            credit_limit: null,
            available_balance: null,
            interest_rate: null,
            minimum_payment: null,
            total_payment_due: null,
          });

    const previousBalance =
      currency === account.currency_code
        ? account.current_balance ?? 0
        : resolveCurrencyBalanceCurrentValue(baseEntry);
    const delta = newBalance - previousBalance;

    currencyDeltas[currency] = delta;

    if (shouldPersistCurrencyBalances) {
      const nextEntry: CurrencyBalanceEntry = {
        ...baseEntry,
        current_balance: newBalance,
      };

      if (account.account_type === "CREDIT_CARD") {
        const creditLimit =
          nextEntry.credit_limit ??
          (currency === account.currency_code ? account.credit_limit : null);

        nextEntry.total_payment_due = newBalance;
        if (creditLimit != null) {
          nextEntry.credit_limit = creditLimit;
          nextEntry.available_balance = Math.max(creditLimit - newBalance, 0);
        }
      }

      existingCurrencyBalances[currency] = nextEntry;
    }

    if (delta === 0) continue;

    const adjustmentDirection = getDirectionForBalanceDelta({
      accountType: account.account_type,
      delta,
    });

    if (!adjustmentDirection) {
      return { success: false, error: "No se pudo determinar el ajuste de saldo." };
    }

    const rawDescription = `Ajuste manual de saldo ${currency} (${now})`;
    const idempotencyKey = await computeIdempotencyKey({
      provider: "MANUAL",
      transactionDate: now.slice(0, 10),
      amount: Math.abs(delta),
      rawDescription,
    });

    adjustmentRows.push({
      user_id: user.id,
      account_id: accountId,
      amount: Math.abs(delta),
      currency_code: currency as CurrencyCode,
      direction: adjustmentDirection,
      transaction_date: now.slice(0, 10),
      raw_description: rawDescription,
      clean_description: "Ajuste manual de saldo",
      merchant_name: null,
      category_id: null,
      notes: input.notes || null,
      idempotency_key: idempotencyKey,
      provider: "MANUAL",
      capture_method: "MANUAL_FORM",
      categorization_source: "SYSTEM_DEFAULT",
      is_excluded: false,
    });
  }

  if (adjustmentRows.length > 0) {
    const { error: txError } = await supabase.from("transactions").insert(adjustmentRows);

    if (txError) return { success: false, error: txError.message };
  }

  const primaryBalance =
    requestedBalances[account.currency_code] ?? account.current_balance ?? 0;
  const accountUpdate: Database["public"]["Tables"]["accounts"]["Update"] = {
    current_balance: primaryBalance,
    updated_at: now,
    ...(account.account_type === "CREDIT_CARD"
      ? {
          ...(account.credit_limit != null
            ? { available_balance: Math.max(account.credit_limit - primaryBalance, 0) }
            : {}),
        }
      : {}),
    ...(shouldPersistCurrencyBalances
      ? { currency_balances: existingCurrencyBalances as unknown as Database["public"]["Tables"]["accounts"]["Update"]["currency_balances"] }
      : {}),
  };
  const { error: updateError } = await supabase
    .from("accounts")
    .update(accountUpdate)
    .eq("user_id", user.id)
    .eq("id", accountId);

  if (updateError) return { success: false, error: updateError.message };

  revalidateTag("accounts", "zeta");
  revalidateTag("dashboard:accounts", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  revalidateTag("debt", "zeta");
  return {
    success: true,
    data: {
      delta: currencyDeltas[account.currency_code] ?? 0,
      currencyDeltas,
    },
  };
}
