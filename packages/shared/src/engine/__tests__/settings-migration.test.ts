// Runs the real Supabase migration for the v2 settings tables on PGlite, with
// minimal stand-ins for Supabase's auth schema and the existing tables it
// references (own-row RLS like production), then checks its constraints and
// RLS as the `authenticated` role, including the engine's own upsert SQL.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createSqlStorage } from "../sql-storage";
import type { SqlDriver } from "../types";

const MIGRATION = fileURLToPath(
  new URL("../../../../../supabase/migrations/20260930160000_v2_settings_tables.sql", import.meta.url),
);

const ME = "11111111-1111-4111-8111-111111111111";
const THEM = "66666666-6666-4666-8666-666666666666";
const GONE = "77777777-7777-4777-8777-777777777777";
const MY_ACCOUNT = "22222222-2222-4222-8222-222222222222";
const MY_OTHER_ACCOUNT = "22222222-2222-4222-8222-000000000002";
const THEIR_ACCOUNT = "33333333-3333-4333-8333-333333333333";
const MY_TEMPLATE = "55555555-5555-4555-8555-555555555555";
const MY_OTHER_TEMPLATE = "55555555-5555-4555-8555-000000000002";
const THEIR_TEMPLATE = "44444444-4444-4444-8444-444444444444";
const MY_OCCURRENCE = "88888888-8888-4888-8888-888888888888";
const THEIR_OCCURRENCE = "99999999-9999-4999-8999-999999999999";
const RESERVATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const ownRls = (table: string) => `
ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
CREATE POLICY own ON ${table} FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO authenticated;`;

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text, app_purpose text, avatar_url text, budget_mode text,
  estimated_monthly_income numeric, estimated_monthly_expenses numeric, monthly_salary numeric,
  preferred_currency text, timezone text, locale text, onboarding_completed boolean,
  dashboard_config jsonb, mobile_dashboard_config jsonb, updated_at timestamptz);
CREATE TABLE public.accounts_enc (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE public.recurring_transaction_templates_enc (id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.recurring_occurrences (
  id uuid PRIMARY KEY, user_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.recurring_transaction_templates_enc(id) ON DELETE CASCADE);
CREATE TABLE public.field_versions (user_id uuid NOT NULL, entity text, entity_id uuid, field text);
${ownRls("public.accounts_enc")}
${ownRls("public.recurring_transaction_templates_enc")}
${ownRls("public.recurring_occurrences")}
INSERT INTO auth.users VALUES ('${ME}'), ('${THEM}'), ('${GONE}');
INSERT INTO public.profiles (id) VALUES ('${ME}'), ('${THEM}');
INSERT INTO public.accounts_enc VALUES ('${MY_ACCOUNT}', '${ME}'), ('${MY_OTHER_ACCOUNT}', '${ME}'), ('${THEIR_ACCOUNT}', '${THEM}');
INSERT INTO public.recurring_transaction_templates_enc VALUES
  ('${MY_TEMPLATE}', '${ME}'), ('${MY_OTHER_TEMPLATE}', '${ME}'), ('${THEIR_TEMPLATE}', '${THEM}');
INSERT INTO public.recurring_occurrences VALUES
  ('${MY_OCCURRENCE}', '${ME}', '${MY_TEMPLATE}'), ('${THEIR_OCCURRENCE}', '${THEM}', '${THEIR_TEMPLATE}');
`;

describe("migration 20260930160000_v2_settings_tables", () => {
  let db: PGlite;
  /** Runs `sql` as the signed-in user `uid` (like PostgREST and the engine's user-scoped driver). */
  const as = async (uid: string, sql: string, params: unknown[] = []) =>
    db.transaction(async (tx) => {
      await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid]);
      await tx.query("SET LOCAL ROLE authenticated");
      return tx.query(sql, params);
    });
  /** The engine's storage, each statement as `uid`. */
  const storageAs = (uid: string) => {
    const driver: SqlDriver = {
      dialect: "postgres",
      query: async (sql, params) => (await as(uid, sql, params)).rows as never,
      transaction: (fn) => fn(driver),
    };
    return createSqlStorage(driver);
  };

  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(STUBS);
    await db.exec(readFileSync(MIGRATION, "utf8"));
  }, 30_000);

  it("the engine's upsert SQL inserts, then updates, as the user", async () => {
    const s = storageAs(ME);
    await s.upsertCycleSettings(ME, { schedule: { kind: "semimonthly", paydays: [15, 30] }, incomePerCycle: 2_100_000 });
    await s.upsertCycleSettings(ME, { savingsPerCycle: 200_000, balanceAnchor: { balance: 1_000_000, at: "2026-09-18T14:00:00.000Z" } });
    expect(await s.getCycleSettings(ME)).toEqual({
      schedule: { kind: "semimonthly", paydays: [15, 30] }, incomePerCycle: 2_100_000, savingsPerCycle: 200_000,
      balanceAnchor: { balance: 1_000_000, at: "2026-09-18T14:00:00.000Z" }, bigPurchaseThreshold: 300_000,
    });
    await s.setAccountSetting(ME, MY_ACCOUNT, false);
    await s.setAccountSetting(ME, MY_ACCOUNT, true);
    expect(await s.getAccountSetting(ME, MY_ACCOUNT)).toEqual({ countsInDisponible: true });
    expect(await storageAs(THEM).getCycleSettings(ME)).toBeNull();
  });

  it("a user can't write another user's settings row", async () => {
    await expect(as(THEM, `INSERT INTO user_cycle_settings (user_id) VALUES ('${ME}')`)).rejects.toThrow(/row-level security/);
    await as(THEM, `UPDATE user_cycle_settings SET income_per_cycle = 1 WHERE user_id = '${ME}'`);
    expect((await storageAs(ME).getCycleSettings(ME))?.incomePerCycle).toBe(2_100_000);
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

  it("account settings only for the user's own accounts, on insert and on update", async () => {
    const insert = (account: string) =>
      as(ME, `INSERT INTO account_settings (user_id, account_id, counts_in_disponible) VALUES ('${ME}', '${account}', true)`);
    await expect(insert(THEIR_ACCOUNT)).rejects.toThrow(/row-level security/);
    // A made-up id fails the same way (RLS runs before the foreign key): nothing to learn about other users.
    await expect(insert("12345678-1234-4234-8234-123456789012")).rejects.toThrow(/row-level security/);
    await expect(as(ME, `UPDATE account_settings SET account_id = '${THEIR_ACCOUNT}' WHERE account_id = '${MY_ACCOUNT}'`))
      .rejects.toThrow(/row-level security/);
    expect((await as(THEM, "SELECT * FROM account_settings")).rows).toHaveLength(0);
  });

  it("reservations only for the user's own bills, with a matching occurrence", async () => {
    const insert = (template: string, occurrence: string | null) =>
      as(ME, `INSERT INTO bill_reservations (id, user_id, recurring_template_id, occurrence_id, amount_per_cycle, starts_on)
              VALUES (gen_random_uuid(), '${ME}', '${template}', ${occurrence ? `'${occurrence}'` : "NULL"}, 150000, '2026-09-15')`);
    await expect(insert(THEIR_TEMPLATE, null)).rejects.toThrow(/row-level security/);
    await expect(insert(MY_TEMPLATE, THEIR_OCCURRENCE)).rejects.toThrow(/row-level security/);
    await expect(insert(MY_OTHER_TEMPLATE, MY_OCCURRENCE)).rejects.toThrow(/row-level security/);
    await as(ME, `INSERT INTO bill_reservations (id, user_id, recurring_template_id, occurrence_id, amount_per_cycle, starts_on)
                  VALUES ('${RESERVATION}', '${ME}', '${MY_TEMPLATE}', '${MY_OCCURRENCE}', 150000, '2026-09-15')`);
    await expect(as(ME, `UPDATE bill_reservations SET recurring_template_id = '${THEIR_TEMPLATE}', occurrence_id = NULL WHERE id = '${RESERVATION}'`))
      .rejects.toThrow(/row-level security/);
  });

  it("a reservation survives its occurrence being regenerated (template edit)", async () => {
    await db.query(`DELETE FROM public.recurring_occurrences WHERE id = '${MY_OCCURRENCE}'`);
    const r = (await as(ME, `SELECT occurrence_id FROM bill_reservations WHERE id = '${RESERVATION}'`)).rows as { occurrence_id: string | null }[];
    expect(r).toEqual([{ occurrence_id: null }]);
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
    await storageAs(ME).setAccountSetting(ME, MY_OTHER_ACCOUNT, false);
    await db.query(`DELETE FROM public.accounts_enc WHERE id = '${MY_OTHER_ACCOUNT}'`);
    expect((await db.query(`SELECT * FROM account_settings WHERE account_id = '${MY_OTHER_ACCOUNT}'`)).rows).toHaveLength(0);
  });

  it("deleting a user removes all their v2 settings", async () => {
    await db.query(`INSERT INTO user_cycle_settings (user_id, income_per_cycle) VALUES ('${GONE}', 1)`);
    await db.query(`DELETE FROM auth.users WHERE id = '${GONE}'`);
    expect((await db.query(`SELECT * FROM user_cycle_settings WHERE user_id = '${GONE}'`)).rows).toHaveLength(0);
  });

  it("'Borrar mis datos' (reset_user_data) clears the v2 settings and their edit versions", async () => {
    await db.query(`INSERT INTO public.field_versions VALUES ('${ME}', 'cycle_settings', '${ME}', 'incomePerCycle')`);
    await storageAs(ME).setAccountSetting(ME, MY_ACCOUNT, false);
    await as(ME, "SELECT public.reset_user_data()");
    for (const t of ["user_cycle_settings", "account_settings", "bill_reservations", "field_versions"]) {
      expect((await db.query(`SELECT * FROM public.${t} WHERE user_id = '${ME}'`)).rows, t).toHaveLength(0);
    }
    expect((await db.query(`SELECT * FROM user_cycle_settings`)).rows).toHaveLength(0);
  });
});
