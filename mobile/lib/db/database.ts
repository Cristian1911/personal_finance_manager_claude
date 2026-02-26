import * as SQLite from "expo-sqlite";
import { MIGRATIONS } from "./schema";

let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const database = await SQLite.openDatabaseAsync("venti5.db");
      await runMigrations(database);
      db = database;
      return database;
    })().catch((error) => {
      // Allow retry if open/migrations fail.
      dbInitPromise = null;
      throw error;
    });
  }
  return dbInitPromise;
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync("PRAGMA journal_mode = WAL;");
  await database.execAsync("PRAGMA foreign_keys = ON;");
  for (const migration of MIGRATIONS) {
    await database.execAsync(migration);
  }
}

export async function clearDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM transactions;
    DELETE FROM accounts;
    DELETE FROM categories;
    DELETE FROM budgets;
    DELETE FROM profiles;
    DELETE FROM statement_snapshots;
    DELETE FROM sync_queue;
    DELETE FROM sync_metadata;
  `);
}
