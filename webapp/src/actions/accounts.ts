"use server";

import { cacheTag, cacheLife, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { accountSchema } from "@/lib/validators/account";
import {
  computeIdempotencyKey,
  MANUAL_BALANCE_ADJUSTMENT_PREFIX,
} from "@zeta/shared";
import { getDirectionForBalanceDelta, isDebtAccountType } from "@/lib/utils/account-balance";
import { flowClassColumns } from "@/lib/utils/flow-class-columns";
import { toColombiaDateString } from "@/lib/utils/date";
import { deactivateTemplatesForPaidOffAccount } from "@/lib/debt/payoff";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { createTransfer } from "@/actions/transfers";
import {
  parseCurrencyBalanceMap,
  resolveCurrencyBalanceCurrentValue,
  type CurrencyBalanceEntry,
} from "@/lib/utils/currency-balances";
import type { Database } from "@/types/database";
import type { ActionResult } from "@/types/actions";
import { getIsDemoFilter } from "@/lib/demo-filter";
import type { Account, AccountRow, CurrencyCode, TransactionDirection, TransactionWithAccount } from "@/types/domain";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripSensitive({ pdf_password: _, ...rest }: AccountRow): Account {
  return rest;
}

// ─── Cached inner functions ───────────────────────────────────────────────────
// Uses createCachedClient(accessToken) so "use cache" works WITH encryption.
// The admin client has no JWT → zeta_decrypt returns NULL for encrypted columns.

async function getAccountsCached(userId: string, accessToken: string, isDemo: boolean): Promise<Account[]> {
  "use cache";
  cacheTag("accounts");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("is_demo", isDemo)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(stripSensitive);
}

async function getAccountCached(userId: string, id: string, accessToken: string): Promise<Account> {
  "use cache";
  cacheTag("accounts");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .single();

  if (error) throw error;
  return stripSensitive(data);
}

// ─── Public wrappers ──────────────────────────────────────────────────────────

export async function getAccounts(): Promise<ActionResult<Account[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const isDemo = await getIsDemoFilter(user.id);
    const data = await getAccountsCached(user.id, accessToken, isDemo);
    return { success: true, data };
  } catch (error) {
    console.error("Error loading accounts:", error);
    return { success: false, error: "Error al cargar las cuentas" };
  }
}

export async function getAccount(id: string): Promise<ActionResult<Account>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getAccountCached(user.id, id, accessToken);
    return { success: true, data };
  } catch (error) {
    console.error("Error loading account:", error);
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
    card_brand: (() => {
      const v = formData.get("card_brand");
      return !v || v === "NONE" ? undefined : v;
    })(),
    color: formData.get("color") || undefined,
    icon: formData.get("icon") || undefined,
    mask: formData.get("mask") || undefined,
    show_in_dashboard: formData.has("show_in_dashboard") ? formData.get("show_in_dashboard") === "on" : false,
    is_payroll_deducted: formData.has("is_payroll_deducted") ? formData.get("is_payroll_deducted") === "on" : false,
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

  updateTag("accounts");
  updateTag("dashboard:accounts");
  updateTag("dashboard:hero");
  updateTag("debt");
  updateTag("attention");
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

  // Payroll-deducted (libranza) loans: the installment leaves the paycheck
  // before it lands, so an active recurring template would double-count the
  // obligation in Plan / próximos pagos. Deactivate any template tracking
  // this account when the flag is on (idempotent — 0 rows if none).
  if (parsed.data.is_payroll_deducted) {
    const { data: deactivated, error: templateError } = await supabase
      .from("recurring_transaction_templates")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("account_id", id)
      .eq("is_active", true)
      .select("id");
    if (templateError) {
      console.error(
        "[updateAccount] failed to deactivate payroll-deducted templates:",
        templateError.message
      );
    } else {
      // Same housekeeping as deactivateTemplatesForPaidOffAccount: pending
      // unlinked occurrences of a deactivated template never surface again
      // (reads filter inactive templates) — delete them instead of leaving
      // dead rows behind.
      if (deactivated && deactivated.length > 0) {
        const { error: occError } = await supabase
          .from("recurring_occurrences")
          .delete()
          .eq("user_id", user.id)
          .in("template_id", deactivated.map((t) => t.id))
          .eq("status", "pending")
          .is("transaction_id", null);
        if (occError) {
          console.error(
            "[updateAccount] failed to prune pending occurrences:",
            occError.message
          );
        }
      }
      updateTag("recurring");
      updateTag("occurrences");
      updateTag("cashflow-planner");
    }
  }

  updateTag("accounts");
  updateTag("dashboard:accounts");
  updateTag("dashboard:hero");
  updateTag("debt");
  updateTag("attention");
  return { success: true, data: result };
}

/**
 * Mark an account as "principal" (the default account every form pre-selects).
 * "Principal" is just the first account in display_order — accounts are read
 * ordered by it and forms default to accounts[0]. We push the chosen account
 * strictly ahead of the current minimum: a single-row update, no rebalancing.
 * ponytail: display_order drifts negative over repeated calls — harmless, it's
 * only a sort key; switch to an is_primary column if that ever matters.
 */
export async function setPrimaryAccount(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const { data: rows, error: minErr } = await supabase
    .from("accounts")
    .select("display_order")
    .eq("user_id", user.id)
    .order("display_order", { ascending: true })
    .limit(1);
  if (minErr) return { success: false, error: minErr.message };
  const min = rows?.[0]?.display_order ?? 0;

  const { error } = await supabase
    .from("accounts")
    .update({ display_order: min - 1 })
    .eq("user_id", user.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  updateTag("accounts");
  updateTag("dashboard:accounts");
  updateTag("dashboard:hero");
  updateTag("debt");
  updateTag("attention");
  return { success: true, data: undefined };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase.from("accounts").delete().eq("user_id", user.id).eq("id", id);

  if (error) return { success: false, error: error.message };

  // Deleting an account cascades away all of its transactions, so every
  // transaction-derived read (Movimientos, Categorizar, charts, budgets) is
  // stale — the narrow account-only tag list kept serving the deleted rows.
  // Statement snapshots, stored PDF passwords, subscriptions and planner
  // entries cascade too, and none of those tags are financial.
  revalidateFinancialViews();
  updateTag("snapshots");
  updateTag("pdf-passwords");
  updateTag("cashflow-planner");
  updateTag("subscriptions");
  return { success: true, data: undefined };
}

/**
 * Archive a fully-paid debt obligation: zero its balance, deactivate it, stop
 * its recurring cuotas. The account row, its transactions, snapshots and
 * paid occurrences are preserved as history (insights/metrics read them) —
 * nothing is deleted except PENDING occurrences.
 */
export async function archiveDebtObligation(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: account, error: fetchError } = await supabase
    .from("accounts")
    .select("id, account_type, credit_limit")
    .eq("user_id", user.id)
    .eq("id", id)
    .single();

  if (fetchError || !account) {
    return { success: false, error: "No se encontró la cuenta." };
  }
  if (!isDebtAccountType(account.account_type)) {
    return { success: false, error: "Solo se pueden archivar obligaciones (tarjetas o préstamos)." };
  }

  const { error: updateError } = await supabase
    .from("accounts")
    .update({
      current_balance: 0,
      currency_balances: null,
      available_balance: account.credit_limit ?? null,
      is_active: false,
    })
    .eq("user_id", user.id)
    .eq("id", id);

  if (updateError) return { success: false, error: updateError.message };

  await deactivateTemplatesForPaidOffAccount({
    supabase,
    userId: user.id,
    accountId: id,
  });

  // FINANCIAL_TAGS already covers accounts/debt/occurrences/recurring/attention.
  revalidateFinancialViews();
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

  updateTag("accounts");
  updateTag("dashboard:accounts");
  updateTag("dashboard:hero");
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

    const rawDescription = `${MANUAL_BALANCE_ADJUSTMENT_PREFIX} ${currency} (${now})`;
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
      clean_description: MANUAL_BALANCE_ADJUSTMENT_PREFIX,
      merchant_name: null,
      category_id: null,
      notes: input.notes || null,
      idempotency_key: idempotencyKey,
      provider: "MANUAL",
      capture_method: "MANUAL_FORM",
      categorization_source: "SYSTEM_DEFAULT",
      is_excluded: false,
      // A reconciliation plug, not a movement. Today these rows carry no
      // transfer_group_id and are not excluded, so they land in spend or income
      // and inflate whichever side the correction happened to point at —
      // precisely the class of error this work exists to remove.
      //
      // SELF_TRANSFER is the closest of the eight: neutral, counted by neither
      // side. It is not literally a transfer between the user's accounts, and
      // the honest fix is a ninth ADJUSTMENT class. Recorded here rather than
      // added now, because a new class means a CHECK constraint, an enum on
      // both platforms, and a decision about where it sorts in every breakdown.
      flow_class: "SELF_TRANSFER",
      // NULL version, not FLOW_CLASS_RULES_VERSION: no rules version produced
      // this. Running the classifier on `Ajuste de saldo manual` yields SPEND,
      // so stamping a real version would let the next version-keyed backfill
      // "correct" this row into spend — the very thing the comment above says
      // it prevents. NULL means "not classifier-derived, do not re-derive".
      flow_class_version: null,
      source_pattern: null,
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

  // Reconciling inserts balance-adjustment transactions, so the transaction
  // reads must expire with the account ones.
  revalidateFinancialViews();
  return {
    success: true,
    data: {
      delta: currencyDeltas[account.currency_code] ?? 0,
      currencyDeltas,
    },
  };
}

// ─── Quick Payment ───────────────────────────────────────────────────────────

export async function registerPayment(
  accountId: string,
  input: { amount: number; sourceAccountId?: string; notes?: string }
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Get target account details
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, name, account_type, currency_code, current_balance, credit_limit")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (accountError || !account) return { success: false, error: "Cuenta no encontrada" };

  const isDebt = isDebtAccountType(account.account_type);
  const now = new Date().toISOString();
  // Colombia is UTC-5: slicing the ISO string books anything after ~19:00 COT
  // on tomorrow's date.
  const transactionDate = toColombiaDateString(new Date());

  // Paying from one of your own accounts moves money between two accounts —
  // that is a transfer. Delegating to createTransfer gives it both legs (this
  // path used to insert only the INFLOW and mutate the source balance directly,
  // so the source account's movements never explained its own balance), a
  // shared transfer_group_id so no spend metric counts it, a currency check,
  // and full cache invalidation.
  if (input.sourceAccountId) {
    const transferForm = new FormData();
    transferForm.set("fromAccountId", input.sourceAccountId);
    transferForm.set("toAccountId", accountId);
    transferForm.set("amount", String(input.amount));
    transferForm.set("currencyCode", account.currency_code);
    transferForm.set("date", transactionDate);
    if (input.notes) transferForm.set("notes", input.notes);

    const transfer = await createTransfer(
      { success: false, error: "" },
      transferForm,
    );
    if (!transfer.success) return { success: false, error: transfer.error };
    return { success: true, data: null };
  }

  const merchantName = isDebt
    ? `Pago - ${account.name}`
    : `Ingreso - ${account.name}`;
  const rawDescription = isDebt
    ? `Pago manual registrado (${now})`
    : `Ingreso manual registrado (${now})`;

  const idempotencyKey = await computeIdempotencyKey({
    provider: "MANUAL",
    transactionDate,
    amount: input.amount,
    rawDescription,
  });

  // For both debt and savings: INFLOW
  // Debt INFLOW → payment received → balance decreases
  // Savings INFLOW → money received → balance increases
  const direction: TransactionDirection = "INFLOW";

  const { error: txError } = await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: accountId,
    amount: input.amount,
    currency_code: account.currency_code as CurrencyCode,
    direction,
    transaction_date: transactionDate,
    merchant_name: merchantName,
    raw_description: rawDescription,
    clean_description: merchantName,
    idempotency_key: idempotencyKey,
    capture_method: "MANUAL_FORM",
    provider: "MANUAL",
    categorization_source: "SYSTEM_DEFAULT",
    notes: input.notes || null,
    status: "POSTED",
    // Structural: INFLOW to a card/loan is DEBT_CREDIT, INFLOW to a liquid
    // account is INCOME. The same form writes both, which is why the account
    // type decides rather than the caller.
    ...flowClassColumns({
      direction,
      accountType: account.account_type,
      description: merchantName,
    }),
  });

  if (txError) {
    if (txError.code === "23505") {
      return { success: false, error: "Este pago ya fue registrado" };
    }
    return { success: false, error: txError.message };
  }

  // Update target account balance
  if (isDebt) {
    const newBalance = Math.max(0, account.current_balance - input.amount);
    const updateData: Record<string, unknown> = {
      current_balance: newBalance,
      updated_at: now,
    };
    if (account.credit_limit != null) {
      updateData.available_balance = account.credit_limit - newBalance;
    }
    const { error: balanceError } = await supabase.from("accounts").update(updateData).eq("id", accountId).eq("user_id", user.id);
    if (balanceError) {
      return { success: false, error: "Pago registrado pero el saldo no se actualizó. Revisa manualmente." };
    }
  } else {
    const { error: balanceError } = await supabase
      .from("accounts")
      .update({
        current_balance: account.current_balance + input.amount,
        updated_at: now,
      })
      .eq("id", accountId)
      .eq("user_id", user.id);
    if (balanceError) {
      return { success: false, error: "Ingreso registrado pero el saldo no se actualizó. Revisa manualmente." };
    }
  }

  // A transaction was inserted, so the transactions/budgets/charts reads are
  // stale too — the narrow account-only tag list used to hide this payment from
  // Movimientos and Categorizar until the cache TTL expired.
  revalidateFinancialViews();
  return { success: true, data: null };
}

// ─── Spending Pulse (cached, single query) ──────────────────────────────────

async function getAccountSpendingPulseCached(
  userId: string,
  accessToken: string,
  accountId: string,
): Promise<{ monthlySpent: number; dailyActivity: { date: string; amount: number }[] }> {
  "use cache";
  cacheTag("transactions");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

  // Single query: all outflows in last 30 days
  const { data } = await supabase
    .from("transactions")
    .select("transaction_date, amount")
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("direction", "OUTFLOW")
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null)
    .gte("transaction_date", thirtyDaysAgoStr)
    .order("transaction_date", { ascending: true });

  let monthlySpent = 0;
  const dailyMap = new Map<string, number>();

  for (const row of data ?? []) {
    const amt = row.amount ?? 0;
    dailyMap.set(row.transaction_date, (dailyMap.get(row.transaction_date) ?? 0) + amt);
    if (row.transaction_date >= firstOfMonth) {
      monthlySpent += amt;
    }
  }

  const dailyActivity = Array.from(dailyMap, ([date, amount]) => ({ date, amount }));
  return { monthlySpent, dailyActivity };
}

export async function getAccountSpendingPulse(
  accountId: string,
): Promise<{ monthlySpent: number; dailyActivity: { date: string; amount: number }[] }> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { monthlySpent: 0, dailyActivity: [] };
  return getAccountSpendingPulseCached(user.id, accessToken, accountId);
}

// ─── Account Transactions ───────────────────────────────────────────────────

interface AccountTransactionsResult {
  transactions: TransactionWithAccount[];
  hasMore: boolean;
}

async function getAccountTransactionsCached(
  userId: string,
  accessToken: string,
  accountId: string,
  limit: number,
  offset: number
): Promise<AccountTransactionsResult> {
  "use cache";
  cacheTag("transactions");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data, error, count } = await supabase
    .from("transactions")
    .select(
      `*, account:accounts!transactions_account_id_fkey!inner(id, name, icon, color), category:categories!transactions_category_id_fkey(id, name, name_es, icon, color), destinatario:destinatarios!transactions_destinatario_id_fkey(id, name)`,
      { count: "exact" }
    )
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null)
    .order("transaction_date", { ascending: false })
    .order("transaction_time", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    transactions: (data ?? []) as unknown as TransactionWithAccount[],
    hasMore: (count ?? 0) > offset + limit,
  };
}

export async function getAccountTransactions(
  accountId: string,
  opts: { offset?: number; limit?: number } = {}
): Promise<ActionResult<AccountTransactionsResult>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 20;

  try {
    const data = await getAccountTransactionsCached(user.id, accessToken, accountId, limit, offset);
    return { success: true, data };
  } catch (error) {
    console.error("Error loading account transactions:", error);
    return { success: false, error: "Error al cargar las transacciones" };
  }
}

// ─── Account Balance History (transaction-based running balance) ─────────────

async function getAccountBalanceHistoryCached(
  userId: string,
  accessToken: string,
  accountId: string,
  currentBalance: number,
): Promise<{ date: string; balance: number }[]> {
  "use cache";
  cacheTag("transactions");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  // Fetch up to 1 year of transactions for this account (Colombia timezone)
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoffDate = toColombiaDateString(oneYearAgo);

  const { data } = await supabase
    .from("transactions")
    .select("transaction_date, amount, direction")
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null)
    .gte("transaction_date", cutoffDate)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);

  if (!data || data.length === 0) {
    return [{ date: new Date().toISOString().substring(0, 10), balance: currentBalance }];
  }

  // Compute running balance backwards from current balance
  // data is sorted newest-first
  const points: { date: string; balance: number }[] = [];
  let runningBalance = currentBalance;

  // First point: current balance at today (Colombia timezone)
  points.push({ date: toColombiaDateString(new Date()), balance: runningBalance });

  // Walk backwards through transactions, reversing each effect
  for (const tx of data) {
    if (tx.direction === "OUTFLOW") {
      runningBalance += tx.amount; // add back what was spent
    } else {
      runningBalance -= tx.amount; // remove what was received
    }
    points.push({ date: tx.transaction_date, balance: runningBalance });
  }

  // Reverse to get chronological order
  points.reverse();

  // Deduplicate by date (keep last balance per day for cleaner chart)
  const dailyMap = new Map<string, number>();
  for (const p of points) {
    dailyMap.set(p.date, p.balance);
  }

  return Array.from(dailyMap, ([date, balance]) => ({ date, balance }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getAccountBalanceHistory(
  accountId: string,
  currentBalance: number,
): Promise<{ date: string; balance: number }[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  return getAccountBalanceHistoryCached(user.id, accessToken, accountId, currentBalance);
}
