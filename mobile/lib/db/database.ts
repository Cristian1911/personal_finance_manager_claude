import * as SQLite from "expo-sqlite";
import { DB_MIGRATIONS, LATEST_DB_VERSION } from "./schema";

let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const database = await SQLite.openDatabaseAsync("zeta.db");
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

  const versionRow = await database.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  );
  const currentVersion = versionRow?.user_version ?? 0;

  for (const migration of DB_MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    await database.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        try {
          await database.execAsync(statement);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes("duplicate column name")) continue;
          throw error;
        }
      }
      await database.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

export async function clearDatabase(): Promise<void> {
  const database = await getDatabase();
  // Order matters: `PRAGMA foreign_keys = ON` (set in runMigrations) rejects
  // deletes that would orphan referenced rows. Delete dependent rows first,
  // parents last. Specifically:
  //   budgets.default_category_id → categories (budgets before categories)
  //   statement_snapshots.account_id → accounts (snapshots before accounts)
  //   transactions.account_id/category_id → accounts/categories
  //   recurring_occurrences → recurring_transaction_templates → accounts
  //   tags.group_id → tag_groups
  //   planning_assignments → planning_entries → planning_periods
  await database.execAsync(`
    DELETE FROM wishlist_items;
    DELETE FROM transaction_tags;
    DELETE FROM recurring_occurrences;
    DELETE FROM planning_assignments;
    DELETE FROM planning_entries;
    DELETE FROM planning_periods;
    DELETE FROM recurring_transaction_templates;
    DELETE FROM destinatario_rules;
    DELETE FROM destinatarios;
    DELETE FROM statement_snapshots;
    DELETE FROM budgets;
    DELETE FROM transactions;
    DELETE FROM accounts;
    DELETE FROM categories;
    DELETE FROM tags;
    DELETE FROM tag_groups;
    DELETE FROM profiles;
    DELETE FROM sync_queue;
    DELETE FROM sync_metadata;
  `);
  await database.execAsync(`PRAGMA user_version = ${LATEST_DB_VERSION}`);
}
