"use server";

import { cacheLife, cacheTag } from "next/cache";
import {
  detectRecurringCandidates,
  type RecurringCandidate,
  type RecurringCandidateTransaction,
} from "@zeta/shared";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { toColombiaDateString } from "@/lib/utils/date";

/** Three months plus slack so a charge on the 1st still sees the one three months back. */
const LOOKBACK_DAYS = 100;

/**
 * Recurring-charge candidates for the "Parece recurrente" discovery
 * (Primeras semanas, spec §4.3). Runs the shared detector over the user's
 * recent OUTFLOW rows. Must stay on the authenticated cached client: the
 * description fallback reads `clean_description`, which is encrypted and
 * comes back NULL through the admin client.
 */
async function getRecurringCandidatesCached(
  userId: string,
  accessToken: string,
): Promise<RecurringCandidate[]> {
  "use cache";
  cacheTag("transactions", "recurring");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const [{ data: txs, error }, { data: templates }] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, destinatario_id, clean_description, transaction_date, amount, currency_code, direction, flow_class_effective",
      )
      .eq("user_id", userId)
      .eq("direction", "OUTFLOW")
      .eq("is_excluded", false)
      .is("reconciled_into_transaction_id", null)
      .is("recurrence_group_id", null)
      .gte("transaction_date", toColombiaDateString(since)),
    supabase
      .from("recurring_transaction_templates")
      .select("destinatario_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .not("destinatario_id", "is", null),
  ]);
  if (error) throw error;

  // ponytail: a destinatario with an active template is already scheduled.
  // Description-keyed groups can't be matched to templates without comparing
  // merchant names, so they only drop once one of their rows gets linked
  // (recurrence_group_id). Upgrade to a name match if a stale chip shows up.
  const scheduled = new Set((templates ?? []).map((t) => t.destinatario_id));

  const rows: RecurringCandidateTransaction[] = (txs ?? []).map((t) => ({
    id: t.id,
    destinatario_id: t.destinatario_id,
    clean_description: t.clean_description,
    transaction_date: t.transaction_date,
    amount: Number(t.amount),
    currency_code: t.currency_code,
    direction: t.direction as "INFLOW" | "OUTFLOW",
    flow_class: t.flow_class_effective,
  }));

  return detectRecurringCandidates(rows).filter(
    (c) => !c.destinatario_id || !scheduled.has(c.destinatario_id),
  );
}

export async function getRecurringCandidates(): Promise<RecurringCandidate[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  try {
    return await getRecurringCandidatesCached(user.id, accessToken);
  } catch (error) {
    console.error("getRecurringCandidates failed", error);
    return [];
  }
}

/** The candidate group this transaction belongs to, if any. */
export async function getRecurringCandidateForTransaction(
  transactionId: string,
): Promise<RecurringCandidate | null> {
  const candidates = await getRecurringCandidates();
  return candidates.find((c) => c.transaction_ids.includes(transactionId)) ?? null;
}
