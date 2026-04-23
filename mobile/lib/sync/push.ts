import { supabase } from "../supabase";
import { getDatabase } from "../db/database";

type SyncQueueItem = {
  id: number;
  table_name: string;
  record_id: string;
  operation: "INSERT" | "UPDATE" | "DELETE" | "REPLACE";
  payload: string;
  created_at: string;
  synced_at: string | null;
};

type SyncTableName =
  | "profiles"
  | "categories"
  | "accounts"
  | "budgets"
  | "category_rules"
  | "recurring_transaction_templates"
  | "recurring_occurrences"
  | "destinatarios"
  | "destinatario_rules"
  | "tag_groups"
  | "tags"
  | "transaction_tags"
  | "wishlist_items"
  | "statement_snapshots"
  | "transactions"
  | "planning_periods"
  | "planning_entries"
  | "planning_assignments";

/** Tables that don't have an updated_at column */
const TABLES_WITHOUT_UPDATED_AT = new Set<string>([
  "transaction_tags",
  "tag_groups",
  "tags",
  "destinatario_rules",
  "category_rules",
  "recurring_occurrences",
]);

/**
 * Check if the remote row has been modified since the local copy was last synced.
 * Returns true if safe to push, false if stale or unreachable.
 */
async function isLocalFresh(
  tableName: string,
  recordId: string,
  localUpdatedAt: string | undefined
): Promise<boolean> {
  if (TABLES_WITHOUT_UPDATED_AT.has(tableName)) return true;
  if (!localUpdatedAt) return true;

  const sb = supabase as any;
  const { data, error } = await sb
    .from(tableName)
    .select("updated_at")
    .eq("id", recordId)
    .maybeSingle();

  // Row doesn't exist remotely — safe to push (INSERT)
  if (!error && !data) return true;

  // Network/permission error — don't push, let it retry next sync
  if (error) {
    console.warn(`Freshness check failed for ${tableName}/${recordId}:`, error.message);
    return false;
  }

  const remoteTime = new Date(data.updated_at).getTime();
  const localTime = new Date(localUpdatedAt).getTime();
  return localTime >= remoteTime;
}

/**
 * Push all pending local changes to Supabase.
 * Validates that local data is not stale before UPDATE operations.
 */
export async function pushPendingChanges(): Promise<number> {
  const db = await getDatabase();

  const pending = await db.getAllAsync<SyncQueueItem>(
    "SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY id ASC"
  );

  if (pending.length === 0) return 0;

  let synced = 0;

  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload);
      const tableName = item.table_name as SyncTableName;
      const sb = supabase as any;

      let pushed = true;

      switch (item.operation) {
        case "INSERT": {
          const { error } = await sb
            .from(tableName)
            .insert(payload);
          if (error) {
            if (error.code === "23505") {
              console.warn(`Skipping duplicate INSERT for ${tableName}/${item.record_id}`);
              break;
            }
            throw error;
          }
          break;
        }
        case "UPDATE": {
          const fresh = await isLocalFresh(tableName, item.record_id, payload.updated_at);
          if (!fresh) {
            console.warn(
              `Skipping stale UPDATE for ${tableName}/${item.record_id}: remote is newer or unreachable`
            );
            pushed = false;
            break;
          }

          const { error } = await sb
            .from(tableName)
            .update(payload)
            .eq("id", item.record_id);
          if (error) throw error;
          break;
        }
        case "DELETE": {
          const { error } = await sb
            .from(tableName)
            .delete()
            .eq("id", item.record_id);
          if (error) throw error;
          break;
        }
        case "REPLACE": {
          const { error: delError } = await sb
            .from(tableName)
            .delete()
            .eq("transaction_id", item.record_id);
          if (delError) throw delError;

          if (payload.tag_ids?.length > 0) {
            const rows = payload.tag_ids.map((tagId: string) => ({
              transaction_id: item.record_id,
              tag_id: tagId,
            }));
            const { error: insError } = await sb
              .from(tableName)
              .insert(rows);
            if (insError) throw insError;
          }
          break;
        }
      }

      // Only mark as synced if the operation was actually pushed
      if (pushed) {
        await db.runAsync(
          "UPDATE sync_queue SET synced_at = datetime('now') WHERE id = ?",
          [item.id]
        );
        synced++;
      }
    } catch (err) {
      console.warn(`Sync push failed for ${item.table_name}/${item.record_id}:`, err);
    }
  }

  return synced;
}
