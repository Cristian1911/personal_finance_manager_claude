// Runs the real Supabase migration for the v2 settings tables on PGlite, with
// minimal stand-ins for Supabase's auth schema and the existing tables it
// references, then checks its constraints and RLS as the `authenticated` role.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATION = fileURLToPath(
  new URL("../../../../../supabase/migrations/20260930160000_v2_settings_tables.sql", import.meta.url),
);

const ME = "11111111-1111-4111-8111-111111111111";
const THEM = "66666666-6666-4666-8666-666666666666";
const MY_ACCOUNT = "22222222-2222-4222-8222-222222222222";
const THEIR_ACCOUNT = "33333333-3333-4333-8333-333333333333";
const THEIR_TEMPLATE = "44444444-4444-4444-8444-444444444444";
const MY_TEMPLATE = "55555555-5555-4555-8555-555555555555";

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.accounts_enc (id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.recurring_transaction_templates_enc (id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.recurring_occurrences (id uuid PRIMARY KEY, user_id uuid NOT NULL);
GRANT SELECT ON public.accounts_enc, public.recurring_transaction_templates_enc, public.recurring_occurrences TO authenticated;
INSERT INTO auth.users VALUES ('${ME}'), ('${THEM}');
INSERT INTO public.accounts_enc VALUES ('${MY_ACCOUNT}', '${ME}'), ('${THEIR_ACCOUNT}', '${THEM}');
INSERT INTO public.recurring_transaction_templates_enc VALUES ('${MY_TEMPLATE}', '${ME}'), ('${THEIR_TEMPLATE}', '${THEM}');
`;

describe("migration 20260930160000_v2_settings_tables", () => {
  let db: PGlite;
  /** Runs `sql` as the signed-in user `uid` (like PostgREST does). */
  const as = async (uid: string, sql: string) =>
    db.transaction(async (tx) => {
      await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid]);
      await tx.query("SET LOCAL ROLE authenticated");
      return tx.query(sql);
    });

  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(STUBS);
    await db.exec(readFileSync(MIGRATION, "utf8"));
  }, 30_000);

  it("a user saves and reads only their own cycle settings", async () => {
    await as(ME, `INSERT INTO user_cycle_settings (user_id, schedule_kind, payday_1, payday_2, income_per_cycle)
                  VALUES ('${ME}', 'semimonthly', 15, 30, 2100000)`);
    expect((await as(ME, "SELECT user_id FROM user_cycle_settings")).rows).toHaveLength(1);
    expect((await as(THEM, "SELECT user_id FROM user_cycle_settings")).rows).toHaveLength(0);
    await expect(as(THEM, `INSERT INTO user_cycle_settings (user_id) VALUES ('${ME}')`)).rejects.toThrow(/row-level security/);
  });

  it.each([
    ["semimonthly with the paydays reversed", "schedule_kind, payday_1, payday_2", "'semimonthly', 30, 15"],
    ["monthly with a second payday", "schedule_kind, payday_1, payday_2", "'monthly', 1, 15"],
    ["biweekly without its anchor", "schedule_kind", "'biweekly'"],
    ["a balance without its time", "balance_anchor", "100"],
    ["a payday 32", "schedule_kind, payday_1", "'monthly', 32"],
  ])("rejects %s", async (_label, cols, vals) => {
    await expect(as(THEM, `INSERT INTO user_cycle_settings (user_id, ${cols}) VALUES ('${THEM}', ${vals})`)).rejects.toThrow(/check constraint/);
  });

  it("account settings only for the user's own accounts", async () => {
    await as(ME, `INSERT INTO account_settings (user_id, account_id, counts_in_disponible) VALUES ('${ME}', '${MY_ACCOUNT}', false)`);
    await expect(
      as(ME, `INSERT INTO account_settings (user_id, account_id, counts_in_disponible) VALUES ('${ME}', '${THEIR_ACCOUNT}', true)`),
    ).rejects.toThrow(/row-level security/);
    expect((await as(THEM, "SELECT * FROM account_settings")).rows).toHaveLength(0);
  });

  it("reservations only for the user's own bills, and they need a bill", async () => {
    await as(ME, `INSERT INTO bill_reservations (id, user_id, recurring_template_id, amount_per_cycle, starts_on)
                  VALUES (gen_random_uuid(), '${ME}', '${MY_TEMPLATE}', 150000, '2026-09-15')`);
    await expect(as(ME, `INSERT INTO bill_reservations (id, user_id, recurring_template_id, amount_per_cycle, starts_on)
                  VALUES (gen_random_uuid(), '${ME}', '${THEIR_TEMPLATE}', 150000, '2026-09-15')`)).rejects.toThrow(/row-level security/);
    await expect(as(ME, `INSERT INTO bill_reservations (id, user_id, amount_per_cycle, starts_on)
                  VALUES (gen_random_uuid(), '${ME}', 150000, '2026-09-15')`)).rejects.toThrow(/check constraint/);
  });

  it("anon has no access and nobody can delete or truncate", async () => {
    await expect(db.transaction(async (tx) => {
      await tx.query("SET LOCAL ROLE anon");
      return tx.query("SELECT * FROM user_cycle_settings");
    })).rejects.toThrow(/permission denied/);
    await expect(as(ME, "DELETE FROM account_settings")).rejects.toThrow(/permission denied/);
    await expect(as(ME, "TRUNCATE bill_reservations")).rejects.toThrow(/permission denied/);
  });

  it("deleting an account removes its setting", async () => {
    await db.query(`DELETE FROM public.accounts_enc WHERE id = '${MY_ACCOUNT}'`);
    expect((await db.query(`SELECT * FROM account_settings WHERE account_id = '${MY_ACCOUNT}'`)).rows).toHaveLength(0);
  });
});
