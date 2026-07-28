import { pullAll } from "./pull";
import { pushPendingChanges } from "./push";
import { notifyLocalDataChanged } from "./notify";
import { getDatabase } from "../db/database";
import { supabase } from "../supabase";

export type SyncStatus = "idle" | "syncing" | "error";

// Global reset lock. When the user taps "Borrar todos mis datos", the reset
// flow flips this on before calling the server-side RPC and only clears it
// after the local wipe + navigation. Any `syncAll()` invocation during that
// window (from the initial-sync listener, the pull-to-refresh hook, the
// manual sync button, etc.) must bail out immediately — otherwise a push
// can replay queued mutations against the now-empty server, or a pull can
// re-seed SQLite from a stale snapshot captured before the wipe.
let resetInProgress = false;

export function beginReset(): void {
  resetInProgress = true;
}

export function endReset(): void {
  resetInProgress = false;
}

export function isResetInProgress(): boolean {
  return resetInProgress;
}

type SyncResult = { pushed: number; pulled: Record<string, number> };

/**
 * When a sync last *ran*, for the Settings screen.
 *
 * Deliberately not derived from `sync_metadata.last_synced_at`: those are
 * per-table cursors holding the newest SERVER-side `updated_at` actually
 * pulled, so on a quiet account they'd report the age of the newest record,
 * not the age of the last run. Stored under a sentinel key — `pullAll` only
 * looks up cursors for names in SYNC_TABLES, so the extra row is inert.
 */
const LAST_RUN_KEY = "__last_run";

async function recordSyncRun(): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO sync_metadata (table_name, last_synced_at) VALUES (?, ?)
       ON CONFLICT(table_name) DO UPDATE SET last_synced_at = excluded.last_synced_at`,
      [LAST_RUN_KEY, new Date().toISOString()]
    );
  } catch {
    // Bookkeeping only — never fail a sync over the timestamp.
  }
}

export async function getLastSyncRunAt(): Promise<string | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ last_synced_at: string | null }>(
      `SELECT last_synced_at FROM sync_metadata WHERE table_name = ?`,
      [LAST_RUN_KEY]
    );
    return row?.last_synced_at ?? null;
  } catch {
    return null;
  }
}

// Single-flight lock with one coalesced follow-up run. syncAll is triggered
// from many places (auth listener, pull-to-refresh on every root screen,
// background sync after an email import) with no coordination — overlapping
// runs used to duplicate every push/pull round-trip AND risk interleaving
// withTransactionAsync transactions on the shared SQLite connection
// (expo-sqlite's plain withTransactionAsync does not exclude other async
// statements, so a concurrent pull could half-apply inside another run's
// open transaction).
//
// A caller that arrives mid-run may have just enqueued changes the in-flight
// run's push already missed (it snapshotted sync_queue at start). Handing
// back the in-flight promise alone would resolve "success" without ever
// pushing those rows, so mid-run callers instead share ONE chained rerun
// that starts after the current run finishes. Bounded: at most one running
// + one queued, no matter how many callers pile up.
let inFlightSync: Promise<SyncResult> | null = null;
let queuedSync: Promise<SyncResult> | null = null;

export function syncAll(): Promise<SyncResult> {
  if (inFlightSync) {
    if (!queuedSync) {
      queuedSync = inFlightSync
        .catch(() => {}) // rerun even if the current run failed
        .then(() => {
          queuedSync = null;
          return syncAll();
        });
    }
    return queuedSync;
  }
  inFlightSync = doSyncAll().finally(() => {
    inFlightSync = null;
  });
  return inFlightSync;
}

async function doSyncAll(): Promise<SyncResult> {
  if (resetInProgress) {
    return { pushed: 0, pulled: {} };
  }
  let session = null;
  try {
    const {
      data: { session: currentSession },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      const message = String(error.message ?? "");
      if (message.toLowerCase().includes("refresh token")) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      }
      return { pushed: 0, pulled: {} };
    }
    session = currentSession;
  } catch (error) {
    const message = String((error as Error)?.message ?? "");
    if (message.toLowerCase().includes("refresh token")) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }
    return { pushed: 0, pulled: {} };
  }

  if (!session) {
    return { pushed: 0, pulled: {} };
  }

  // A reset can begin while a run is mid-flight; the start-of-run check above
  // can't see it. Both phases take an abort probe so a straddling run stops
  // before replaying queued mutations against the wiped server or re-seeding
  // the just-cleared SQLite from a pre-wipe fetch snapshot.
  const shouldAbort = () => resetInProgress;

  // Push first so local changes don't get overwritten by stale remote data
  const pushed = await pushPendingChanges({ shouldAbort });
  const pulled = await pullAll({ shouldAbort });

  if (!resetInProgress) await recordSyncRun();

  // Screens load once on focus, which for the landing screen happens before
  // this run finishes — without this they'd sit on the pre-sync snapshot until
  // a pull-to-refresh. Only fire when something actually landed locally.
  // `resetInProgress` is re-checked here, not just in the pull/push loops: the
  // per-table abort probe runs *before* each table, so if the flag flips while
  // the LAST table is mid-apply the loop ends normally and we'd reach this line
  // during a reset. Screens subscribe to the notify regardless of focus, so a
  // stray bump would run `load()` against a DB that `clearDatabase()` is
  // deleting table by table (its execAsync isn't a single transaction).
  const pulledRows = Object.values(pulled).reduce((sum, n) => sum + n, 0);
  if (!resetInProgress && (pushed > 0 || pulledRows > 0)) {
    notifyLocalDataChanged();
  }

  return { pushed, pulled };
}
