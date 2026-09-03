import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Attach a set of tags to transactions that were just created by `userId`.
 *
 * Tags must belong to the user (or be system tags); unknown ids are dropped
 * rather than failing the whole write. Never throws: by the time this runs the
 * transaction already moved balances, so a tagging failure is reported back
 * for logging and the caller still returns the created row.
 */
export async function attachTagsToTransactions(
  supabase: SupabaseClient<Database>,
  userId: string,
  transactionIds: string[],
  tagIds: string[],
): Promise<{ attached: number; error: string | null }> {
  const uniqueTagIds = [...new Set(tagIds.filter(Boolean))];
  const uniqueTxIds = [...new Set(transactionIds.filter(Boolean))];
  if (uniqueTagIds.length === 0 || uniqueTxIds.length === 0) {
    return { attached: 0, error: null };
  }

  // Defense-in-depth: only the user's own tags (or system tags) may be
  // attached, mirroring bulkTagTransactions.
  const { data: allowedTags, error: tagError } = await supabase
    .from("tags")
    .select("id")
    .in("id", uniqueTagIds)
    .or(`user_id.eq.${userId},user_id.is.null`);
  if (tagError) return { attached: 0, error: tagError.message };

  const allowedIds = (allowedTags ?? []).map((t) => t.id);
  if (allowedIds.length === 0) return { attached: 0, error: null };

  const rows = uniqueTxIds.flatMap((transaction_id) =>
    allowedIds.map((tag_id) => ({ transaction_id, tag_id, user_id: userId })),
  );

  const { error } = await supabase
    .from("transaction_tags")
    .upsert(rows, { onConflict: "transaction_id,tag_id", ignoreDuplicates: true });
  if (error) return { attached: 0, error: error.message };

  return { attached: rows.length, error: null };
}

/** Read the `tag_ids` multi-value field a create form submits. */
export function readTagIdsFromFormData(formData: FormData): string[] {
  return formData
    .getAll("tag_ids")
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}
