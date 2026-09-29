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
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL ROLE authenticated");
        await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: userId, role: "authenticated" }),
        ]);
        const result = await fn(onClient(client));
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
  return driver;
}
