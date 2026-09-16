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
 * recent OUTFLOW rows and drops groups that are already scheduled. Must stay
 * on the authenticated cached client: the description fallback reads
 * `clean_description`, which is encrypted and comes back NULL through the
 * admin client.
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
        "id, destinatario_id, clean_description, transaction_date, amount, currency_code, direction, flow_class_effective, recurrence_group_id",
      )
      .eq("user_id", userId)
      .eq("direction", "OUTFLOW")
      .eq("is_excluded", false)
      .is("reconciled_into_transaction_id", null)
      // Cuotas of one purchase look monthly and stable but are not a recurrente.
      .is("installment_group_id", null)
      .gte("transaction_date", toColombiaDateString(since)),
    supabase
      .from("recurring_transaction_templates")
      .select("destinatario_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .not("destinatario_id", "is", null),
  ]);
  if (error) throw error;

  // Two "already scheduled" signals, checked on the whole group so siblings of
  // a promoted charge drop with it: (1) a destinatario with an active template,
  // (2) any member linked to an occurrence (`recurrence_group_id`, stamped by
  // Programar and by every auto-link path). Linked rows stay in the detector
  // input on purpose — that is what makes their group form and then drop whole.
  // ponytail: templates created from scratch for a destinatario-less merchant
  // are not matched by name; the chip drops once a charge gets linked.
  const scheduledDestinatarios = new Set((templates ?? []).map((t) => t.destinatario_id));
  const linkedTxIds = new Set((txs ?? []).filter((t) => t.recurrence_group_id).map((t) => t.id));

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
    (c) =>
      !(c.destinatario_id && scheduledDestinatarios.has(c.destinatario_id)) &&
      !c.transaction_ids.some((id) => linkedTxIds.has(id)),
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
