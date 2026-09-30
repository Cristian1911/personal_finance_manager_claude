// Guards the EXECUTE grants on SECURITY DEFINER functions that take a user id
// (or decrypt for one): anyone holding the anon key must not be able to read,
// decrypt or rewrite another user's data through them. Runs against zeta-dev;
// skipped without env:
//   set -a; source ../.env.v2-dev; set +a
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

const env = process.env;
const enabled = Boolean(env.SUPABASE_DEV_DB_URL && env.SUPABASE_DEV_URL && env.SUPABASE_DEV_SECRET_KEY);

/** Callable only by service_role (webhooks, cron) and owner-rights functions. */
const SERVICE_ONLY = [
  "zeta_decrypt_as(bytea,uuid)",
  "get_accounts_with_masks(uuid)",
  "get_email_ingest_settings(text)",
  "set_gmail_verification(uuid,uuid,text)",
  "generate_occurrences_for_template(uuid)",
  "cleanup_anonymous_demo_users(interval)",
  // MCP analysis RPCs: take any user id and decrypt (zeta-dev had drifted to anon-executable).
  "zeta_mcp_tx_base(uuid,date,date)",
  "zeta_mcp_accounts(uuid)",
  "zeta_mcp_transactions(uuid,date,date,text,uuid,text,text,numeric,integer,integer)",
  "zeta_mcp_breakdown(uuid,date,date)",
  "zeta_mcp_cashflow(uuid,integer)",
  "zeta_mcp_recurring(uuid)",
  "zeta_mcp_data_quality(uuid,date,date)",
  "zeta_flow_class_candidates(uuid)",
];
/** Needed by the encrypted views' insert triggers, which run as the signed-in user. */
const SIGNED_IN_ONLY = ["zeta_encrypt_as(text,uuid)", "zeta_hmac_as(text,uuid)"];

describe.skipIf(!enabled)("SECURITY DEFINER grants on zeta-dev", { timeout: 30_000 }, () => {
  const pool = enabled ? new Pool({ connectionString: env.SUPABASE_DEV_DB_URL, max: 1 }) : (null as never);
  const admin = enabled
    ? createClient(env.SUPABASE_DEV_URL!, env.SUPABASE_DEV_SECRET_KEY!, { auth: { persistSession: false } })
    : (null as never);
  let userId = "";

  const canExecute = async (role: string, fn: string) =>
    (await pool.query<{ ok: boolean }>("SELECT has_function_privilege($1, $2::regprocedure, 'execute') AS ok", [role, `public.${fn}`])).rows[0].ok;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `grants-${Date.now()}@zeta-dev.test`, password: crypto.randomUUID(), email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
    await pool.end();
  });

  it.each(SERVICE_ONLY)("%s: only service_role can execute", async (fn) => {
    expect(await canExecute("anon", fn)).toBe(false);
    expect(await canExecute("authenticated", fn)).toBe(false);
    expect(await canExecute("service_role", fn)).toBe(true);
  });

  it.each(SIGNED_IN_ONLY)("%s: signed-in users yes, anon no", async (fn) => {
    expect(await canExecute("anon", fn)).toBe(false);
    expect(await canExecute("authenticated", fn)).toBe(true);
  });

  it("a signed-in user can still create an account through the encrypted view", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE authenticated");
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
      await client.query(
        "INSERT INTO accounts (user_id, name, account_type, currency_code, mask) VALUES ($1, 'Cuenta grants', 'CHECKING', 'COP', '1234')",
        [userId],
      );
      const { rows } = await client.query("SELECT name, mask FROM accounts WHERE user_id = $1", [userId]);
      expect(rows).toEqual([{ name: "Cuenta grants", mask: "1234" }]);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("the email webhook's service key can still read masks", async () => {
    const { error } = await admin.rpc("get_accounts_with_masks", { p_user_id: userId });
    expect(error).toBeNull();
  });
});
