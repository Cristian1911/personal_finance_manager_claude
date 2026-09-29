import initSqlJs from "sql.js";
import { PGlite } from "@electric-sql/pglite";
import type { SqlDriver } from "../../types";
import { toDialect } from "../../sql";
import { POSTGRES_SCHEMA, SQLITE_SCHEMA } from "./schema";

export async function createSqlJsDriver(): Promise<SqlDriver> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec(SQLITE_SCHEMA);
  let depth = 0;
  const driver: SqlDriver = {
    dialect: "sqlite",
    async query(sql, params = []) {
      const stmt = db.prepare(sql);
      stmt.bind(params as (string | number | null)[]);
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows as never;
    },
    async transaction(fn) {
      if (depth > 0) return fn(driver);
      depth++;
      db.exec("BEGIN");
      try {
        const r = await fn(driver);
        db.exec("COMMIT");
        return r;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      } finally {
        depth--;
      }
    },
  };
  return driver;
}

export async function createPgliteDriver(): Promise<SqlDriver> {
  const db = new PGlite();
  await db.exec(POSTGRES_SCHEMA);
  type Q = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
  const wrap = (q: Q, inTx: boolean): SqlDriver => {
    const d: SqlDriver = {
      dialect: "postgres",
      async query(sql, params = []) {
        return (await q.query(sql, params)).rows as never;
      },
      async transaction(fn) {
        if (inTx) return fn(d);
        return db.transaction((tx) => fn(wrap(tx as unknown as Q, true)));
      },
    };
    return d;
  };
  return wrap(db as unknown as Q, false);
}

/** Both drivers; every contract test runs once per entry. */
export const DRIVERS: [string, () => Promise<SqlDriver>][] = [
  ["sqlite", createSqlJsDriver],
  ["postgres", createPgliteDriver],
];

export async function seedAccount(
  driver: SqlDriver,
  row: { id: string; userId: string; balance: number },
): Promise<void> {
  await driver.query(
    toDialect("INSERT INTO accounts (id, user_id, current_balance) VALUES (?, ?, ?)", driver.dialect),
    [row.id, row.userId, row.balance],
  );
}
