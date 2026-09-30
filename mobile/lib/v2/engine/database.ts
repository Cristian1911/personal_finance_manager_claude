import * as SQLite from "expo-sqlite";
import { OUTBOX_SCHEMA, SQLITE_ENGINE_SCHEMA, type SqlDriver } from "@zeta/shared";
import { createExpoSqliteDriver } from "./sqlite-driver";
import { createDbKey, getDbKey } from "./secrets";

export const V2_DB_NAME = "zeta-v2.db";

/** Schema versions, in order; PRAGMA user_version = how many have run. */
const MIGRATIONS: string[] = [SQLITE_ENGINE_SCHEMA + OUTBOX_SCHEMA];

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
    await SQLite.deleteDatabaseAsync(file).catch(() => undefined);
  }
}

/** Opens `name` with a raw 32-byte key, verifies the key, applies pragmas and migrations. */
export async function openKeyed(name: string, keyHex: string): Promise<SQLite.SQLiteDatabase> {
  if (!/^[0-9a-f]{64}$/.test(keyHex)) throw new Error("Clave de base de datos inválida");
  const db = await SQLite.openDatabaseAsync(name);
  try {
    await db.execAsync(`PRAGMA key = "x'${keyHex}'"`);
    // Throws "file is not a database" when the key doesn't match the file.
    await db.getFirstAsync("SELECT count(*) FROM sqlite_master");
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
    } catch {
      // Wrong key or damaged file: rebuilt below.
    }
  }
  // ponytail: rebuilding is safe only while the outbox is never drained (M2 must drain or warn first).
  await deleteDatabaseFiles(V2_DB_NAME);
  const db = await openKeyed(V2_DB_NAME, await createDbKey());
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
