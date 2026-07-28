import { useCallback, useEffect, useState } from "react";
import { getLastSyncRunAt, syncAll, type SyncStatus } from "./engine";

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // `lastSynced` used to live only in this state, so it reset to null on every
  // mount and Ajustes always read "Última: Nunca" — even right after a sync.
  // Seed it from the persisted run timestamp instead.
  useEffect(() => {
    let active = true;
    getLastSyncRunAt()
      .then((iso) => {
        if (active && iso) setLastSynced(new Date(iso));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const sync = useCallback(async () => {
    if (status === "syncing") return;
    setStatus("syncing");
    try {
      await syncAll();
      const iso = await getLastSyncRunAt();
      setLastSynced(iso ? new Date(iso) : new Date());
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [status]);

  return { status, lastSynced, sync };
}
