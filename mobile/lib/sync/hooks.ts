import { useState, useCallback } from "react";
import { syncAll, type SyncStatus } from "./engine";

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const sync = useCallback(async () => {
    if (status === "syncing") return;
    setStatus("syncing");
    try {
      await syncAll();
      setLastSynced(new Date());
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [status]);

  return { status, lastSynced, sync };
}
