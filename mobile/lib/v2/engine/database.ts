import * as SQLite from "expo-sqlite";
import {
  OUTBOX_SCHEMA,
  SQLITE_CAPTURE_TIME_SCHEMA,
  SQLITE_ENGINE_SCHEMA,
  SQLITE_SETTINGS_SCHEMA,
  type SqlDriver,
} from "@zeta/shared";
import { createExpoSqliteDriver } from "./sqlite-driver";
import { getDbKey, newDbKey, saveDbKey } from "./secrets";

export const V2_DB_NAME = "zeta-v2.db";

/**
 * Phone-only state that is never synced (e.g. the verdict's no-flicker memo).
 * Per user, so another account signing in on this phone starts clean.
 */
const LOCAL_STATE_SCHEMA = `
CREATE TABLE local_state (
  user_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
`;

/** Schema versions, in order; PRAGMA user_version = how many have run. */
const MIGRATIONS: string[] = [
  SQLITE_ENGINE_SCHEMA + OUTBOX_SCHEMA,
  // 2: v2 M1 settings (cycle, counted accounts, reservations) + accounts.account_type.
  SQLITE_SETTINGS_SCHEMA,
  // 3: when each movement was captured (Inicio's first-cycle anchor) + phone-only state.
  SQLITE_CAPTURE_TIME_SCHEMA + LOCAL_STATE_SCHEMA,
];

export interface V2Database {
  db: SQLite.SQLiteDatabase;
  driver: SqlDriver;
}

let opening: Promise<V2Database> | null = null;

/**
 * Deletes a database file and its WAL/SHM siblings. expo-sqlite's
 * deleteDatabaseAsync removes only the main file; a -wal left by a crash was
 * written with the old key and would break the rebuilt file.
 */
export async function deleteDatabaseFiles(name: string): Promise<void> {
  for (const file of [name, `${name}-wal`, `${name}-shm`]) {
    try {
      await SQLite.deleteDatabaseAsync(file);
    } catch (e) {
      // A missing file is fine; one still open (or undeletable) must stop the caller.
      if (!/not found/i.test(message(e))) throw e;
    }
  }
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** SQLCipher's answer to a wrong or missing key (SQLITE_NOTADB, 26) or a damaged file (SQLITE_CORRUPT, 11). */
function isUnreadable(e: unknown): boolean {
  return /not a database|malformed|Error code (11|26)\b/i.test(message(e));
}

/** Opens `name` with a raw 32-byte key, verifies the key, applies pragmas and migrations. */
export async function openKeyed(name: string, keyHex: string): Promise<SQLite.SQLiteDatabase> {
  if (!/^[0-9a-f]{64}$/.test(keyHex)) throw new Error("Clave de base de datos inválida");
  const db = await SQLite.openDatabaseAsync(name);
  try {
    await db.execAsync(`PRAGMA key = "x'${keyHex}'"`);
    // Throws "file is not a database" when the key doesn't match the file.
    // execAsync runs it to completion: on the web build a getFirstAsync here
    // left a read transaction open on an existing file, and the pragmas below
    // then failed ("Safety level may not be changed inside a transaction").
    await db.execAsync("SELECT count(*) FROM sqlite_master");
    await db.execAsync(
      "PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;",
    );
    await migrate(db);
    return db;
  } catch (e) {
    await db.closeAsync().catch(() => undefined);
    throw e;
  }
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  for (let v = row?.user_version ?? 0; v < MIGRATIONS.length; v++) {
    await db.execAsync("BEGIN IMMEDIATE");
    try {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
      await db.execAsync("COMMIT");
    } catch (e) {
      await db.execAsync("ROLLBACK").catch(() => undefined);
      throw e;
    }
  }
}

async function openV2Database(): Promise<V2Database> {
  const stored = await getDbKey();
  if (stored) {
    try {
      const db = await openKeyed(V2_DB_NAME, stored);
      return { db, driver: createExpoSqliteDriver(db) };
    } catch (e) {
      // Only a file this key can't read is rebuilt. Anything else (busy, disk
      // full, a failed migration) is thrown and retried on the next open.
      if (!isUnreadable(e)) throw e;
    }
  }
  // ponytail: rebuilding is safe only while the outbox is never drained (M2 must drain or warn first).
  // Throws if the old file can't be deleted, so the stored key is never replaced while it still exists.
  await deleteDatabaseFiles(V2_DB_NAME);
  const key = await newDbKey();
  const db = await openKeyed(V2_DB_NAME, key);
  try {
    await saveDbKey(key);
  } catch (e) {
    // Without a stored key the next open rebuilds this (empty) file.
    await db.closeAsync().catch(() => undefined);
    throw e;
  }
  return { db, driver: createExpoSqliteDriver(db) };
}

/** Single-flight open of the v2 database (same pattern as lib/db/database.ts). */
export function getV2Database(): Promise<V2Database> {
  if (!opening) {
    opening = openV2Database().catch((e) => {
      opening = null;
      throw e;
    });
  }
  return opening;
}

/** Deletes the v2 database (debug screen). The next getV2Database() starts empty. */
export async function resetV2Database(): Promise<void> {
  const current = opening;
  opening = null;
  if (current) {
    const { db } = await current.catch(() => ({ db: null }));
    await db?.closeAsync().catch(() => undefined);
  }
  await deleteDatabaseFiles(V2_DB_NAME);
}

/**
 * Debug: the Keychain loses the key (restore to a new phone, a wiped
 * Keychain). Closes the database, stores a different key and opens again:
 * the file can't be read with it, so it must be rebuilt empty, not crash.
 * Returns how many accounts the reopened database has (0 = rebuilt).
 * On the web preview the file isn't encrypted, so any key reads it.
 */
export async function simulateLostKey(): Promise<{ accountsAfter: number }> {
  const current = opening;
  opening = null;
  if (current) {
    const { db } = await current.catch(() => ({ db: null }));
    await db?.closeAsync().catch(() => undefined);
  }
  await saveDbKey(await newDbKey());
  const { driver } = await getV2Database();
  const [{ n }] = await driver.query<{ n: number }>("SELECT count(*) AS n FROM accounts");
  return { accountsAfter: Number(n) };
}
