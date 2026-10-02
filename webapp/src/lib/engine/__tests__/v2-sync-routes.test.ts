// The sync routes against zeta-dev with a real signed-in user. Skipped without env:
//   set -a; source ../.env.v2-dev; set +a
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const env = process.env;
const enabled = Boolean(env.SUPABASE_DEV_DB_URL && env.SUPABASE_DEV_URL && env.SUPABASE_DEV_SECRET_KEY && env.SUPABASE_DEV_PUBLISHABLE_KEY);

describe.skipIf(!enabled)("v2 sync routes on zeta-dev", { timeout: 90_000 }, () => {
  const admin = enabled ? createClient(env.SUPABASE_DEV_URL!, env.SUPABASE_DEV_SECRET_KEY!, { auth: { persistSession: false } }) : (null as never);
  let userId = "";
  let token = "";
  let POST: (r: Request) => Promise<Response>;
  let GET: (r: Request) => Promise<Response>;
  const accountId = crypto.randomUUID();

  beforeAll(async () => {
    Object.assign(process.env, {
      V2_SUPABASE_URL: env.SUPABASE_DEV_URL, V2_SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_DEV_PUBLISHABLE_KEY, V2_DATABASE_URL: env.SUPABASE_DEV_DB_URL,
    });
    ({ POST } = await import("@/app/api/v2/commands/route"));
    ({ GET } = await import("@/app/api/v2/snapshot/route"));
    const email = `sync-${Date.now()}@zeta-dev.test`;
    const password = crypto.randomUUID();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
    const anon = createClient(env.SUPABASE_DEV_URL!, env.SUPABASE_DEV_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const signIn = await anon.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    token = signIn.data.session!.access_token;
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  const post = (body: unknown, auth = `Bearer ${token}`) =>
    POST(new Request("http://x/api/v2/commands", { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(body) }));
  const cmd = (type: string, payload: unknown, over: Record<string, unknown> = {}) =>
    ({ id: crypto.randomUUID(), type, userId, deviceId: "phone-sync", clientTs: new Date().toISOString(), payload, ...over });

  it("replays the phone's commands in order and answers each", async () => {
    const create = cmd("createAccount", { accountId, accountType: "SAVINGS", name: "Sync", currencyCode: "COP", balance: 100000 });
    const spend = cmd("captureManualTransaction", {
      transactionId: crypto.randomUUID(), accountId, amount: 25000, direction: "OUTFLOW", currencyCode: "COP",
      date: new Date().toISOString().slice(0, 10), description: "Desde el teléfono",
    });
    const res = await post({ commands: [create, spend] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.map((r: { result: { status: string } }) => r.result.status)).toEqual(["applied", "applied"]);
    // Sent again (a retry after a lost answer): same answers, nothing applied twice.
    const again = await (await post({ commands: [create, spend] })).json();
    expect(again.results.map((r: { result: { replayed: boolean } }) => r.result.replayed)).toEqual([true, true]);
  });

  it("the snapshot brings the phone's own rows back (reinstall / another phone)", async () => {
    const res = await GET(new Request("http://x/api/v2/snapshot?since=2026-01-01", { headers: { authorization: `Bearer ${token}` } }));
    expect(res.status).toBe(200);
    const { snapshot } = await res.json();
    expect(snapshot.accounts).toEqual([expect.objectContaining({ id: accountId, name: "Sync", current_balance: 75000 })]);
    expect(snapshot.transactions).toEqual([expect.objectContaining({ clean_description: "Desde el teléfono", amount: 25000 })]);
  });

  it("a command type this server doesn't know stays queued on the phone (failed, not answered)", async () => {
    const body = await (await post({ commands: [cmd("someFutureCommand", {})] })).json();
    expect(body.results).toEqual([]);
    expect(body.failed).toMatchObject({ error: "El servidor aún no conoce este cambio" });
  });

  it("Borrar mi cuenta: delete_user_account removes the user and all their v2 rows", async () => {
    const email = `delete-${Date.now()}@zeta-dev.test`;
    const password = crypto.randomUUID();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    const id = created.data.user.id;
    const client = createClient(env.SUPABASE_DEV_URL!, env.SUPABASE_DEV_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    const res = await POST(new Request("http://x/api/v2/commands", {
      method: "POST", headers: { authorization: `Bearer ${signIn.data.session!.access_token}`, "content-type": "application/json" },
      body: JSON.stringify({ commands: [{ id: crypto.randomUUID(), type: "createAccount", userId: id, deviceId: "d", clientTs: new Date().toISOString(),
        payload: { accountId: crypto.randomUUID(), accountType: "CASH", name: "Borrar", currencyCode: "COP", balance: 1 } }] }),
    }));
    expect(res.status).toBe(200);
    const { error } = await client.rpc("delete_user_account");
    expect(error).toBeNull();
    expect((await admin.auth.admin.getUserById(id)).data.user).toBeNull();
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: env.SUPABASE_DEV_DB_URL, max: 1 });
    const left = await pool.query("SELECT (SELECT count(*) FROM accounts_enc WHERE user_id = $1) + (SELECT count(*) FROM commands WHERE user_id = $1) AS n", [id]);
    await pool.end();
    expect(Number(left.rows[0].n)).toBe(0);
  });

  it("refuses commands for someone else, and requests without a valid token", async () => {
    expect((await post({ commands: [cmd("createAccount", {}, { userId: crypto.randomUUID() })] })).status).toBe(403);
    expect((await post({ commands: [cmd("createAccount", {})] }, "Bearer nope")).status).toBe(401);
    expect((await post({ commands: [] })).status).toBe(400);
    // Bank movements only come from the server.
    expect((await post({ commands: [cmd("captureBankTransaction", {})] })).status).toBe(403);
  });
});
