import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Attach a set of tags to transactions owned by `userId`.
 *
 * Both sides are verified app-side (defense-in-depth on top of RLS): the
 * transactions must belong to the user, and the tags must be the user's own
 * or system tags. Unknown tag ids are dropped rather than failing the write.
 * Never throws: on the create paths the transaction already moved balances,
 * so a tagging failure is reported back for logging and the caller still
 * returns the created row.
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

  const [txRes, tagRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("id", uniqueTxIds),
    // Only the user's own tags (or system tags) may be attached, mirroring
    // bulkTagTransactions.
    supabase
      .from("tags")
      .select("id")
      .in("id", uniqueTagIds)
      .or(`user_id.eq.${userId},user_id.is.null`),
  ]);
  if (txRes.error) return { attached: 0, error: txRes.error.message };
  if (txRes.count !== uniqueTxIds.length) {
    return { attached: 0, error: "Transacciones no encontradas" };
  }
  if (tagRes.error) return { attached: 0, error: tagRes.error.message };

  const allowedIds = (tagRes.data ?? []).map((t) => t.id);
  if (allowedIds.length === 0) return { attached: 0, error: null };

  const rows = uniqueTxIds.flatMap((transaction_id) =>
    allowedIds.map((tag_id) => ({ transaction_id, tag_id, user_id: userId })),
  );

  // `ignoreDuplicates` skips pairs that already exist; the returned rows are
  // the ones actually written, so `attached` is a real count.
  const { data, error } = await supabase
    .from("transaction_tags")
    .upsert(rows, { onConflict: "transaction_id,tag_id", ignoreDuplicates: true })
    .select("tag_id");
  if (error) return { attached: 0, error: error.message };

  return { attached: data?.length ?? 0, error: null };
}

/**
 * Read the `tag_ids` field a form submits. Accepts both wire formats in use:
 * repeated scalar inputs (`<input name="tag_ids">` per id — the transaction
 * forms) and a single JSON-encoded array (the modos form). Blanks and
 * non-string values are dropped.
 */
export function readTagIdsFromFormData(formData: FormData): string[] {
  const values = formData
    .getAll("tag_ids")
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  if (values.length === 1 && values[0].startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(values[0]);
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .filter(Boolean);
      }
    } catch {
      // Not JSON — fall through and treat it as a plain id.
    }
  }
  return values;
}
