import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useFocusEffect } from "expo-router";

/**
 * "Local SQLite changed" broadcast.
 *
 * Every root screen loads through `useFocusEffect`, which fires once on mount.
 * The initial `syncAll()` runs in the background *after* that, so the screen
 * the user lands on renders the pre-sync (usually empty) snapshot and never
 * re-reads — the data only showed up after a pull-to-refresh or a re-focus.
 *
 * `useSyncExternalStore` is React's built-in for exactly this, so no context
 * provider and no store dependency: the engine bumps the version when a run
 * actually wrote something, and subscribed screens reload.
 */
let version = 0;
const listeners = new Set<() => void>();

/** Called by the sync engine when a run changed local data. */
export function notifyLocalDataChanged(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number {
  return version;
}

/**
 * Increments whenever a sync run wrote to SQLite. Put it in a `useEffect`
 * dependency list next to your loader to re-read after a background sync.
 */
export function useSyncVersion(): number {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Load on focus, and again whenever a background sync writes something.
 *
 * Replaces the bare `useFocusEffect(useCallback(load, [load]))` every screen
 * used: that fires once on mount, which after login happens *before* the
 * initial sync lands, leaving the screen on an empty snapshot.
 *
 * Pass a `useCallback`-stable loader, same as before.
 */
export function useReloadOnFocusAndSync(load: () => void): void {
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Compare against a ref rather than `> 0` so remounting after an earlier
  // sync doesn't double-load on top of the focus call above.
  const syncVersion = useSyncVersion();
  const seenSyncVersion = useRef(syncVersion);
  useEffect(() => {
    if (syncVersion === seenSyncVersion.current) return;
    seenSyncVersion.current = syncVersion;
    load();
  }, [syncVersion, load]);
}
