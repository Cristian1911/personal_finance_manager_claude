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
      const ids = run.map((r) => r.item.id);
      await db.runAsync(
        `UPDATE sync_queue SET synced_at = datetime('now') WHERE id IN (${ids
          .map(() => "?")
          .join(", ")})`,
        ids
      );
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
export async function pushPendingChanges(options?: {
  /** Probed between items — a reset mid-run must not replay the queue. */
  shouldAbort?: () => boolean;
}): Promise<number> {
  const shouldAbort = options?.shouldAbort;
  if (shouldAbort?.()) return 0;
  const db = await getDatabase();

  const pending = await db.getAllAsync<SyncQueueItem>(
    "SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY id ASC"
  );

  if (pending.length === 0) return 0;

  // Hygiene: synced rows are dead weight (nothing reads them back). Purge
  // after a retention window so the queue doesn't grow unboundedly. Gated
  // behind the pending check — an idle sync (empty queue, the common case)
  // shouldn't pay a table scan the partial unsynced-only index can't serve.
  await db.runAsync(
    "DELETE FROM sync_queue WHERE synced_at IS NOT NULL AND synced_at < datetime('now', '-7 days')"
  );

  let synced = 0;
  const sb = supabase as any;

  let idx = 0;
  while (idx < pending.length) {
    if (shouldAbort?.()) break;
    const head = pending[idx];
    const tableName = head.table_name as SyncTableName;

    // Collect a batchable run of consecutive INSERTs (same table, same shape).
    if (head.operation === "INSERT") {
      let headPayload: Record<string, unknown>;
      try {
        headPayload = JSON.parse(head.payload);
      } catch (err) {
        // Malformed payload can never parse on any future run either —
        // mark it synced (dropped) so it doesn't retry forever as a
        // poison pill, unlike transient network errors which stay queued.
        console.warn(
          `Dropping malformed sync payload for ${head.table_name}/${head.record_id}:`,
          err
        );
        await markSynced(db, head.id).catch(() => {});
        idx++;
        continue;
      }
      const sig = keySignature(headPayload);
      const run: ParsedInsert[] = [{ item: head, payload: headPayload }];
      idx++;
      while (idx < pending.length) {
        const it = pending[idx];
        if (it.operation !== "INSERT" || it.table_name !== head.table_name) break;
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(it.payload);
        } catch {
          // Ends the run; the malformed item becomes the next head, where
          // the parse failure is warned and skipped.
          break;
        }
        if (keySignature(payload) !== sig) break;
        run.push({ item: it, payload });
        idx++;
      }
      synced += await pushInsertRun(db, tableName, run);
      continue;
    }

    // UPDATE / DELETE / REPLACE — one item at a time. Parse outside the push
    // try/catch: a malformed payload can never parse on a future run either,
    // so it gets dropped (marked synced) instead of retrying forever, while
    // transient push errors below stay queued.
    let payload: any;
    try {
      payload = JSON.parse(head.payload);
    } catch (err) {
      console.warn(
        `Dropping malformed sync payload for ${head.table_name}/${head.record_id}:`,
        err
      );
      await markSynced(db, head.id).catch(() => {});
      idx++;
      continue;
    }

    try {
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
            // of retrying it on every future sync forever. Network errors
            // take the throw path above and stay queued for retry. For
            // non-windowed tables the next pull reconciles the local row;
            // for windowed ones (transactions) a row that has aged out of
            // the pull window keeps the losing local edit — same end state
            // as the old retry-forever behavior, minus the round-trips.
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
