import { getV2Database } from "./engine/database";

/**
 * Phone-only UI memory (the `local_state` table): per user, never synced or
 * replayed, so it doesn't go through a command. The only raw writes on the
 * phone, on purpose.
 */
export async function remember(userId: string, key: string, value: string): Promise<void> {
  const { driver } = await getV2Database();
  await driver.query(
    `INSERT INTO local_state (user_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value`,
    [userId, key, value],
  );
}

/** The stored values for these keys (missing keys are absent). */
export async function readLocal(userId: string, keys: readonly string[]): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();
  const { driver } = await getV2Database();
  const rows = await driver.query<{ key: string; value: string }>(
    `SELECT key, value FROM local_state WHERE user_id = ? AND key IN (${keys.map(() => "?").join(", ")})`,
    [userId, ...keys],
  );
  return new Map(rows.map((r) => [r.key, r.value]));
}

/** A JSON value, or `fallback` when missing or damaged (UI memory is never worth an error). */
export function parseLocal<T>(raw: string | undefined, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const rememberJson = (userId: string, key: string, value: unknown) => remember(userId, key, JSON.stringify(value));

/** Onboarding and first-time guides (S10-3/S10-4). */
export const ONBOARDING_KEYS = {
  tourSeen: "onboarding.tour_seen",
  goals: "onboarding.goals",
  path: "onboarding.path",
  pendingBills: "onboarding.pending_bills",
  noCards: "onboarding.no_cards",
  noBills: "onboarding.no_bills",
  hoyGuideSeen: "guide.hoy_seen",
  setupOpen: "guide.setup_open",
  dismissedPagos: "revisar.dismissed_pagos",
} as const;

/** Removes a name from the pending fixed payments (once it was added in Pagos). */
export async function resolvePendingBill(userId: string, name: string): Promise<void> {
  const key = ONBOARDING_KEYS.pendingBills;
  const list = parseLocal<string[]>((await readLocal(userId, [key])).get(key), []);
  const norm = (s: string) => s.trim().toLowerCase();
  const left = list.filter((n) => norm(n) !== norm(name));
  if (left.length !== list.length) await rememberJson(userId, key, left);
}
