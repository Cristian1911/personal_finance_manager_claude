import * as Crypto from "expo-crypto";
import { getDatabase } from "../../db/database";
import { reverseGeocode } from "./geocode";
import type { LocationPing } from "./types";

const WINDOW_MIN_WITH_TIME = 90;

/**
 * Combine a date string (YYYY-MM-DD) and an optional time (HH:mm[:ss]) into
 * a JS Date. When time is null, returns midnight at the start of the day —
 * the caller falls back to a full-day window in that case.
 */
function combineDateTime(date: string, time: string | null): Date {
  const safeTime = time ? `${time.length === 5 ? `${time}:00` : time}` : "00:00:00";
  return new Date(`${date}T${safeTime}`);
}

/**
 * Find the most recent unconsumed ping closest in time to the given
 * transaction. Returns null when nothing falls inside the ±90-min window
 * (or, when no time was provided, the full day).
 */
export async function findNearestPing(
  userId: string,
  date: string,
  time: string | null,
): Promise<LocationPing | null> {
  const db = await getDatabase();
  const target = combineDateTime(date, time);
  const targetIso = target.toISOString();

  let startIso: string;
  let endIso: string;
  if (time) {
    startIso = new Date(target.getTime() - WINDOW_MIN_WITH_TIME * 60_000).toISOString();
    endIso = new Date(target.getTime() + WINDOW_MIN_WITH_TIME * 60_000).toISOString();
  } else {
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59`);
    startIso = startOfDay.toISOString();
    endIso = endOfDay.toISOString();
  }

  return db.getFirstAsync<LocationPing>(
    `SELECT * FROM location_pings
      WHERE user_id = ?
        AND consumed = 0
        AND captured_at BETWEEN ? AND ?
      ORDER BY ABS(strftime('%s', captured_at) - strftime('%s', ?)) ASC
      LIMIT 1`,
    [userId, startIso, endIso, targetIso]
  );
}

/**
 * Materialise a `transaction_locations` row from a ping, attach it to a
 * transaction, mark the ping consumed, and enqueue the row + tx update for
 * sync. Reverse-geocode is best-effort and runs synchronously here so the
 * place_name is available the first time the user opens the detail screen;
 * it's cheap (cached, in-process) and tolerant of failures.
 */
export async function linkPingToTransaction(params: {
  userId: string;
  transactionId: string;
  ping: LocationPing;
}): Promise<string> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const locationId = Crypto.randomUUID();

  const place = await reverseGeocode(params.ping.latitude, params.ping.longitude);

  const insertPayload = {
    id: locationId,
    user_id: params.userId,
    latitude: params.ping.latitude,
    longitude: params.ping.longitude,
    accuracy_m: params.ping.accuracy_m,
    place_name: place.place_name,
    place_locality: place.place_locality,
    place_country: place.place_country,
    captured_at: params.ping.captured_at,
    linked_transaction_id: params.transactionId,
    created_at: now,
    updated_at: now,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transaction_locations
        (id, user_id, latitude, longitude, accuracy_m, place_name, place_locality, place_country,
         captured_at, linked_transaction_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        insertPayload.id,
        insertPayload.user_id,
        insertPayload.latitude,
        insertPayload.longitude,
        insertPayload.accuracy_m,
        insertPayload.place_name,
        insertPayload.place_locality,
        insertPayload.place_country,
        insertPayload.captured_at,
        insertPayload.linked_transaction_id,
        insertPayload.created_at,
        insertPayload.updated_at,
      ]
    );
    await db.runAsync(
      `UPDATE transactions SET location_id = ?, updated_at = ? WHERE id = ?`,
      [locationId, now, params.transactionId]
    );
    await db.runAsync(
      `UPDATE location_pings SET consumed = 1 WHERE id = ?`,
      [params.ping.id]
    );
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES ('transaction_locations', ?, 'INSERT', ?, ?)`,
      [locationId, JSON.stringify(insertPayload), now]
    );
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES ('transactions', ?, 'UPDATE', ?, ?)`,
      [
        params.transactionId,
        JSON.stringify({ location_id: locationId, updated_at: now }),
        now,
      ]
    );
  });

  return locationId;
}

/**
 * Convenience: find the nearest ping and link it in one shot. Returns the
 * new transaction_locations.id, or null when there's no ping in range.
 */
export async function linkNearestPingToTransaction(params: {
  userId: string;
  transactionId: string;
  date: string;
  time: string | null;
}): Promise<string | null> {
  const ping = await findNearestPing(params.userId, params.date, params.time);
  if (!ping) return null;
  return linkPingToTransaction({
    userId: params.userId,
    transactionId: params.transactionId,
    ping,
  });
}
