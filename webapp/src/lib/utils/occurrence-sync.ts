import type { SupabaseClient } from "@supabase/supabase-js";
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
