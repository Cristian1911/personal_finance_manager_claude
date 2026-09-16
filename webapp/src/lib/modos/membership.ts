import { createCachedClient } from "@/lib/supabase/cached";
import { dedupeTransactionIds } from "@/lib/utils/tag-ids";
import type { Modo } from "@/types/domain";

/**
 * Membership rule of a viaje/evento — the single source of truth: a
 * transaction belongs to the modo when it carries ANY of its tags, whatever
 * its date. The date range gates only what the trip does on its own (auto-tag
 * while active, propose untagged candidates) — flights bought months before
 * and tagged by hand are the trip's spend too. Lives outside the `"use server"`
 * module so it is never published as an endpoint that takes its own identity.
 */
export async function getModoTransactionIds(
  modo: Pick<Modo, "tag_ids">,
  userId: string,
  accessToken: string,
): Promise<string[]> {
  if (!modo.tag_ids || modo.tag_ids.length === 0) return [];
  const supabase = createCachedClient(accessToken);

  const { data: tagged } = await supabase
    .from("transaction_tags")
    .select("transaction_id")
    .eq("user_id", userId)
    .in("tag_id", modo.tag_ids);
  const candidateIds = dedupeTransactionIds(tagged ?? []);
  if (candidateIds.length === 0) return [];

  // Re-check against the transactions view (ownership + still exists).
  const { data: rows } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .in("id", candidateIds);
  return (rows ?? []).map((r) => r.id);
}
