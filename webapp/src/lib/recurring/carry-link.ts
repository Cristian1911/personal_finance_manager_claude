import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Move a recurring-occurrence link from a transaction that is being
 * reconciled away onto the surviving transaction.
 *
 * Reconciliation keeps both rows and hides the superseded one behind
 * `reconciled_into_transaction_id`. Before this helper existed the link
 * (`transactions.recurrence_group_id` + `recurring_occurrences.transaction_id`)
 * stayed on the hidden row, so the survivor looked unlinked: it kept showing
 * up in "Vincular" as a duplicate, the occurrence pointed at a row no view
 * renders, and reverting the occurrence touched the wrong transaction.
 *
 * The survivor may already have earned its own auto-link on insert
 * (`linkTransactionToOccurrence` runs before the merge). The carry therefore
 * only happens when the survivor is unlinked, or linked to the very same
 * series — never when it already belongs to a different occurrence, because
 * one transaction paying two occurrences desynchronises `revertOccurrence`'s
 * clear-by-group-id logic. In that case the superseded row keeps its link
 * (the pre-existing behaviour) and we log it.
 *
 * Best-effort: a failure here must not fail the import that triggered it.
 */
export async function carryRecurringLinkToSurvivor(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  supersededId: string;
  survivorId: string;
  recurrenceGroupId: string | null | undefined;
}): Promise<void> {
  const { supabase, userId, supersededId, survivorId, recurrenceGroupId } = params;
  if (!recurrenceGroupId) return;

  // Stamp only when the survivor is unlinked; the returned rows tell us
  // whether that happened without a separate read.
  const { data: stamped, error: groupErr } = await supabase
    .from("transactions")
    .update({ recurrence_group_id: recurrenceGroupId })
    .eq("user_id", userId)
    .eq("id", survivorId)
    .is("recurrence_group_id", null)
    .select("id");

  if (groupErr) {
    console.error("[carryRecurringLinkToSurvivor] recurrence_group_id", groupErr.message);
    return;
  }

  if (!stamped || stamped.length === 0) {
    // Survivor already carries a link — repoint only if it is the same series.
    const { data: survivor, error: readErr } = await supabase
      .from("transactions")
      .select("recurrence_group_id")
      .eq("user_id", userId)
      .eq("id", survivorId)
      .maybeSingle();
    if (readErr) {
      console.error("[carryRecurringLinkToSurvivor] survivor read", readErr.message);
      return;
    }
    if (survivor?.recurrence_group_id !== recurrenceGroupId) {
      console.warn(
        "[carryRecurringLinkToSurvivor] survivor already linked to another occurrence; leaving link on superseded row",
        { supersededId, survivorId },
      );
      return;
    }
  }

  // The survivor is a pre-existing ledger row (an import), never a payment
  // the occurrence created: flag the link as manual so `revertOccurrence`
  // unlinks it instead of trying to delete a bank-verified transaction.
  // The superseded row leaves the series at the same time, so group reads
  // (revert, phantom swap) keep seeing exactly one visible leg.
  const [{ error: occErr }, { error: clearErr }] = await Promise.all([
    supabase
      .from("recurring_occurrences")
      .update({ transaction_id: survivorId, linked_manually: true })
      .eq("user_id", userId)
      .eq("transaction_id", supersededId),
    supabase
      .from("transactions")
      .update({ recurrence_group_id: null })
      .eq("user_id", userId)
      .eq("id", supersededId),
  ]);

  if (occErr) {
    console.error("[carryRecurringLinkToSurvivor] occurrence repoint", occErr.message);
  }
  if (clearErr) {
    console.error("[carryRecurringLinkToSurvivor] superseded clear", clearErr.message);
  }
}
