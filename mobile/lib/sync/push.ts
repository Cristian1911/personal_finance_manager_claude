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
  | "subscriptions"
  | "transactions"
  | "transaction_locations"
  | "planning_periods"
  | "planning_entries"
  | "planning_assignments";

/** Tables that don't have an updated_at column */
const TABLES_WITHOUT_UPDATED_AT = new Set<string>([
  "transaction_tags",
  "tag_groups",
  "tags",
  "destinatario_rules",
  "recurring_occurrences",
]);

type LocalDb = Awaited<ReturnType<typeof getDatabase>>;

async function markSynced(db: LocalDb, queueId: number): Promise<void> {
  await db.runAsync(
    "UPDATE sync_queue SET synced_at = datetime('now') WHERE id = ?",
    [queueId]
  );
}

/** Sorted column signature — PostgREST bulk insert requires uniform keys. */
function keySignature(payload: Record<string, unknown>): string {
  return Object.keys(payload).sort().join(",");
}

type ParsedInsert = { item: SyncQueueItem; payload: Record<string, unknown> };

/**
 * Push a run of same-table, same-shape INSERTs. Batches of 2+ go out as ONE
 * REST call; any batch error (e.g. a single 23505 duplicate fails the whole
 * statement) falls back to per-row pushes, preserving the old per-item
 * isolation where one bad row never strands its neighbors.
 */
async function pushInsertRun(
  db: LocalDb,
  tableName: SyncTableName,
  run: ParsedInsert[]
): Promise<number> {
  const sb = supabase as any;

  if (run.length > 1) {
    const { error } = await sb.from(tableName).insert(run.map((r) => r.payload));
    if (!error) {
      for (const { item } of run) await markSynced(db, item.id);
      return run.length;
    }
  }

  let synced = 0;
  for (const { item, payload } of run) {
    try {
      const { error } = await sb.from(tableName).insert(payload);
      if (error) {
        if (error.code === "23505") {
          console.warn(`Skipping duplicate INSERT for ${tableName}/${item.record_id}`);
        } else {
          throw error;
        }
      }
      await markSynced(db, item.id);
      synced++;
    } catch (err) {
      console.warn(`Sync push failed for ${tableName}/${item.record_id}:`, err);
    }
  }
  return synced;
}

/**
 * Push all pending local changes to Supabase.
 *
 * UPDATEs carry an atomic freshness guard: the UPDATE is constrained to rows
 * whose remote `updated_at` is not newer than the local edit, in the same
 * REST call (the old SELECT-then-UPDATE cost two round-trips per item and
 * had a check-then-write race). Consecutive INSERTs into the same table are
 * batched into one call — consecutive-only, so cross-table FK ordering in
 * the queue is preserved.
 */
export async function pushPendingChanges(): Promise<number> {
  const db = await getDatabase();

  // Hygiene: synced rows are dead weight (nothing reads them back). Purge
  // after a retention window so the queue doesn't grow unboundedly.
  await db.runAsync(
    "DELETE FROM sync_queue WHERE synced_at IS NOT NULL AND synced_at < datetime('now', '-7 days')"
  );

  const pending = await db.getAllAsync<SyncQueueItem>(
    "SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY id ASC"
  );

  if (pending.length === 0) return 0;

  let synced = 0;
  const sb = supabase as any;

  let idx = 0;
  while (idx < pending.length) {
    const head = pending[idx];
    const tableName = head.table_name as SyncTableName;

    // Collect a batchable run of consecutive INSERTs (same table, same shape).
    if (head.operation === "INSERT") {
      const run: ParsedInsert[] = [];
      let sig: string | null = null;
      while (idx < pending.length) {
        const it = pending[idx];
        if (it.operation !== "INSERT" || it.table_name !== head.table_name) break;
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(it.payload);
        } catch (err) {
          // Malformed payload — unbatchable. Let it end the run; if it's the
          // head, skip it here (it can never push) exactly like the old
          // per-item catch did.
          if (run.length === 0) {
            console.warn(`Sync push failed for ${it.table_name}/${it.record_id}:`, err);
            idx++;
          }
          break;
        }
        const s = keySignature(payload);
        if (sig === null) sig = s;
        else if (s !== sig) break;
        run.push({ item: it, payload });
        idx++;
      }
      if (run.length > 0) {
        synced += await pushInsertRun(db, tableName, run);
      }
      continue;
    }

    // UPDATE / DELETE / REPLACE — one item at a time.
    try {
      const payload = JSON.parse(head.payload);

      switch (head.operation) {
        case "UPDATE": {
          let q = sb.from(tableName).update(payload).eq("id", head.record_id);
          if (
            !TABLES_WITHOUT_UPDATED_AT.has(tableName) &&
            typeof payload.updated_at === "string"
          ) {
            q = q.lte("updated_at", payload.updated_at);
          }
          const { data, error } = await q.select("id");
          if (error) throw error;
          if (!data || data.length === 0) {
            // Remote row is newer (this edit already lost the conflict) or
            // was deleted — the UPDATE can never apply, so drop it instead
            // of retrying it on every future sync forever. The next pull
            // reconciles the local row. Network errors take the throw path
            // above and stay queued for retry.
            console.warn(
              `Dropping unappliable UPDATE for ${tableName}/${head.record_id}: remote is newer or missing`
            );
          }
          break;
        }
        case "DELETE": {
          const { error } = await sb
            .from(tableName)
            .delete()
            .eq("id", head.record_id);
          if (error) throw error;
          break;
        }
        case "REPLACE": {
          const { error: delError } = await sb
            .from(tableName)
            .delete()
            .eq("transaction_id", head.record_id);
          if (delError) throw delError;

          if (payload.tag_ids?.length > 0) {
            const rows = payload.tag_ids.map((tagId: string) => ({
              transaction_id: head.record_id,
              tag_id: tagId,
              // transaction_tags has a NOT-NULL user_id (RLS-scoped). The
              // enqueuer now carries it; without it the insert fails NOT-NULL/RLS.
              user_id: payload.user_id,
            }));
            const { error: insError } = await sb.from(tableName).insert(rows);
            if (insError) throw insError;
          }
          break;
        }
      }

      await markSynced(db, head.id);
      synced++;
    } catch (err) {
      console.warn(`Sync push failed for ${head.table_name}/${head.record_id}:`, err);
    }
    idx++;
  }

  return synced;
}
