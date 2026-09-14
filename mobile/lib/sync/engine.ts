import { pullAll } from "./pull";
import { pushPendingChanges } from "./push";
import { notifyLocalDataChanged } from "./notify";
import { getDatabase } from "../db/database";
import { isDeadRefreshToken, supabase } from "../supabase";

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
      // Only a token the server rejected ends the session; a refresh that
      // failed on the network keeps it (same rule as lib/auth.tsx).
      if (isDeadRefreshToken(error)) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      }
      return { pushed: 0, pulled: {} };
    }
    session = currentSession;
  } catch (error) {
    if (isDeadRefreshToken(error)) {
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

/* ─── Reconnect / retry ─────────────────────────────────────────────────── */
//
// There is no connectivity listener on mobile (no NetInfo dependency), so
// "the network came back" is inferred from the moments it plausibly did:
// the app returning to the foreground, a successful token refresh, and a
// local write that needs to go up. Each of those calls `requestSync`, which
// runs one sync and — while anything is still queued or the run failed —
// retries with a growing back-off for as long as the app stays in front.
// Nothing here blocks a tap: every call is fire-and-forget.

const RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000, 300_000];
const MAX_RETRIES_PER_FOREGROUND = 8;
const LOCAL_CHANGE_DEBOUNCE_MS = 3_000;

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let localChangeTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let foregrounded = true;

/** Rows in the outbox that have not reached the server yet. */
export async function countPendingChanges(): Promise<number> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sync_queue WHERE synced_at IS NULL`
    );
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

function clearRetryTimer(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetry(reason: string): void {
  if (!foregrounded || resetInProgress) return;
  if (retryAttempt >= MAX_RETRIES_PER_FOREGROUND) return;
  const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
  retryAttempt += 1;
  clearRetryTimer();
  retryTimer = setTimeout(() => {
    retryTimer = null;
    requestSync(`${reason}:retry`);
  }, delay);
}

/**
 * Run a sync now (single-flight via `syncAll`) and keep retrying while the
 * outbox is non-empty or the run failed. Never throws, never awaited by UI.
 */
export function requestSync(reason: string): void {
  if (resetInProgress) return;
  clearRetryTimer();
  syncAll()
    .then(async () => {
      const pending = await countPendingChanges();
      if (pending > 0) {
        scheduleRetry(reason);
      } else {
        retryAttempt = 0;
      }
    })
    .catch((error) => {
      if (__DEV__) console.warn(`[sync] ${reason} failed:`, error);
      scheduleRetry(reason);
    });
}

/**
 * Upload the outbox without pulling. Shares `syncAll`'s single-flight slot so
 * it never overlaps a full run; if one is in flight, the coalesced rerun that
 * `syncAll` already provides picks the new rows up instead.
 *
 * Push-only on purpose: a pull's apply phase runs `withTransactionAsync`
 * per table, and expo-sqlite does not exclude other async statements on the
 * shared connection, so a pull landing seconds after every user edit would
 * make interleaving with the next edit's transaction routine. A push only
 * touches the server and `sync_queue.synced_at` (single statements), which
 * is safe to run beside a local write.
 */
function pushOnly(): Promise<number> {
  if (inFlightSync) {
    return syncAll().then((r) => r.pushed);
  }
  const run = (async () => {
    if (resetInProgress) return 0;
    const {
      data: { session },
    } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    if (!session) return 0;
    return pushPendingChanges({ shouldAbort: () => resetInProgress });
  })();
  inFlightSync = run
    .then((pushed) => ({ pushed, pulled: {} as Record<string, number> }))
    .finally(() => {
      inFlightSync = null;
    });
  return run;
}

/**
 * Called after a local write is enqueued. Debounced so a burst of writes
 * (an import, a multi-row edit) becomes one push a few seconds later, well
 * after the enclosing SQLite transaction has committed. Retries (with the
 * shared back-off) while rows remain queued — that is what carries an
 * offline capture up once the connection returns.
 */
export function scheduleLocalChangeSync(): void {
  if (!foregrounded || resetInProgress) return;
  if (localChangeTimer) clearTimeout(localChangeTimer);
  localChangeTimer = setTimeout(() => {
    localChangeTimer = null;
    pushOnly()
      .then(async () => {
        if ((await countPendingChanges()) > 0) scheduleRetry("local-change");
        else retryAttempt = 0;
      })
      .catch(() => scheduleRetry("local-change"));
  }, LOCAL_CHANGE_DEBOUNCE_MS);
}

/**
 * Foreground/background gate. On resume: reset the back-off and sync once
 * (the most likely moment the network changed). On background: stop timers
 * so nothing fires while the OS has the app suspended.
 */
export function setSyncForegrounded(active: boolean): void {
  foregrounded = active;
  if (!active) {
    clearRetryTimer();
    if (localChangeTimer) {
      clearTimeout(localChangeTimer);
      localChangeTimer = null;
    }
    return;
  }
  retryAttempt = 0;
  requestSync("resume");
}
