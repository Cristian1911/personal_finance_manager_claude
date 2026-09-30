import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";
import type { SqlDriver } from "@zeta/shared";

/**
 * SqlDriver over ONE expo-sqlite connection. Every call waits its turn on a
 * promise-chain mutex, so an engine command and a (future) sync write never
 * interleave inside a transaction. Transactions are BEGIN/COMMIT on this same
 * connection — withExclusiveTransactionAsync would open a second connection
 * without the SQLCipher key. Inside a transaction, use the `tx` driver the
 * callback receives; calling the outer driver there would wait on itself.
 */
export function createExpoSqliteDriver(db: SQLiteDatabase): SqlDriver {
  // ponytail: one lock for the whole database; the phone has one user and short transactions.
  let tail: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };

  const all = (sql: string, params: unknown[] = []) =>
    db.getAllAsync(sql, params as SQLiteBindValue[]) as Promise<never>;

  const inTx: SqlDriver = {
    dialect: "sqlite",
    query: (sql, params) => all(sql, params),
    transaction: (fn) => fn(inTx),
  };

  return {
    dialect: "sqlite",
    query: (sql, params) => exclusive(() => all(sql, params)),
    transaction: (fn) =>
      exclusive(async () => {
        // A failed ROLLBACK after a failed COMMIT leaves the connection inside a
        // transaction; end it here instead of failing every later BEGIN.
        if (await db.isInTransactionAsync()) await db.execAsync("ROLLBACK");
        await db.execAsync("BEGIN IMMEDIATE");
        try {
          const result = await fn(inTx);
          await db.execAsync("COMMIT");
          return result;
        } catch (e) {
          await db.execAsync("ROLLBACK").catch(() => undefined);
          throw e;
        }
      }),
  };
}
