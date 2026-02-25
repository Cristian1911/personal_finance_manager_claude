import { supabase } from "../supabase";
import { getDatabase } from "../db/database";

/** Tables to sync from Supabase, in dependency order */
const SYNC_TABLES = [
  "profiles",
  "accounts",
  "categories",
  "budgets",
  "transactions",
  "statement_snapshots",
] as const;

type SyncTable = (typeof SYNC_TABLES)[number];

/** Boolean fields per table that need integer conversion for SQLite */
const BOOLEAN_FIELDS: Record<string, string[]> = {
  accounts: ["is_active"],
  profiles: ["onboarding_completed"],
  categories: ["is_system"],
  transactions: ["is_excluded"],
};

/** JSON fields per table that need stringification for SQLite */
const JSON_FIELDS: Record<string, string[]> = {
  statement_snapshots: ["statement_json"],
};

/**
 * Pull all tables from Supabase into local SQLite.
 * Uses incremental sync based on `updated_at` timestamps.
 */
export async function pullAll(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const counts: Record<string, number> = {};

  for (const table of SYNC_TABLES) {
    counts[table] = await pullTable(db, table);
  }

  return counts;
}

async function pullTable(
  db: Awaited<ReturnType<typeof getDatabase>>,
  table: SyncTable
): Promise<number> {
  // Read last sync timestamp
  const meta = await db.getFirstAsync<{ last_synced_at: string | null }>(
    "SELECT last_synced_at FROM sync_metadata WHERE table_name = ?",
    [table]
  );
  const lastSyncedAt = meta?.last_synced_at;

  // Query Supabase for new/updated rows
  let query: any = supabase.from(table).select("*");
  if (lastSyncedAt) {
    query = query.gt("updated_at", lastSyncedAt);
  }

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw new Error(`Pull ${table} failed: ${error.message}`);
  if (!data || data.length === 0) return 0;

  // Upsert each row into SQLite
  for (const row of data) {
    await upsertRow(db, table, row);
  }

  // Update sync metadata
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_metadata (table_name, last_synced_at)
     VALUES (?, ?)
     ON CONFLICT(table_name) DO UPDATE SET last_synced_at = excluded.last_synced_at`,
    [table, now]
  );

  return data.length;
}

async function upsertRow(
  db: Awaited<ReturnType<typeof getDatabase>>,
  table: string,
  row: Record<string, unknown>
): Promise<void> {
  const processed = { ...row };

  // Convert booleans to integers for SQLite
  const boolFields = BOOLEAN_FIELDS[table] ?? [];
  for (const field of boolFields) {
    if (field in processed) {
      processed[field] = processed[field] ? 1 : 0;
    }
  }

  // Stringify JSON fields
  const jsonFields = JSON_FIELDS[table] ?? [];
  for (const field of jsonFields) {
    if (field in processed && typeof processed[field] === "object") {
      processed[field] = JSON.stringify(processed[field]);
    }
  }

  const columns = Object.keys(processed);
  const placeholders = columns.map(() => "?").join(", ");
  const values = columns.map((col) => processed[col] ?? null);

  await db.runAsync(
    `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
    values as (string | number | null)[]
  );
}
