import * as TaskManager from "expo-task-manager";
import * as Crypto from "expo-crypto";
import type { LocationObject } from "expo-location";
import { getDatabase } from "../../db/database";
import { supabase } from "../../supabase";
import { ZETA_LOCATION_TASK } from "./types";

/**
 * Background location task. Defined at module load so TaskManager finds it on
 * cold start (iOS/Android wake the JS bundle to deliver location events).
 *
 * Each event is persisted to the LOCAL-ONLY `location_pings` table — never
 * synced. The linker reads from this table when a new transaction is saved.
 *
 * Older pings are pruned to a 14-day rolling window so the table stays small
 * (a few hundred rows max with significant-change updates).
 */

const PRUNE_OLDER_THAN_DAYS = 14;

type TaskBody = {
  data?: { locations?: LocationObject[] };
  error?: { message?: string } | null;
};

/** Persist a batch of locations to the local pings table. Exported so the
 * tracker can also write a one-shot ping captured at transaction-save time. */
export async function persistLocationPings(locations: LocationObject[]): Promise<void> {
  if (locations.length === 0) return;

  const session = await supabase.auth.getSession();
  const userId = session.data.session?.user.id;
  if (!userId) return;

  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const loc of locations) {
      await db.runAsync(
        `INSERT INTO location_pings (id, user_id, latitude, longitude, accuracy_m, captured_at, consumed)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [
          Crypto.randomUUID(),
          userId,
          loc.coords.latitude,
          loc.coords.longitude,
          loc.coords.accuracy ?? null,
          new Date(loc.timestamp).toISOString(),
        ]
      );
    }
    const cutoff = new Date(Date.now() - PRUNE_OLDER_THAN_DAYS * 86_400_000).toISOString();
    await db.runAsync(`DELETE FROM location_pings WHERE captured_at < ?`, [cutoff]);
  });
}

TaskManager.defineTask(ZETA_LOCATION_TASK, async (body: TaskBody) => {
  if (body.error) {
    if (__DEV__) console.warn("[zeta-location] task error", body.error.message);
    return;
  }
  const locations = body.data?.locations ?? [];
  if (locations.length === 0) return;
  await persistLocationPings(locations);
  if (__DEV__) console.log(`[zeta-location] stored ${locations.length} ping(s)`);
});
