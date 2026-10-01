import type { InicioAccount, StoredTransaction } from "./disponible";
import { createSqlStorage } from "./sql-storage";
import { toDialect, toIso, toNumber } from "./sql";
import type { CycleSettings, SqlDriver } from "./types";

export interface InicioData {
  settings: CycleSettings | null;
  accounts: InicioAccount[];
  /** Movements dated on or after `since`, as the classifier reads them. */
  transactions: StoredTransaction[];
}

/**
 * Everything Inicio reads, in three queries, from the phone's SQLite or from
 * Postgres (same statements through toDialect). Scoped by `userId` even
 * where RLS already does it. Read-only: writes always go through commands.
 */
export async function readInicioData(driver: SqlDriver, userId: string, since: string): Promise<InicioData> {
  const pg = driver.dialect === "postgres";
  const q = <R>(sql: string, params: unknown[]) => driver.query<R>(toDialect(sql, driver.dialect), params);

  const settings = await createSqlStorage(driver).getCycleSettings(userId);

  const accountRows = await q<Record<string, unknown>>(
    `SELECT a.id, a.account_type, a.current_balance, s.counts_in_disponible
       FROM accounts a
       LEFT JOIN account_settings s ON s.user_id = a.user_id AND s.account_id = a.id
      WHERE a.user_id = ?
      ORDER BY a.id`,
    [userId],
  );

  // Dates as text on Postgres: a JS Date would shift the day with the time zone.
  const txRows = await q<Record<string, unknown>>(
    `SELECT id, account_id, amount, currency_code, direction,
            ${pg ? "transaction_date::text" : "transaction_date"} AS transaction_date,
            capture_method, created_at, clean_description, notes, is_excluded
       FROM transactions
      WHERE user_id = ? AND transaction_date >= ?
      ORDER BY transaction_date, id`,
    [userId, since],
  );

  return {
    settings,
    accounts: accountRows.map((r) => ({
      id: String(r.id),
      accountType: String(r.account_type),
      currentBalance: toNumber(r.current_balance),
      // SQLite stores booleans as 0/1.
      countsInDisponible: r.counts_in_disponible == null ? null : r.counts_in_disponible === true || r.counts_in_disponible === 1,
    })),
    transactions: txRows.map((r) => ({
      id: String(r.id),
      accountId: String(r.account_id),
      date: String(r.transaction_date),
      amount: toNumber(r.amount),
      direction: r.direction as "INFLOW" | "OUTFLOW",
      currencyCode: String(r.currency_code),
      captureMethod: (r.capture_method as string | null) ?? null,
      createdAt: r.created_at == null ? null : toIso(r.created_at),
      description: (r.clean_description as string | null) ?? null,
      notes: (r.notes as string | null) ?? null,
      // SQLite stores booleans as 0/1.
      isExcluded: r.is_excluded === true || r.is_excluded === 1,
      // The phone's v2 tables have no flow class yet: the classifier treats
      // unclassified rows like the web (outflow = spend, inflow = income).
      flowClass: null,
    })),
  };
}
