import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { toColombiaDateString } from "@/lib/utils/date";
import { applyAccountBalanceDelta, isDebtAccountType } from "@/lib/utils/account-balance";
import { buildDebtBalanceUpdatePayload } from "@zeta/shared";

// Pure payload builder now lives in @zeta/shared so the webapp Server Actions
// and the mobile offline-first repositories produce a byte-identical update.
// Re-exported here to preserve the existing webapp import surface.
export { buildDebtBalanceUpdatePayload };

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
