import "server-only";
import type { Pool, PoolClient } from "pg";
import type { SqlDriver } from "@zeta/shared";

/**
 * Postgres access AS the signed-in user: each transaction switches to the
 * `authenticated` role and sets the JWT claims, so RLS, auth.uid() and the
 * encrypted views' triggers behave exactly as for PostgREST requests.
 * Server-only — never ship to the client.
 */
export function createUserScopedPgDriver(pool: Pool, userId: string): SqlDriver {
  const onClient = (client: PoolClient): SqlDriver => {
    const d: SqlDriver = {
      dialect: "postgres",
      async query(sql, params = []) {
        return (await client.query(sql, params as unknown[])).rows as never;
      },
      async transaction(fn) {
        return fn(d);
      },
    };
    return d;
  };

  const driver: SqlDriver = {
    dialect: "postgres",
    query(sql, params) {
      return driver.transaction((tx) => tx.query(sql, params));
    },
    async transaction(fn) {
      const client = await pool.connect();
      let broken: Error | undefined;
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL ROLE authenticated");
        await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: userId, role: "authenticated" }),
        ]);
        // One command at a time per user: read-then-write steps (field
        // versions, replay checks) must not interleave across devices.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [userId]);
        const result = await fn(onClient(client));
        await client.query("COMMIT");
        return result;
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          // Keep the original error; a client that can't roll back may still
          // hold the user's role, so it must not return to the pool.
          broken = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
        }
        throw e;
      } finally {
        client.release(broken);
      }
    },
  };
  return driver;
}
