import { supabase } from "../supabase";
import { getDatabase } from "../db/database";

type SyncQueueItem = {
  id: number;
  table_name: string;
  record_id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
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
  | "statement_snapshots"
  | "transactions";

/**
 * Push all pending local changes to Supabase.
 * Reads from sync_queue and executes each operation against the remote DB.
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

      switch (item.operation) {
        case "INSERT": {
          const { error } = await supabase
            .from(tableName)
            .insert(payload);
          if (error) throw error;
          break;
        }
        case "UPDATE": {
          const { error } = await supabase
            .from(tableName)
            .update(payload)
            .eq("id", item.record_id);
          if (error) throw error;
          break;
        }
        case "DELETE": {
          const { error } = await supabase
            .from(tableName)
            .delete()
            .eq("id", item.record_id);
          if (error) throw error;
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
