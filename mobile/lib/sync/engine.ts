import { pullAll } from "./pull";
import { pushPendingChanges } from "./push";
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

// Single-flight lock. syncAll is triggered from many places (auth listener,
// pull-to-refresh on every root screen, background sync after an email
// import) with no coordination — overlapping runs used to duplicate every
// push/pull round-trip AND risk interleaving withTransactionAsync
// transactions on the shared SQLite connection (expo-sqlite's plain
// withTransactionAsync does not exclude other async statements, so a
// concurrent pull could half-apply inside another run's open transaction).
// Concurrent callers now share the in-flight run. Changes enqueued while a
// run is mid-flight are durable in sync_queue and go out on the next sync.
let inFlightSync: Promise<SyncResult> | null = null;

export function syncAll(): Promise<SyncResult> {
  if (inFlightSync) return inFlightSync;
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

  // Push first so local changes don't get overwritten by stale remote data
  const pushed = await pushPendingChanges();
  const pulled = await pullAll();
  return { pushed, pulled };
}
