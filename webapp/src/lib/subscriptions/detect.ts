import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectSubscriptions, type DetectorTransaction } from "@zeta/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { toColombiaDateString } from "@/lib/utils/date";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Core of subscription detection: reads the last 12 months of OUTFLOW rows that
 * have a destinatario, skips destinatarios that already own ANY `subscriptions`
 * row (sticky dismissal, no duplicates of active/cancelled ones) and inserts a
 * `suggested` row per candidate. Returns how many rows were created.
 *
 * Client-agnostic on purpose: Server Actions pass the authenticated client,
 * webhooks (Telegram, /api/capture, email) pass the admin client. None of the
 * columns read here are encrypted, so the admin client sees real values. Every
 * query filters by `user_id` regardless of the client. No cache calls here: the
 * caller decides between `updateTag` (Server Action) and `revalidateTag` (Route
 * Handler).
 */
export async function detectAndSuggestSubscriptions(
  client: Client,
  userId: string,
): Promise<number> {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);

  const [{ data: txs }, { data: existing }] = await Promise.all([
    client
      .from("transactions")
      .select("destinatario_id, transaction_date, amount, currency_code, direction")
      .eq("user_id", userId)
      .eq("direction", "OUTFLOW")
      .not("destinatario_id", "is", null)
      .gte("transaction_date", toColombiaDateString(since)),
    client.from("subscriptions").select("destinatario_id").eq("user_id", userId),
  ]);

  const excluded = new Set((existing ?? []).map((r) => r.destinatario_id));
  const candidates = detectSubscriptions((txs ?? []) as DetectorTransaction[], excluded);
  if (candidates.length === 0) return 0;

  const rows = candidates.map((c) => ({
    user_id: userId,
    destinatario_id: c.destinatario_id,
    status: "suggested" as const,
    estimated_amount: c.median_amount,
    currency_code: c.currency_code,
    detected_at: new Date().toISOString(),
  }));

  const { data: inserted, error } = await client.from("subscriptions").insert(rows).select("id");
  if (error && error.code !== "23505") throw new Error(error.message);
  return inserted?.length ?? 0;
}

/**
 * Runs detection once the response has been sent, so a capture never waits on
 * it. `after()` callbacks execute inside Next's `withExecuteRevalidates`
 * (see `next/dist/server/after/after-context.js`), so `invalidate` — pass
 * `() => updateTag("subscriptions")` from a Server Action or
 * `() => revalidateTag("subscriptions", "zeta")` from a Route Handler — is
 * flushed when the callback settles. Stale-while-revalidate is fine here: a
 * suggestion is not read-your-own-writes.
 *
 * Uses the admin client because a cookie-backed session client is not
 * guaranteed to stay readable after the request closes; scope stays per user
 * through `userId`.
 */
export function scheduleSubscriptionDetection(userId: string, invalidate: () => void): void {
  after(async () => {
    try {
      const created = await detectAndSuggestSubscriptions(createAdminClient(), userId);
      if (created > 0) invalidate();
    } catch (error) {
      console.error("[subscriptions] background detection failed", error);
    }
  });
}
