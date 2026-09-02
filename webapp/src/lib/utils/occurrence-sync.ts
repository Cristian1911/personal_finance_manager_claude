import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, parseISO } from "date-fns";
import {
  DEBT_PAYMENT_COVER_LOOKAHEAD_DAYS,
  OCCURRENCE_AUTO_LINK_DAY_WINDOW,
  OCCURRENCE_UNANCHORED_TOLERANCE,
} from "@zeta/shared";
import { toColombiaDateString } from "@/lib/utils/date";
import type { Database } from "@/types/database";

/**
 * Align `expected_amount` on every *pending* occurrence of a template to a new
 * amount. Use after the template's amount changes (PDF import or manual edit):
 * `ensureCurrentOccurrences()` uses `ON CONFLICT DO NOTHING`, so an
 * already-generated pending occurrence would otherwise keep a stale amount and
 * diverge from the template. `paid`/`skipped` rows are historical — left as-is.
 *
 * Internal helper — NOT a server action. It trusts a caller-supplied `userId`
 * and takes a (non-serializable) Supabase client, so it must only be invoked
 * from already-authenticated server-side code, never from the client. Cache
 * invalidation is the caller's responsibility (both current callers fan out via
 * `revalidateFinancialViews()`, which covers the `occurrences` + `attention`
 * tags).
 */
export async function syncPendingOccurrenceAmounts(
  supabase: SupabaseClient<Database>,
  userId: string,
  templateId: string,
  amount: number,
): Promise<void> {
  const { error } = await supabase
    .from("recurring_occurrences")
    .update({ expected_amount: amount })
    .eq("user_id", userId)
    .eq("template_id", templateId)
    .eq("status", "pending");
  if (error) {
    console.error("syncPendingOccurrenceAmounts error:", error.message);
  }
}

export interface CoveringDebtPayment {
  id: string;
  transaction_date: string;
  amount: number;
}

/**
 * A payment already recorded INTO a debt account that could be carrying the
 * cuota due on `dueDate` (the statement minimum, `expectedAmount`): an
 * unlinked INFLOW inside [due − DEBT_PAYMENT_COVER_LOOKAHEAD_DAYS, due + 3d]
 * with amount ≥ minimum. Largest first — a full-balance payment is the usual
 * carrier. Null when the month's occurrence is not pending anymore (already
 * paid/skipped) or no such payment exists.
 *
 * Read-only: the statement import surfaces this as a hint ("vincúlalo desde
 * Plan"); it never links, because the payment may be a pure extra
 * contribution. Same internal-helper caveats as syncPendingOccurrenceAmounts.
 */
export async function findUnlinkedCoveringDebtPayment(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: {
    accountId: string;
    templateId: string;
    dueDate: string;
    expectedAmount: number;
  },
): Promise<CoveringDebtPayment | null> {
  if (params.expectedAmount <= 0) return null;

  const { data: pending, error: pendingError } = await supabase
    .from("recurring_occurrences")
    .select("id")
    .eq("user_id", userId)
    .eq("template_id", params.templateId)
    .eq("status", "pending")
    .is("transaction_id", null)
    .eq("occurrence_date", params.dueDate)
    .limit(1);
  if (pendingError || !pending || pending.length === 0) return null;

  const base = parseISO(params.dueDate + "T12:00:00");
  const from = toColombiaDateString(
    addDays(base, -DEBT_PAYMENT_COVER_LOOKAHEAD_DAYS),
  );
  const to = toColombiaDateString(addDays(base, OCCURRENCE_AUTO_LINK_DAY_WINDOW));

  const { data, error } = await supabase
    .from("transactions")
    .select("id, transaction_date, amount")
    .eq("user_id", userId)
    .eq("account_id", params.accountId)
    .eq("direction", "INFLOW")
    .is("recurrence_group_id", null)
    .is("reconciled_into_transaction_id", null)
    .gte("transaction_date", from)
    .lte("transaction_date", to)
    .gte("amount", params.expectedAmount * (1 - OCCURRENCE_UNANCHORED_TOLERANCE))
    .order("amount", { ascending: false })
    .limit(1);
  if (error) {
    console.error("findUnlinkedCoveringDebtPayment error:", error.message);
    return null;
  }
  const row = data?.[0];
  if (!row) return null;
  return { id: row.id, transaction_date: row.transaction_date, amount: Number(row.amount) };
}
