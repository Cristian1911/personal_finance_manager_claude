import { pullAll } from "./pull";
import { pushPendingChanges } from "./push";

export type SyncStatus = "idle" | "syncing" | "error";

export async function syncAll(): Promise<{
  pushed: number;
  pulled: Record<string, number>;
}> {
  // Push first so local changes don't get overwritten by stale remote data
  const pushed = await pushPendingChanges();
  const pulled = await pullAll();
  return { pushed, pulled };
}
