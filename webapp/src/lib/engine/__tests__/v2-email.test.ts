// A forwarded Bancolombia alert into v2 on zeta-dev, end to end. Skipped without env:
//   set -a; source ../.env.v2-dev; set +a
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { applyCommand, createSqlStorage, toDialect } from "@zeta/shared";
import { createUserScopedPgDriver } from "../pg-driver";

vi.mock("server-only", () => ({}));

const env = process.env;
const enabled = Boolean(env.SUPABASE_DEV_DB_URL && env.SUPABASE_DEV_URL && env.SUPABASE_DEV_SECRET_KEY);
const BANK = "Bancolombia <alertasynotificaciones@an.notificacionesbancolombia.com>";
const ALERT = "Bancolombia: Compraste $22.000,00 en DUNKIN DONUTS con tu T.Deb *0735, el 26/03/2026 a las 14:11. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.";

describe.skipIf(!enabled)("v2 bank email on zeta-dev", { timeout: 90_000 }, () => {
  const admin = enabled ? createClient(env.SUPABASE_DEV_URL!, env.SUPABASE_DEV_SECRET_KEY!, { auth: { persistSession: false } }) : (null as never);
  const pool = enabled ? new Pool({ connectionString: env.SUPABASE_DEV_DB_URL, max: 2 }) : (null as never);
  let userId = "";
  let process: typeof import("../v2-email").processV2Email;
  const accountId = crypto.randomUUID();
  const key = `u_t${Date.now().toString(36)}`.slice(0, 10);
  const to = [`${key}@ingest.test`];
  let seq = 0;
  const run = (type: string, payload: unknown, clientTs = new Date(Date.now() + ++seq * 1000).toISOString()) => applyCommand(createSqlStorage(createUserScopedPgDriver(pool, userId)), {
    id: crypto.randomUUID(), type: type as never, userId, deviceId: "test", clientTs, payload,
  });
  const balance = async () => Number((await pool.query("SELECT current_balance FROM accounts_enc WHERE id = $1", [accountId])).rows[0].current_balance);

  beforeAll(async () => {
    ({ processV2Email: process } = await import("../v2-email"));
    const { data, error } = await admin.auth.admin.createUser({ email: `email-${Date.now()}@zeta-dev.test`, password: crypto.randomUUID(), email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
    expect((await run("createAccount", { accountId, accountType: "SAVINGS", name: "Bancolombia", mask: "0735", currencyCode: "COP", balance: 500_000 }, "2026-03-01T12:00:00.000Z")).status).toBe("applied"); // told on March 1: the alerts come after
    await createUserScopedPgDriver(pool, userId).query(
      toDialect("INSERT INTO email_ingest_addresses (user_id, address_key, is_active, auto_import) VALUES (?, ?, ?, ?)", "postgres"), [userId, key, true, true]);
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
    await pool.end();
  });

  it("an alert for the card ending 0735 becomes a movement on that account; a redelivery doesn't", async () => {
    expect(await process(pool, { emailId: "e-1", from: BANK, to, text: ALERT, html: null })).toMatchObject({ outcome: "applied" });
    expect(await balance()).toBe(478_000);
    const { rows } = await pool.query("SELECT capture_method, transaction_time::text AS t, source_pattern FROM transactions_enc WHERE user_id = $1", [userId]);
    expect(rows).toEqual([{ capture_method: "EMAIL_IMPORT", t: "14:11:00", source_pattern: "compra_debito" }]);
    expect(await process(pool, { emailId: "e-1", from: BANK, to, text: ALERT, html: null })).toMatchObject({ outcome: "duplicate" });
    expect(await balance()).toBe(478_000);
  });

  it("what you anotaste (same amount and place) becomes the bank's movement, counted once", async () => {
    const mine = crypto.randomUUID();
    await run("captureManualTransaction", { transactionId: mine, accountId, amount: 9_000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-03-27", description: "Juan Valdez" });
    const alert = ALERT.replace("$22.000,00", "$9.000,00").replace("DUNKIN DONUTS", "JUAN VALDEZ").replace("26/03/2026", "27/03/2026");
    expect(await process(pool, { emailId: "e-2", from: BANK, to, text: alert, html: null })).toMatchObject({ outcome: "applied", result: { data: { mergedFrom: mine } } });
    expect(await balance()).toBe(469_000);
  });

  it("ignores other senders, unknown addresses and unknown cards", async () => {
    expect(await process(pool, { emailId: "e-3", from: "someone@gmail.com", to, text: ALERT, html: null })).toMatchObject({ outcome: "sender_rejected" });
    expect(await process(pool, { emailId: "e-4", from: BANK, to: ["nobody@ingest.test"], text: ALERT, html: null })).toMatchObject({ outcome: "no_address" });
    expect(await process(pool, { emailId: "e-5", from: BANK, to, text: ALERT.replace("*0735", "*9999"), html: null })).toMatchObject({ outcome: "unknown_account" });
  });

  it("logs what it couldn't capture (v1's statuses, for the template-drift replay)", async () => {
    const { rows } = await pool.query("SELECT status, error_message FROM email_ingest_logs WHERE user_id = $1 ORDER BY created_at", [userId]);
    expect(rows.map((r) => r.status)).toEqual(expect.arrayContaining(["imported", "duplicate", "sender_rejected", "parse_failed"]));
    expect(rows.find((r) => r.error_message?.includes("*9999"))).toBeTruthy();
  });

  it("keeps Gmail's forwarding confirmation link for the phone", async () => {
    const link = "https://mail.google.com/mail/vf-abc123";
    expect(await process(pool, { emailId: "e-6", from: "forwarding-noreply@google.com", to, text: `Confirma: ${link}`, html: null })).toMatchObject({ outcome: "gmail_verification" });
    const rows = await createUserScopedPgDriver(pool, userId).query<{ gmail_verification_url: string }>(
      toDialect("SELECT gmail_verification_url FROM email_ingest_addresses WHERE user_id = ?", "postgres"), [userId]);
    expect(rows[0].gmail_verification_url).toBe(link);
  });
});
