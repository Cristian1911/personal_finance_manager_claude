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

export async function syncAll(): Promise<{
  pushed: number;
  pulled: Record<string, number>;
}> {
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
