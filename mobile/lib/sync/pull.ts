import { supabase } from "../supabase";
import { getDatabase } from "../db/database";

/** Tables to sync from Supabase, in dependency order */
const SYNC_TABLES = [
  "profiles",
  "accounts",
  "categories",
  "budgets",
  "tag_groups",
  "tags",
  "destinatarios",
  "destinatario_rules",
  "recurring_transaction_templates",
  "recurring_occurrences",
  "transactions",
  "transaction_tags",
  "wishlist_items",
  "statement_snapshots",
] as const;

type SyncTable = (typeof SYNC_TABLES)[number];

const TABLE_COLUMNS_CACHE = new Map<string, Set<string>>();

/** Boolean fields per table that need integer conversion for SQLite */
const BOOLEAN_FIELDS: Record<string, string[]> = {
  accounts: ["is_active", "show_in_dashboard", "is_payroll_deducted"],
  profiles: ["onboarding_completed"],
  categories: ["is_system"],
  transactions: ["is_excluded", "is_subscription", "is_recurring"],
  recurring_transaction_templates: ["is_active"],
  destinatarios: ["is_active"],
  tag_groups: ["is_system"],
  tags: ["is_system"],
  recurring_occurrences: ["linked_manually"],
  wishlist_items: ["enriched"],
};

/** JSON fields per table that need stringification for SQLite */
const JSON_FIELDS: Record<string, string[]> = {
  statement_snapshots: ["statement_json"],
};

/** Tables with no updated_at — always full-replace on every sync */
const FULL_REPLACE_TABLES = new Set<string>([
  "tag_groups",
  "tags",
  "destinatario_rules",
  "recurring_occurrences",
  "transaction_tags",
]);

/**
 * Tables that should be windowed by date instead of syncing all rows.
 * Maps table name → { column: date column to filter on }.
 */
const WINDOWED_TABLES: Record<string, { column: string }> = {
  transactions: { column: "transaction_date" },
  statement_snapshots: { column: "statement_date" },
  recurring_occurrences: { column: "occurrence_date" },
};

/** Rows per page when paginating Supabase queries */
const PAGE_SIZE = 1000;

/**
 * Returns the first day of N months ago as "YYYY-MM-DD".
 * Mirrors webapp's monthStartStr() pattern.
 */
function windowStartDate(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * Returns the last day of the current month as "YYYY-MM-DD".
 * Mirrors webapp's monthEndStr() pattern.
 */
function windowEndDate(): string {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, "0");
  const d = String(end.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Fetch all rows from a Supabase query using .range() pagination.
 * Iterates in PAGE_SIZE batches until all matching rows are fetched.
 */
async function fetchAllPages(baseQuery: any): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await baseQuery.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...data);

    // If we got fewer rows than PAGE_SIZE, we've reached the end
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

/**
 * Pull all tables from Supabase into local SQLite.
 * Reference tables sync fully; transactional tables use a date window
 * (current month + previous month), matching the webapp's query pattern.
 */
export async function pullAll(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const counts: Record<string, number> = {};

  for (const table of SYNC_TABLES) {
    counts[table] = await pullTable(db, table);
  }

  return counts;
}

function inferMonthPeriod(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}/.test(value)) return value.slice(0, 7);
  return null;
}

async function getTableColumns(
  db: Awaited<ReturnType<typeof getDatabase>>,
  table: string
): Promise<Set<string>> {
  const cached = TABLE_COLUMNS_CACHE.get(table);
  if (cached) return cached;

  const rows = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`
  );
  const columns = new Set<string>(rows.map((row: { name: string }) => row.name));
  TABLE_COLUMNS_CACHE.set(table, columns);
  return columns;
}

async function pullTable(
  db: Awaited<ReturnType<typeof getDatabase>>,
  table: SyncTable
): Promise<number> {
  const isFullReplace = FULL_REPLACE_TABLES.has(table);
  const window = WINDOWED_TABLES[table];

  // Read last sync timestamp
  const meta = await db.getFirstAsync<{ last_synced_at: string | null }>(
    "SELECT last_synced_at FROM sync_metadata WHERE table_name = ?",
    [table]
  );
  const lastSyncedAt = meta?.last_synced_at;

  // Build Supabase query
  let query: any = (supabase as any).from(table).select("*");

  // Apply date window for transactional tables (current + previous month)
  if (window) {
    const start = windowStartDate();
    const end = windowEndDate();
    query = query.gte(window.column, start).lte(window.column, end);
  }

  // Incremental sync: only fetch rows updated since last sync
  if (!isFullReplace && lastSyncedAt) {
    query = query.gt("updated_at", lastSyncedAt);
  }

  // Ordering for non-junction tables
  if (!isFullReplace) {
    query = query.order("created_at", { ascending: true });
  }

  // Fetch all matching rows with pagination
  const data = await fetchAllPages(query);
  if (data.length === 0) return 0;

  // Upsert each row into SQLite (skip only invalid rows, don't fail whole sync)
  let upserted = 0;
  let failed = 0;
  let firstError: unknown = null;

  if (isFullReplace) {
    // For windowed full-replace tables, only delete rows within the window
    await db.withTransactionAsync(async () => {
      if (window) {
        const start = windowStartDate();
        const end = windowEndDate();
        await db.runAsync(
          `DELETE FROM ${table} WHERE ${window.column} >= ? AND ${window.column} <= ?`,
          [start, end]
        );
      } else {
        await db.runAsync(`DELETE FROM ${table}`);
      }
      for (const row of data) {
        try {
          await upsertRow(db, table, row);
          upserted++;
        } catch (error) {
          failed++;
          if (!firstError) firstError = error;
          console.warn(
            `Skipping invalid ${table} row during pull:`,
            (row as { id?: string }).id ?? "<no-id>",
            error
          );
        }
      }
    });
  } else {
    for (const row of data) {
      try {
        await upsertRow(db, table, row);
        upserted++;
      } catch (error) {
        failed++;
        if (!firstError) firstError = error;
        console.warn(
          `Skipping invalid ${table} row during pull:`,
          (row as { id?: string }).id ?? "<no-id>",
          error
        );
      }
    }
  }

  if (failed > 0) {
    const reason =
      firstError instanceof Error ? firstError.message : String(firstError);
    throw new Error(
      `Pull ${table} incomplete: ${failed} row(s) failed to apply. Last sync cursor was not advanced. First error: ${reason}`
    );
  }

  // Update sync metadata
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_metadata (table_name, last_synced_at)
     VALUES (?, ?)
     ON CONFLICT(table_name) DO UPDATE SET last_synced_at = excluded.last_synced_at`,
    [table, now]
  );

  return upserted;
}

async function upsertRow(
  db: Awaited<ReturnType<typeof getDatabase>>,
  table: string,
  row: Record<string, unknown>
): Promise<void> {
  const processed = { ...row };

  if (table === "statement_snapshots") {
    const inferredPeriod =
      inferMonthPeriod(processed.period) ??
      inferMonthPeriod(processed.statement_date) ??
      inferMonthPeriod(processed.created_at) ??
      inferMonthPeriod(processed.updated_at) ??
      new Date().toISOString().slice(0, 7);
    processed.period = inferredPeriod;
  }

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

  const tableColumns = await getTableColumns(db, table);
  const columns = Object.keys(processed).filter((col) => tableColumns.has(col));
  if (columns.length === 0) return;
  const placeholders = columns.map(() => "?").join(", ");
  const values = columns.map((col) => processed[col] ?? null);

  await db.runAsync(
    `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
    values as (string | number | null)[]
  );
}
