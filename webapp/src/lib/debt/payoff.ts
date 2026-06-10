import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { toColombiaDateString } from "@/lib/utils/date";

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
