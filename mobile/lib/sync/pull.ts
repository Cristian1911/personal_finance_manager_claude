import { monthStartStr, monthEndStr, subMonths } from "@zeta/shared";
import { supabase } from "../supabase";
import { getDatabase } from "../db/database";
import { invalidatePreferredCurrency } from "../profile";

/** Tables to sync from Supabase, in dependency order (FK targets first) */
const SYNC_TABLES = [
  "profiles",
  "accounts",
  "categories",
  "category_rules",
  "budgets",
  "tag_groups",
  "tags",
  "destinatarios",
  "destinatario_rules",
  "personal_debts",
  "recurring_transaction_templates",
  "transactions",
  "transaction_locations",
  "recurring_occurrences",
  "transaction_tags",
  "wishlist_items",
  "statement_snapshots",
  "planning_periods",
  "planning_entries",
  "planning_assignments",
  "subscriptions",
] as const;

type SyncTable = (typeof SYNC_TABLES)[number];

const TABLE_COLUMNS_CACHE = new Map<string, Set<string>>();

/** Boolean fields per table that need integer conversion for SQLite */
const BOOLEAN_FIELDS: Record<string, string[]> = {
  accounts: ["is_active", "show_in_dashboard", "is_payroll_deducted"],
  profiles: ["onboarding_completed", "location_tracking_enabled"],
  categories: ["is_system"],
  transactions: ["is_excluded", "is_subscription", "is_recurring"],
  recurring_transaction_templates: ["is_active"],
  destinatarios: ["is_active"],
  tag_groups: ["is_system"],
  tags: ["is_system"],
  recurring_occurrences: ["linked_manually"],
  wishlist_items: ["enriched"],
  planning_periods: ["is_active"],
  personal_debts: ["is_demo"],
};

/** JSON fields per table that need stringification for SQLite */
const JSON_FIELDS: Record<string, string[]> = {
  profiles: ["dashboard_config", "mobile_dashboard_config"],
  // Per-currency debt detail (JSONB remote, TEXT locally). Without stringifying
  // it, expo-sqlite can't bind the object and the whole accounts pull throws
  // ("runAsync failed"), stalling the sync cursor so transactions never pull.
  accounts: ["currency_balances"],
};

/** Remote → local column renames, applied before the column filter in
 * upsertRow. Without the rename, getTableColumns() silently DROPS the remote
 * field (no local column with that name), so the data never lands. */
const RENAMED_FIELDS: Record<string, Record<string, string>> = {
  // Supabase calls the curated description `clean_description`; local SQLite
  // predates that name and calls it `description`. Every pulled transaction
  // used to lose it — which also starved the local reconciliation matcher
  // (findReconciliationCandidates reads clean_description, aliased from the
  // local `description` column).
  transactions: { clean_description: "description" },
};

/** Tables with no updated_at — always full-replace on every sync */
const FULL_REPLACE_TABLES = new Set<SyncTable>([
  "tag_groups",
  "tags",
  "destinatario_rules",
  "recurring_occurrences",
  "transaction_tags",
]);

/**
 * Windowed tables sync only the current + previous month.
 * Column is the date field used for filtering.
 */
const WINDOWED_TABLES: Partial<Record<SyncTable, { column: string }>> = {
  transactions: { column: "transaction_date" },
  transaction_locations: { column: "captured_at" },
  recurring_occurrences: { column: "occurrence_date" },
};

/** Rows per page when paginating Supabase queries */
const PAGE_SIZE = 1000;

/** Concurrent table fetches during pull — parallel enough to collapse the
 * per-table round-trips, bounded so a first sync doesn't open 21 competing
 * connections on a constrained cellular link. */
const PULL_FETCH_CONCURRENCY = 6;

/** Map with bounded concurrency; never rejects — each slot settles. */
async function mapSettledWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        try {
          results[i] = { status: "fulfilled", value: await fn(items[i]) };
        } catch (reason) {
          results[i] = { status: "rejected", reason };
        }
      }
    }
  );
  await Promise.all(workers);
  return results;
}

/**
 * Fetch all rows using .range() pagination.
 * Accepts a factory that builds a fresh query each iteration,
 * because postgrest-js .range() mutates the builder in place.
 */
async function fetchAllPages(buildQuery: () => any): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

/**
 * Pull all tables from Supabase into local SQLite.
 * Reference tables sync fully; transactional tables use a date window
 * (current month + previous month), matching the webapp's query pattern.
 *
 * Two-phase for latency: the network fetches for all tables run CONCURRENTLY
 * (bounded pool — the old per-table sequential loop paid one full round-trip
 * per table even when a table had zero changes — ~21 sequential RTTs per
 * sync, which is what made background syncs take tens of seconds on mobile
 * data). The SQLite writes then apply strictly SERIALLY in FK-dependency
 * order — expo-sqlite's withTransactionAsync does not exclude other async
 * statements on the same connection, so concurrent apply transactions could
 * interleave and half-apply on rollback.
 *
 * Per-table failure isolation: a table whose fetch or apply fails is skipped
 * (cursor untouched → retried next sync) while every healthy table still
 * applies — one flaky endpoint must not block the other 20 tables. The first
 * error is rethrown at the end so callers still see the sync as failed.
 */
export async function pullAll(options?: {
  /** Probed between apply steps — a reset mid-run must not re-seed SQLite. */
  shouldAbort?: () => boolean;
}): Promise<Record<string, number>> {
  const shouldAbort = options?.shouldAbort;
  const db = await getDatabase();
  const counts: Record<string, number> = {};

  // All cursors in one local read — avoids a per-table metadata query.
  const metaRows = await db.getAllAsync<{
    table_name: string;
    last_synced_at: string | null;
  }>("SELECT table_name, last_synced_at FROM sync_metadata");
  const cursors = new Map(metaRows.map((r) => [r.table_name, r.last_synced_at]));

  // Phase 1 — network, concurrent (bounded). Indexes align with SYNC_TABLES.
  const fetched = await mapSettledWithConcurrency(
    SYNC_TABLES,
    PULL_FETCH_CONCURRENCY,
    (table) => fetchTable(table, cursors.get(table) ?? null)
  );

  // Phase 2 — local writes, serial.
  // Disable FK checks during sync — windowed tables (transactions) may not
  // include rows referenced by junction tables (transaction_tags). Data
  // integrity is enforced server-side by Supabase.
  let firstError: unknown = null;
  await db.execAsync("PRAGMA foreign_keys = OFF");
  try {
    for (let i = 0; i < SYNC_TABLES.length; i++) {
      if (shouldAbort?.()) {
        throw new Error("Sync aborted: local data reset in progress");
      }
      const table = SYNC_TABLES[i];
      const result = fetched[i];
      if (result.status === "rejected") {
        if (firstError === null) firstError = result.reason;
        continue;
      }
      try {
        counts[table] = await applyTable(db, table, result.value);
      } catch (err) {
        if (firstError === null) firstError = err;
      }
    }
  } finally {
    await db.execAsync("PRAGMA foreign_keys = ON");
  }

  if (firstError !== null) throw firstError;
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

type FetchedTable = {
  data: any[];
  isFullReplace: boolean;
  winStart: string | null;
  winEnd: string | null;
};

/** Network phase for one table — no SQLite writes, safe to run concurrently. */
async function fetchTable(
  table: SyncTable,
  lastSyncedAt: string | null
): Promise<FetchedTable> {
  const isFullReplace = FULL_REPLACE_TABLES.has(table);
  const dateWindow = WINDOWED_TABLES[table];

  // Compute window bounds once to avoid drift at month boundaries
  const now = new Date();
  const winStart = dateWindow ? monthStartStr(subMonths(now, 1)) : null;
  const winEnd = dateWindow ? monthEndStr(now) : null;

  // Query factory: builds a fresh query per pagination page
  const buildQuery = () => {
    let q: any = (supabase as any).from(table).select("*");

    if (dateWindow && winStart && winEnd) {
      q = q.gte(dateWindow.column, winStart).lte(dateWindow.column, winEnd);
      // Also fetch rows with null date column (e.g. statement_snapshots)
      // PostgREST gte/lte excludes NULLs, so we use an or-filter
    }

    if (!isFullReplace && lastSyncedAt) {
      q = q.gt("updated_at", lastSyncedAt);
    }

    if (!isFullReplace) {
      q = q.order("created_at", { ascending: true });
    }

    return q;
  };

  const data = await fetchAllPages(buildQuery);
  return { data, isFullReplace, winStart, winEnd };
}

/** Local write phase for one table — must run serially with other applies. */
async function applyTable(
  db: Awaited<ReturnType<typeof getDatabase>>,
  table: SyncTable,
  { data, isFullReplace, winStart, winEnd }: FetchedTable
): Promise<number> {
  const dateWindow = WINDOWED_TABLES[table];
  if (data.length === 0) return 0;

  // Upsert rows into SQLite
  let upserted = 0;
  let failed = 0;
  let firstError: unknown = null;

  if (isFullReplace) {
    // For windowed full-replace tables, only delete rows within the window
    await db.withTransactionAsync(async () => {
      if (dateWindow && winStart && winEnd) {
        await db.runAsync(
          `DELETE FROM ${table} WHERE ${dateWindow.column} >= ? AND ${dateWindow.column} <= ?`,
          [winStart, winEnd]
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
    // Wrap incremental upserts in a transaction for atomicity + performance
    await db.withTransactionAsync(async () => {
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
  }

  if (failed > 0) {
    const reason =
      firstError instanceof Error ? firstError.message : String(firstError);
    throw new Error(
      `Pull ${table} incomplete: ${failed} row(s) failed to apply. Last sync cursor was not advanced. First error: ${reason}`
    );
  }

  // Drop in-memory caches keyed off profile columns so the next read sees
  // fresh values (e.g. if the user changed preferred_currency elsewhere).
  if (table === "profiles" && upserted > 0) {
    invalidatePreferredCurrency();
  }

  // Update sync metadata. Advance the cursor to the newest SERVER-side
  // updated_at actually pulled — never the client clock. The old
  // `new Date().toISOString()` cursor silently skipped rows forever when the
  // device clock ran ahead of the server (next pull filtered
  // `updated_at > client-now`, which server-stamped rows written in the gap
  // could never satisfy).
  const maxUpdatedAt = data.reduce<string | null>((max, row) => {
    const v = (row as Record<string, unknown>).updated_at;
    return typeof v === "string" && (max === null || v > max) ? v : max;
  }, null);
  if (maxUpdatedAt === null && !isFullReplace) {
    // Incremental batch with no server timestamps (shouldn't happen — these
    // tables filter on updated_at). Leave the cursor untouched rather than
    // stamping the client clock, which is exactly the skew bug above.
    return upserted;
  }
  // Full-replace tables ignore the cursor when querying; the client-clock
  // fallback there is only informational.
  const syncedAt = maxUpdatedAt ?? new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_metadata (table_name, last_synced_at)
     VALUES (?, ?)
     ON CONFLICT(table_name) DO UPDATE SET last_synced_at = excluded.last_synced_at`,
    [table, syncedAt]
  );

  return upserted;
}

async function upsertRow(
  db: Awaited<ReturnType<typeof getDatabase>>,
  table: string,
  row: Record<string, unknown>
): Promise<void> {
  const processed = { ...row };

  const renames = RENAMED_FIELDS[table];
  if (renames) {
    for (const [remoteCol, localCol] of Object.entries(renames)) {
      if (remoteCol in processed && !(localCol in processed)) {
        processed[localCol] = processed[remoteCol];
        delete processed[remoteCol];
      }
    }
  }

  if (table === "statement_snapshots") {
    const inferredPeriod =
      // period_to/period_from are the real Supabase columns; period/statement_date
      // are local-only (never in a pulled row). Without period_to first, every
      // pulled snapshot bucketed by the IMPORT month, not the statement month.
      inferMonthPeriod(processed.period_to) ??
      inferMonthPeriod(processed.period_from) ??
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
  // Defense-in-depth: expo-sqlite can only bind string | number | null. Any
  // other type (a JSON object from a column not in JSON_FIELDS, or a boolean
  // from a column not in BOOLEAN_FIELDS) makes runAsync throw and stalls the
  // whole sync cursor. Coerce instead of crashing the pull.
  const values = columns.map((col) => {
    const v = processed[col];
    if (v == null) return null;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "object") return JSON.stringify(v);
    return v as string | number;
  });

  await db.runAsync(
    `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
    values as (string | number | null)[]
  );
}
