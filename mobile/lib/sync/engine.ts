import { pullAll } from "./pull";
import { pushPendingChanges } from "./push";
import { supabase } from "../supabase";

export type SyncStatus = "idle" | "syncing" | "error";

export async function syncAll(): Promise<{
  pushed: number;
  pulled: Record<string, number>;
}> {
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
