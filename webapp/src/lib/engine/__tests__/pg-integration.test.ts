// Runs the shared engine against zeta-dev's REAL schema: encrypted views,
// INSTEAD OF triggers and RLS, as a signed-in user. Skipped without env:
//   set -a; source ../.env.v2-dev; set +a
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { applyCommand, createSqlStorage, toDialect } from "@zeta/shared";
import { createUserScopedPgDriver } from "../pg-driver";

const env = process.env;
const enabled = Boolean(env.SUPABASE_DEV_DB_URL && env.SUPABASE_DEV_URL && env.SUPABASE_DEV_SECRET_KEY);

// Remote DB (sa-east-1): each command is ~10 round trips, so allow more than the 5s default.
describe.skipIf(!enabled)("engine on zeta-dev (real Postgres)", { timeout: 30_000 }, () => {
  const admin = enabled
    ? createClient(env.SUPABASE_DEV_URL!, env.SUPABASE_DEV_SECRET_KEY!, { auth: { persistSession: false } })
    : (null as never);
  const pool = enabled ? new Pool({ connectionString: env.SUPABASE_DEV_DB_URL, max: 2 }) : (null as never);
  let userId = "";
  const accountId = crypto.randomUUID();
  const txId = crypto.randomUUID();

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `engine-${Date.now()}@zeta-dev.test`, password: crypto.randomUUID(), email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    const d = createUserScopedPgDriver(pool, userId);
    await d.query(
      toDialect("INSERT INTO accounts (id, user_id, name, account_type, currency_code, current_balance) VALUES (?, ?, ?, 'CHECKING', 'COP', 100000)", "postgres"),
      [accountId, userId, "Cuenta motor"],
    );
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
    await pool.end();
  });

  it("applies, replays and versions exactly like the contract suite", async () => {
    const s = createSqlStorage(createUserScopedPgDriver(pool, userId));
    const base = { userId, deviceId: "integration", clientTs: "2026-09-18T15:00:00.000Z" };
    const capture = {
      ...base, id: crypto.randomUUID(), type: "captureManualTransaction" as const,
      payload: { transactionId: txId, accountId, amount: 25000, direction: "OUTFLOW" as const, currencyCode: "COP", date: "2026-09-18", description: "Tostao motor" },
    };

    expect(await applyCommand(s, capture)).toEqual({ status: "applied", replayed: false, data: { transactionId: txId } });
    expect((await applyCommand(s, capture)).replayed).toBe(true);
    expect((await s.getAccount(accountId))?.currentBalance).toBe(75000);
    expect((await s.getTransaction(txId))?.cleanDescription).toBe("Tostao motor");

    const newer = { ...base, id: crypto.randomUUID(), type: "setTransactionNote" as const, clientTs: "2026-09-18T17:00:00.000Z", payload: { transactionId: txId, notes: "nueva" } };
    const older = { ...base, id: crypto.randomUUID(), type: "setTransactionNote" as const, clientTs: "2026-09-18T16:00:00.000Z", payload: { transactionId: txId, notes: "vieja" } };
    expect((await applyCommand(s, newer)).status).toBe("applied");
    expect((await applyCommand(s, older)).status).toBe("superseded");
    expect((await s.getTransaction(txId))?.notes).toBe("nueva");
  });

  it("stores the command payload encrypted, never as plain text", async () => {
    const d = createUserScopedPgDriver(pool, userId);
    const rows = await d.query<{ payload_enc: Buffer }>(
      toDialect("SELECT payload_enc FROM commands WHERE user_id = ? AND type = 'captureManualTransaction' LIMIT 1", "postgres"),
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(Buffer.from(rows[0].payload_enc).toString("utf8")).not.toContain("Tostao motor");
  });
});
