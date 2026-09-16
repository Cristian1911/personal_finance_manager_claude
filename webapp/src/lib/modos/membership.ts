import { createCachedClient } from "@/lib/supabase/cached";
import { dedupeTransactionIds } from "@/lib/utils/tag-ids";
import type { Modo } from "@/types/domain";

/**
 * Membership rule of a viaje/evento — the single source of truth: a
 * transaction belongs to the modo when it carries ANY of its tags AND its
 * date falls inside the range. Lives outside the `"use server"` module so
 * it is never published as a callable endpoint that takes its own identity.
 */
export async function getModoTransactionIds(
  modo: Pick<Modo, "date_from" | "date_to" | "tag_ids">,
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

  const { data: rows } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .in("id", candidateIds)
    .gte("transaction_date", modo.date_from)
    .lte("transaction_date", modo.date_to);
  return (rows ?? []).map((r) => r.id);
}
