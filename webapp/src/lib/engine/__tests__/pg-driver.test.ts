import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createUserScopedPgDriver } from "../pg-driver";

const USER = "11111111-1111-4111-8111-111111111111";

/** A pool whose single client fails ROLLBACK, as a dead connection would. */
function brokenRollbackPool() {
  const calls: string[] = [];
  let releasedWith: unknown = "never released";
  const client = {
    async query(sql: string) {
      calls.push(sql);
      if (sql === "ROLLBACK") throw new Error("connection lost");
      return { rows: [] };
    },
    release(err?: unknown) {
      releasedWith = err;
    },
  };
  const pool = { connect: async () => client } as unknown as Pool;
  return { pool, calls, released: () => releasedWith };
}

describe("createUserScopedPgDriver", () => {
  it("surfaces the original error and destroys the client when ROLLBACK fails", async () => {
    const { pool, released } = brokenRollbackPool();
    const d = createUserScopedPgDriver(pool, USER);
    await expect(d.transaction(async () => { throw new Error("original"); })).rejects.toThrow("original");
    expect(released()).toBeInstanceOf(Error);
  });

  it("serializes each user's transactions with an advisory lock", async () => {
    const { pool, calls } = brokenRollbackPool();
    await createUserScopedPgDriver(pool, USER).transaction(async () => "ok");
    expect(calls.some((c) => c.includes("pg_advisory_xact_lock"))).toBe(true);
  });
});
