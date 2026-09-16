import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyModoCandidate } from "@zeta/shared";
import type { Database } from "@/types/database";
import { attachTagsToTransactions } from "@/lib/tags/attach-transaction-tags";

type CaptureMethod = Database["public"]["Enums"]["transaction_capture_method"];

export type ActiveModoTagTx = {
  id: string;
  transaction_date: string;
  direction: "INFLOW" | "OUTFLOW";
  capture_method: CaptureMethod;
  /** `flow_class` as written by `flowClassColumns()` (the effective value on insert). */
  flow_class?: string | null;
  currency_code?: string | null;
  is_excluded?: boolean | null;
  is_recurring?: boolean | null;
  is_subscription?: boolean | null;
  recurrence_group_id?: string | null;
  installment_group_id?: string | null;
  transfer_group_id?: string | null;
  personal_debt_id?: string | null;
};

export type ActiveModoTagResult =
  | { tagged: true; modoId: string; tagId: string }
  | { tagged: false; reason: string };

/**
 * Post-insert enrichment for the active viaje/evento: when the user is "in"
 * a trip, a transaction they just typed in (form, quick capture, voice,
 * Telegram) gets the trip's tag without asking. Imports never come through
 * here — they go to the review tray.
 *
 * Modeled on `linkTransactionToOccurrence`: takes whichever client the caller
 * has (authenticated or admin — `modos`, `transaction_tags` and
 * `modo_tx_reviews` are plain tables), never throws, never fails the parent
 * write, and never touches `next/cache` — the caller invalidates (`updateTag`
 * in server actions, `revalidateTag(..., "zeta")` in route handlers).
 *
 * Call it AFTER `linkTransactionToOccurrence`: a manual rent payment entered
 * mid-trip is recurring, but the row only says so once the occurrence link
 * exists, which this helper checks with one indexed lookup.
 */
export async function applyActiveModoTag(
  supabase: SupabaseClient<Database>,
  userId: string,
  tx: ActiveModoTagTx,
): Promise<ActiveModoTagResult> {
  try {
    const { data: modo } = await supabase
      .from("modos")
      .select("id, auto_tag_id, date_from, date_to, tag_ids")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!modo) return { tagged: false, reason: "no_active_modo" };
    if (!modo.auto_tag_id) return { tagged: false, reason: "no_auto_tag" };
    // Cheap early exit before paying the occurrence lookup.
    if (tx.transaction_date < modo.date_from || tx.transaction_date > modo.date_to) {
      return { tagged: false, reason: "out_of_range" };
    }

    const { data: occurrence } = await supabase
      .from("recurring_occurrences")
      .select("id")
      .eq("user_id", userId)
      .eq("transaction_id", tx.id)
      .limit(1)
      .maybeSingle();

    const verdict = classifyModoCandidate(
      { ...tx, linkedToOccurrence: !!occurrence },
      { date_from: modo.date_from, date_to: modo.date_to, tag_ids: modo.tag_ids },
    );
    if (verdict.verdict !== "auto") return { tagged: false, reason: verdict.reason };

    const attach = await attachTagsToTransactions(supabase, userId, [tx.id], [modo.auto_tag_id]);
    if (attach.error) return { tagged: false, reason: attach.error };

    // Remember the decision so the tray never re-proposes the row and the
    // detail can show it was tagged automatically. Duplicate = already decided.
    await supabase.from("modo_tx_reviews").upsert(
      {
        modo_id: modo.id,
        user_id: userId,
        transaction_id: tx.id,
        decision: "included",
        source: "auto",
      },
      { onConflict: "modo_id,transaction_id", ignoreDuplicates: true },
    );

    return { tagged: true, modoId: modo.id, tagId: modo.auto_tag_id };
  } catch (err) {
    console.error("applyActiveModoTag failed", { transactionId: tx.id, err });
    return { tagged: false, reason: "error" };
  }
}
