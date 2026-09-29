import * as SecureStore from "expo-secure-store";

const DEMO_MODE_KEY = "zeta_demo_mode_enabled";

/**
 * Owner of every row the demo seed (and demo-mode writes) put in SQLite.
 * Not a real auth user: nothing carrying this id may ever reach Supabase.
 * Enforced in three places — see `lib/db/database.ts` (sync_queue trigger),
 * `lib/sync/push.ts` (per-row drop) and `lib/sync/engine.ts` (demo gate).
 * Lives here (SecureStore-only imports) so the sync layer can import it
 * without a cycle.
 */
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000000";

export function isDemoUserId(id: string | null | undefined): boolean {
  return id === DEMO_USER_ID;
}

/** Synchronous mirror of the persisted flag, for the sync layer's gates. */
let demoModeActive = false;

export function isDemoModeActive(): boolean {
  return demoModeActive;
}

/** Kept in step with `useAuth().demoMode` by `lib/auth.tsx`. */
export function setDemoModeActive(value: boolean): void {
  demoModeActive = value;
}

export async function isDemoModeEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(DEMO_MODE_KEY);
  return value === "1";
}

export async function enableDemoMode(): Promise<void> {
  demoModeActive = true;
  await SecureStore.setItemAsync(DEMO_MODE_KEY, "1");
}

export async function disableDemoMode(): Promise<void> {
  demoModeActive = false;
  await SecureStore.deleteItemAsync(DEMO_MODE_KEY);
}
