import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { toColombiaDateString } from "@/lib/utils/date";
import { applyAccountBalanceDelta, isDebtAccountType } from "@/lib/utils/account-balance";

/**
 * Build the accounts-row update payload for a debt account whose balance just
 * changed: current_balance, available_balance, and the currency_balances
 * JSONB that /deudas reads via extractDebtAccounts. Single source of truth —
 * every debt-payment path (checklist, extra payment, auto-linked companion
 * leg) must write these fields together or the page shows stale debt.
 */
export function buildDebtBalanceUpdatePayload(
  account: {
    credit_limit: number | null;
    currency_balances: unknown;
  },
  nextBalance: number,
  currencyCode: string
): Record<string, unknown> {
  const nextAvailable =
    account.credit_limit != null ? Math.max(account.credit_limit - nextBalance, 0) : undefined;

  const updatePayload: Record<string, unknown> = { current_balance: nextBalance };
  if (nextAvailable !== undefined) updatePayload.available_balance = nextAvailable;

  const cb = account.currency_balances as Record<string, Record<string, unknown>> | null;
  if (cb && cb[currencyCode]) {
    updatePayload.currency_balances = {
      ...cb,
      [currencyCode]: {
        ...cb[currencyCode],
        current_balance: nextBalance,
        total_payment_due: Math.max(nextBalance, 0),
        ...(nextAvailable !== undefined ? { available_balance: nextAvailable } : {}),
      },
    };
  }

  return updatePayload;
}

/**
 * Apply a payment (INFLOW) to a debt account's stored balances. Deactivates
 * the account's recurring templates when the balance reaches 0 (payoff
 * lifecycle).
 */
export async function applyDebtPaymentToBalances(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  accountId: string;
  amount: number;
  currencyCode: string;
}): Promise<void> {
  const { supabase, userId, accountId, amount, currencyCode } = params;

  const { data: account, error } = await supabase
    .from("accounts")
    .select("id, account_type, current_balance, credit_limit, currency_balances")
    .eq("user_id", userId)
    .eq("id", accountId)
    .single();

  if (error || !account || !isDebtAccountType(account.account_type)) return;

  const nextBalance = applyAccountBalanceDelta({
    currentBalance: account.current_balance,
    accountType: account.account_type,
    direction: "INFLOW",
    amount,
  });

  const { error: updateError } = await supabase
    .from("accounts")
    .update(buildDebtBalanceUpdatePayload(account, nextBalance, currencyCode))
    .eq("id", accountId)
    .eq("user_id", userId);

  if (updateError) {
    console.error("[payoff] debt balance update failed", { accountId, error: updateError.message });
    return;
  }

  if (nextBalance <= 0) {
    await deactivateTemplatesForPaidOffAccount({ supabase, userId, accountId });
  }
}

/**
 * Payoff lifecycle: when a debt obligation is fully paid (balance reaches 0)
 * or the user archives it, its recurring template(s) must stop generating
 * cuotas. Deactivates active templates (end_date = today, rows preserved as
 * history) and removes only PENDING occurrences — paid/skipped occurrences
 * stay for metrics and insights.
 *
 * Returns the number of templates deactivated.
 */
export async function deactivateTemplatesForPaidOffAccount(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  accountId: string;
}): Promise<number> {
  const { supabase, userId, accountId } = params;
  const today = toColombiaDateString(new Date());

  const { data: deactivated, error } = await supabase
    .from("recurring_transaction_templates")
    .update({ is_active: false, end_date: today })
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("is_active", true)
    .select("id");

  if (error) {
    console.error("[payoff] template deactivation failed", {
      accountId,
      error: error.message,
    });
    return 0;
  }
  if (!deactivated || deactivated.length === 0) return 0;

  const { error: occError } = await supabase
    .from("recurring_occurrences")
    .delete()
    .eq("user_id", userId)
    .eq("status", "pending")
    .in(
      "template_id",
      deactivated.map((t) => t.id)
    );

  if (occError) {
    console.error("[payoff] pending occurrence cleanup failed", {
      accountId,
      error: occError.message,
    });
  }

  return deactivated.length;
}
