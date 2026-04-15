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
  | "transactions";

/** Tables that don't have an updated_at column (junction tables, etc.) */
const TABLES_WITHOUT_UPDATED_AT = new Set<string>([
  "transaction_tags",
  "tag_groups",
  "tags",
  "destinatario_rules",
  "category_rules",
]);

/**
 * Check if the remote row has been modified since the local copy was last synced.
 * Returns true if it's safe to push (remote is not newer), false if stale.
 */
async function isLocalFresh(
  tableName: string,
  recordId: string,
  localUpdatedAt: string | undefined
): Promise<boolean> {
  // Junction tables have no updated_at — always allow push
  if (TABLES_WITHOUT_UPDATED_AT.has(tableName)) return true;
  // If the local payload has no updated_at, skip the check (INSERT case)
  if (!localUpdatedAt) return true;

  const sb = supabase as any;
  const { data, error } = await sb
    .from(tableName)
    .select("updated_at")
    .eq("id", recordId)
    .maybeSingle();

  // Row doesn't exist remotely — safe to push (INSERT)
  if (error || !data) return true;

  const remoteTime = new Date(data.updated_at).getTime();
  const localTime = new Date(localUpdatedAt).getTime();

  // Safe if local is same age or newer than remote
  return localTime >= remoteTime;
}

/**
 * Push all pending local changes to Supabase.
 * Reads from sync_queue and executes each operation against the remote DB.
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

      // Cast to any — mobile types file may not include all tables
      const sb = supabase as any;

      switch (item.operation) {
        case "INSERT": {
          const { error } = await sb
            .from(tableName)
            .insert(payload);
          if (error) {
            // Duplicate key — row already exists, skip silently
            if (error.code === "23505") {
              console.warn(`Skipping duplicate INSERT for ${tableName}/${item.record_id}`);
              break;
            }
            throw error;
          }
          break;
        }
        case "UPDATE": {
          // Validate freshness before overwriting remote data
          const fresh = await isLocalFresh(tableName, item.record_id, payload.updated_at);
          if (!fresh) {
            console.warn(
              `Skipping stale UPDATE for ${tableName}/${item.record_id}: remote is newer`
            );
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
          // Junction table replace: delete existing rows, insert new ones.
          // Payload shape: { transaction_id, tag_ids: string[] }
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

      // Mark as synced
      await db.runAsync(
        "UPDATE sync_queue SET synced_at = datetime('now') WHERE id = ?",
        [item.id]
      );
      synced++;
    } catch (err) {
      // Log and skip failed items so they can be retried later
      console.warn(`Sync push failed for ${item.table_name}/${item.record_id}:`, err);
    }
  }

  return synced;
}
