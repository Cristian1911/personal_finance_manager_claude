import * as SQLite from "expo-sqlite";
import { DB_MIGRATIONS, LATEST_DB_VERSION } from "./schema";
import { invalidateProfileCaches } from "../profile-cache";

let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const database = await SQLite.openDatabaseAsync("zeta.db");
      await applyConnectionPragmas(database);
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

/**
 * Connection-level PRAGMAs, applied once per opened connection. We keep a single
 * cached connection, so this runs once at startup. Order matters: busy_timeout
 * first (the WAL switch itself can briefly lock), then WAL, then synchronous.
 *
 * synchronous=NORMAL (safe only with WAL) drops the per-commit fsync — the
 * highest-value change for this write-heavy offline cache. Trade-off: an
 * OS-crash / power-loss can lose the last transaction(s) since the WAL
 * checkpoint; acceptable because Supabase is the source of truth and unsynced
 * local edits are rare and re-enterable.
 */
async function applyConnectionPragmas(
  database: SQLite.SQLiteDatabase
): Promise<void> {
  await database.execAsync(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA cache_size = -8000;
    PRAGMA mmap_size = 67108864;
    PRAGMA temp_store = MEMORY;
  `);
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
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
  // Session caches derived from the profile row must die with the data. This
  // runs on logout, user switch, demo enter/exit, account deletion and "borrar
  // todos mis datos" — 9 call sites, so invalidating here instead of at each
  // one is what keeps a second user on the same device from inheriting the
  // first user's nav_focus / preferred_currency.
  invalidateProfileCaches();
  const database = await getDatabase();
  // Order matters: `PRAGMA foreign_keys = ON` (set in applyConnectionPragmas) rejects
  // deletes that would orphan referenced rows. Delete dependent rows first,
  // parents last. Specifically:
  //   budgets.default_category_id → categories (budgets before categories)
  //   statement_snapshots.account_id → accounts (snapshots before accounts)
  //   transactions.account_id/category_id → accounts/categories
  //   recurring_occurrences → recurring_transaction_templates → accounts
  //   tags.group_id → tag_groups
  //   planning_assignments → planning_entries → planning_periods
  //   subscriptions → destinatarios + recurring_transaction_templates
  //   personal_debts → destinatarios
  //   category_rules → categories
  await database.execAsync(`
    DELETE FROM wishlist_items;
    DELETE FROM transaction_tags;
    DELETE FROM recurring_occurrences;
    DELETE FROM planning_assignments;
    DELETE FROM planning_entries;
    DELETE FROM planning_periods;
    DELETE FROM subscriptions;
    DELETE FROM personal_debts;
    DELETE FROM recurring_transaction_templates;
    DELETE FROM destinatario_rules;
    DELETE FROM destinatario_suggestion_dismissals;
    DELETE FROM destinatarios;
    DELETE FROM statement_snapshots;
    DELETE FROM budgets;
    DELETE FROM transaction_locations;
    DELETE FROM location_pings;
    DELETE FROM transactions;
    DELETE FROM accounts;
    DELETE FROM category_rules;
    DELETE FROM categories;
    DELETE FROM tags;
    DELETE FROM tag_groups;
    DELETE FROM profiles;
    DELETE FROM sync_queue;
    DELETE FROM sync_metadata;
  `);
  await database.execAsync(`PRAGMA user_version = ${LATEST_DB_VERSION}`);
}
