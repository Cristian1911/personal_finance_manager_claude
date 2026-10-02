// A parsed statement into v2 on zeta-dev. Skipped without env:
//   set -a; source ../.env.v2-dev; set +a
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { applyCommand, createSqlStorage } from "@zeta/shared";
import type { ParsedStatement, ParsedTransaction } from "@/types/import";
import { createUserScopedPgDriver } from "../pg-driver";

vi.mock("server-only", () => ({}));

const env = process.env;
const enabled = Boolean(env.SUPABASE_DEV_DB_URL && env.SUPABASE_DEV_URL && env.SUPABASE_DEV_SECRET_KEY);

const tx = (date: string, amount: number, description: string, over: Partial<ParsedTransaction> = {}): ParsedTransaction => ({
  date, description, amount, direction: "OUTFLOW", balance: null, currency: "COP", authorization_number: null,
  installment_current: null, installment_total: null, original_amount: null, ...over,
});
const statement = (over: Partial<ParsedStatement>): ParsedStatement => ({
  bank: "BANCOLOMBIA", statement_type: "savings", account_number: "000-123-4821", card_last_four: null,
  period_from: "2026-09-01", period_to: "2026-09-30", currency: "COP",
  summary: { previous_balance: 800_000, total_credits: 0, total_debits: 300_000, final_balance: 500_000, purchases_and_charges: null, interest_charged: null },
  credit_card_metadata: null, loan_metadata: null, transactions: [], ...over,
});

describe.skipIf(!enabled)("v2 statement import on zeta-dev", { timeout: 120_000 }, () => {
  const admin = enabled ? createClient(env.SUPABASE_DEV_URL!, env.SUPABASE_DEV_SECRET_KEY!, { auth: { persistSession: false } }) : (null as never);
  const pool = enabled ? new Pool({ connectionString: env.SUPABASE_DEV_DB_URL, max: 2 }) : (null as never);
  let userId = "";
  let mod: typeof import("../v2-statement");
  const savings = crypto.randomUUID();
  const card = crypto.randomUUID();
  const run = (type: string, payload: unknown) => applyCommand(createSqlStorage(createUserScopedPgDriver(pool, userId)), {
    id: crypto.randomUUID(), type: type as never, userId, deviceId: "test", clientTs: new Date().toISOString(), payload,
  });
  const balance = async (id: string) => Number((await pool.query("SELECT current_balance FROM accounts_enc WHERE id = $1", [id])).rows[0].current_balance);

  const savingsStatement = statement({ transactions: [
    tx("2026-09-05", 120_000, "PAGO ARRIENDO TRANSFERENCIA"),
    tx("2026-09-12", 90_000, "TRANSFERENCIA A NEQUI 3001234567"),
    tx("2026-09-12", 90_000, "TRANSFERENCIA A NEQUI 3001234567"),
  ] });
  const cardStatement = statement({
    statement_type: "credit_card", account_number: null, card_last_four: "7706",
    summary: { previous_balance: 0, total_credits: 0, total_debits: 0, final_balance: 260_000, purchases_and_charges: null, interest_charged: null },
    credit_card_metadata: { credit_limit: 3_000_000, available_credit: null, interest_rate: null, late_interest_rate: null, total_payment_due: 260_000, minimum_payment: 60_000, payment_due_date: "2026-10-12" },
    transactions: [tx("2026-09-18", 100_000, "TIENDA X", { original_amount: 300_000, installment_current: 1, installment_total: 3 }), tx("2026-09-20", 160_000, "RESTAURANTE")],
  });

  beforeAll(async () => {
    mod = await import("../v2-statement");
    const { data, error } = await admin.auth.admin.createUser({ email: `pdf-${Date.now()}@zeta-dev.test`, password: crypto.randomUUID(), email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
    await run("createAccount", { accountId: savings, accountType: "SAVINGS", name: "Bancolombia", mask: "4821", currencyCode: "COP", balance: 1_000_000 });
    // Anotado by hand, the same arriendo the statement lists.
    await run("captureManualTransaction", { transactionId: crypto.randomUUID(), accountId: savings, amount: 120_000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-05", description: "Pago arriendo" });
    // After the statement's cut: stays on top of its final balance.
    await run("captureManualTransaction", { transactionId: crypto.randomUUID(), accountId: savings, amount: 30_000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-10-01", description: "Mercado" });
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
    await pool.end();
  });

  it("matches a known account by its last 4 and asks about an unknown card (D1)", async () => {
    const plans = await mod.planStatements(pool, userId, [savingsStatement, cardStatement]);
    expect(plans[0]).toMatchObject({ accountId: savings, last4: "4821" });
    expect(plans[1]).toMatchObject({ accountId: null, last4: "7706", suggested: { name: "Bancolombia tarjeta ••7706", accountType: "CREDIT_CARD" } });
  });

  const usdSection = { ...cardStatement, currency: "USD", transactions: [tx("2026-09-21", 12.5, "NETFLIX", { currency: "USD" })],
    summary: { ...cardStatement.summary!, final_balance: 12.5 } };

  it("imports: merges what you anotaste, keeps identical rows apart; creates the card from its statement", async () => {
    const results = await mod.importStatements(pool, userId, [savingsStatement, cardStatement, usdSection],
      [{ index: 1, create: { accountId: card, name: "Bancolombia tarjeta ••7706" } }]);
    // The balance told today already holds September: no per-row moves, no re-anchor (1.000.000 − arriendo − mercado).
    expect(results[0]).toMatchObject({ nuevos: 3, yaEstaban: 0, balance: null });
    expect(await balance(savings)).toBe(850_000);
    // A card created from its statement takes the statement's balance at the cut.
    expect(results[1]).toMatchObject({ created: true, nuevos: 2, balance: 260_000 });
    const { rows: [c] } = await pool.query("SELECT id, cutoff_day, payment_day FROM accounts_enc WHERE user_id = $1 AND account_type = 'CREDIT_CARD'", [userId]);
    expect(c).toMatchObject({ cutoff_day: 30, payment_day: 12 });
    expect(await balance(c.id)).toBe(260_000); // the USD section didn't touch it
    expect(results[2]).toMatchObject({ nuevos: 0, nota: expect.stringContaining("USD") });
    // One movement for the arriendo: the hand-written one is merged into the statement's.
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM transactions_enc WHERE user_id = $1 AND account_id = $2 AND reconciled_into_transaction_id IS NULL", [userId, savings]);
    expect(rows[0].n).toBe(4); // arriendo, 2 transfers, mercado
  });

  it("the same PDF again changes nothing", async () => {
    const results = await mod.importStatements(pool, userId, [savingsStatement, cardStatement], [{ index: 1, create: { accountId: crypto.randomUUID(), name: "x" } }]);
    expect(results.map((r) => [r.created, r.nuevos, r.yaEstaban])).toEqual([[false, 0, 3], [false, 0, 2]]);
    expect(await balance(savings)).toBe(850_000);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM accounts_enc WHERE user_id = $1 AND account_type = 'CREDIT_CARD'", [userId]);
    expect(rows[0].n).toBe(1); // a retry with a new id never makes a second card
  });
});
