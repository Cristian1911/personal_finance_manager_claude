import { supabase } from "../supabase";

/**
 * Count of `pending_email_transactions` with `status = 'pending'` for the
 * current user. Used by the "Por resolver" tile on Inicio.
 *
 * Remote-only (the table isn't synced to SQLite). Returns 0 on auth or
 * network failure so the dashboard never blocks on this number.
 *
 * Defense-in-depth: filters on `user_id` explicitly even though RLS
 * already enforces it, matching the project-wide policy.
 */
export async function getPendingEmailTransactionsCount(): Promise<number> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return 0;

  // The mobile Database type doesn't enumerate `pending_email_transactions`
  // (it's a webapp-managed table not synced to local SQLite). Cast through
  // `any` for the table name only — the column shape stays unchanged.
  const { count, error } = await (supabase as any)
    .from("pending_email_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}
