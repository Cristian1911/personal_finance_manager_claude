// Runs the shared engine against zeta-dev's REAL schema: encrypted views,
// INSTEAD OF triggers and RLS, as a signed-in user. Skipped without env:
//   set -a; source ../.env.v2-dev; set +a
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { applyCommand, createSqlStorage, readInicioData, toDialect } from "@zeta/shared";
import { createUserScopedPgDriver } from "../pg-driver";

const env = process.env;
const enabled = Boolean(env.SUPABASE_DEV_DB_URL && env.SUPABASE_DEV_URL && env.SUPABASE_DEV_SECRET_KEY);

// Remote DB (sa-east-1): each command is ~10 round trips, so allow more than the 5s default.
describe.skipIf(!enabled)("engine on zeta-dev (real Postgres)", { timeout: 90_000 }, () => {
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
    // Through the command, so the encrypted view's INSERT trigger accepts what Agregar sends.
    const created = await applyCommand(createSqlStorage(createUserScopedPgDriver(pool, userId)), {
      id: crypto.randomUUID(), type: "createAccount", userId, deviceId: "integration", clientTs: "2026-09-18T14:00:00.000Z",
      payload: { accountId, accountType: "CHECKING", name: "Cuenta motor", institutionName: "Bancolombia", mask: "4821", currencyCode: "COP", balance: 100000 },
    });
    if (created.status !== "applied") throw new Error(JSON.stringify(created));
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
    expect((await s.getAccount(userId, accountId))?.currentBalance).toBe(75000);
    expect((await s.getTransaction(userId, txId))?.cleanDescription).toBe("Tostao motor");
    // The capture instant is the command's, through the view's INSTEAD OF trigger.
    const [row] = await createUserScopedPgDriver(pool, userId).query<{ created_at: Date }>(
      toDialect("SELECT created_at FROM transactions WHERE id = ?", "postgres"), [txId]);
    expect(new Date(row.created_at).toISOString()).toBe("2026-09-18T15:00:00.000Z");

    // Inicio's reads work on the real views too.
    const data = await readInicioData(createUserScopedPgDriver(pool, userId), userId, "2026-09-01");
    expect(data.transactions.find((t) => t.id === txId)).toMatchObject({ date: "2026-09-18", amount: 25000, createdAt: "2026-09-18T15:00:00.000Z" });
    expect(data.accounts.find((a) => a.id === accountId)).toMatchObject({ accountType: "CHECKING", countsInDisponible: null });

    const newer = { ...base, id: crypto.randomUUID(), type: "setTransactionNote" as const, clientTs: "2026-09-18T17:00:00.000Z", payload: { transactionId: txId, notes: "nueva" } };
    const older = { ...base, id: crypto.randomUUID(), type: "setTransactionNote" as const, clientTs: "2026-09-18T16:00:00.000Z", payload: { transactionId: txId, notes: "vieja" } };
    expect((await applyCommand(s, newer)).status).toBe("applied");
    expect((await applyCommand(s, older)).status).toBe("superseded");
    expect((await s.getTransaction(userId, txId))?.notes).toBe("nueva");

    // Ignorar (Detalle): through the view's INSTEAD OF UPDATE trigger, latest choice wins.
    const ignore = (clientTs: string, excluded: boolean) => ({
      ...base, id: crypto.randomUUID(), type: "setTransactionExcluded" as const, clientTs, payload: { transactionId: txId, excluded },
    });
    const counted = (await s.getAccount(userId, accountId))!.currentBalance;
    expect((await applyCommand(s, ignore("2026-09-18T17:00:00.000Z", true))).status).toBe("applied");
    // Like the web's toggleExclude: an ignored movement leaves its account's balance.
    expect((await s.getAccount(userId, accountId))!.currentBalance).toBe(counted + 25000);
    expect((await applyCommand(s, ignore("2026-09-18T16:00:00.000Z", false))).status).toBe("superseded");
    const after = await readInicioData(createUserScopedPgDriver(pool, userId), userId, "2026-09-01");
    expect(after.transactions.find((t) => t.id === txId)).toMatchObject({ isExcluded: true, notes: "nueva", amount: 25000 });

    // Fix and delete a manual entry through the real view's INSTEAD OF triggers.
    const fix = { ...base, id: crypto.randomUUID(), type: "editTransaction" as const, clientTs: "2026-09-18T18:00:00.000Z", payload: { transactionId: txId, amount: 30000, date: "2026-09-17" } };
    expect((await applyCommand(s, fix)).status).toBe("applied");
    expect(await s.getTransaction(userId, txId)).toMatchObject({ amount: 30000, transactionDate: "2026-09-17", captureMethod: "MANUAL_FORM" });
    const before = (await s.getAccount(userId, accountId))!.currentBalance;
    const gone = { ...base, id: crypto.randomUUID(), type: "deleteTransaction" as const, clientTs: "2026-09-18T18:30:00.000Z", payload: { transactionId: txId } };
    expect((await applyCommand(s, gone)).status).toBe("applied");
    expect(await s.getTransaction(userId, txId)).toBeNull();
    // It was ignored: its amount already left the balance, so deleting it refunds nothing.
    expect((await s.getAccount(userId, accountId))!.currentBalance).toBe(before);
  });

  it("keeps both balance changes when two captures on one account run at the same time", async () => {
    const s = createSqlStorage(createUserScopedPgDriver(pool, userId));
    const before = (await s.getAccount(userId, accountId))!.currentBalance;
    const capture = (amount: number) => ({
      id: crypto.randomUUID(), type: "captureManualTransaction" as const, userId, deviceId: "integration",
      clientTs: "2026-09-18T18:00:00.000Z",
      payload: { transactionId: crypto.randomUUID(), accountId, amount, direction: "OUTFLOW" as const, currencyCode: "COP", date: "2026-09-18", description: `Concurrente ${amount}` },
    });
    const results = await Promise.all([applyCommand(s, capture(1000)), applyCommand(s, capture(2000))]);
    expect(results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect((await s.getAccount(userId, accountId))?.currentBalance).toBe(before - 3000);
  });

  it("saves cycle and account settings through RLS, latest edit per field", async () => {
    const s = createSqlStorage(createUserScopedPgDriver(pool, userId));
    const base = { userId, deviceId: "integration", type: "setCycleSettings" as const };
    const r = await applyCommand(s, {
      ...base, id: crypto.randomUUID(), clientTs: "2026-09-30T15:00:00.000Z",
      payload: { schedule: { kind: "semimonthly", paydays: [15, 30] }, incomePerCycle: 2100000, balanceAnchor: 1000000 },
    });
    expect(r.status).toBe("applied");
    const late = await applyCommand(s, { ...base, id: crypto.randomUUID(), clientTs: "2026-09-30T14:00:00.000Z", payload: { incomePerCycle: 1 } });
    expect(late.status).toBe("superseded");
    expect(await s.getCycleSettings(userId)).toEqual({
      schedule: { kind: "semimonthly", paydays: [15, 30] }, incomePerCycle: 2100000, savingsPerCycle: 0,
      balanceAnchor: { balance: 1000000, at: "2026-09-30T15:00:00.000Z" }, bigPurchaseThreshold: 300000,
    });

    const counts = await applyCommand(s, {
      userId, deviceId: "integration", id: crypto.randomUUID(), type: "setAccountCountsInDisponible",
      clientTs: "2026-09-30T15:00:00.000Z", payload: { accountId, counts: false },
    });
    expect(counts.status).toBe("applied");
    expect(await s.getAccountSetting(userId, accountId)).toEqual({ countsInDisponible: false });
  });

  it("creates, edits and archives an account through the encrypted view", async () => {
    const s = createSqlStorage(createUserScopedPgDriver(pool, userId));
    expect(await s.getAccount(userId, accountId)).toMatchObject({ name: "Cuenta motor", institutionName: "Bancolombia", mask: "4821", isActive: true });
    const card = crypto.randomUUID();
    const base = { userId, deviceId: "integration" };
    expect((await applyCommand(s, {
      ...base, id: crypto.randomUUID(), type: "createAccount", clientTs: "2026-10-02T15:00:00.000Z",
      payload: { accountId: card, accountType: "CREDIT_CARD", name: "Tarjeta Nu", mask: "4398", currencyCode: "COP", balance: 480000, creditLimit: 3000000, cutoffDay: 27, paymentDay: 12 },
    })).status).toBe("applied");
    expect((await applyCommand(s, {
      ...base, id: crypto.randomUUID(), type: "editAccount", clientTs: "2026-10-02T16:00:00.000Z",
      payload: { accountId: card, name: "Nu", paymentDay: 15 },
    })).status).toBe("applied");
    expect(await s.getAccount(userId, card)).toMatchObject({ name: "Nu", mask: "4398", currentBalance: 480000, creditLimit: 3000000, cutoffDay: 27, paymentDay: 15 });
    // A card purchase raises what you owe.
    await applyCommand(s, {
      ...base, id: crypto.randomUUID(), type: "captureManualTransaction", clientTs: "2026-10-02T16:30:00.000Z",
      payload: { transactionId: crypto.randomUUID(), accountId: card, amount: 20000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-10-02", description: "Compra tarjeta" },
    });
    expect((await s.getAccount(userId, card))?.currentBalance).toBe(500000);
    expect((await applyCommand(s, {
      ...base, id: crypto.randomUUID(), type: "archiveAccount", clientTs: "2026-10-02T17:00:00.000Z", payload: { accountId: card, archived: true },
    })).status).toBe("applied");
    const data = await readInicioData(createUserScopedPgDriver(pool, userId), userId, "2026-09-01");
    expect(data.accounts.map((a) => a.id)).not.toContain(card);
    // Name and last digits are stored encrypted.
    const [raw] = await pool.query("SELECT name, mask FROM accounts_enc WHERE id = $1", [card]).then((r) => r.rows as { name: Buffer; mask: Buffer }[]);
    expect(Buffer.from(raw.mask).toString("utf8")).not.toContain("4398");
    expect(raw.name.length).toBeGreaterThan(20);
  });

  it("Anotar: an income with its flow class, and paying a card through the real view", async () => {
    const s = createSqlStorage(createUserScopedPgDriver(pool, userId));
    const base = { userId, deviceId: "integration" };
    const card = crypto.randomUUID();
    await applyCommand(s, {
      ...base, id: crypto.randomUUID(), type: "createAccount", clientTs: "2026-10-02T18:00:00.000Z",
      payload: { accountId: card, accountType: "CREDIT_CARD", name: "Tarjeta pago", currencyCode: "COP", balance: 500000 },
    });
    const income = crypto.randomUUID();
    expect((await applyCommand(s, {
      ...base, id: crypto.randomUUID(), type: "captureManualTransaction", clientTs: "2026-10-02T18:05:00.000Z",
      payload: { transactionId: income, accountId, amount: 300000, direction: "INFLOW", currencyCode: "COP", date: "2026-10-02", description: "Ingreso extra", flowClass: "INCOME" },
    })).status).toBe("applied");
    const debitBefore = (await s.getAccount(userId, accountId))!.currentBalance;
    const out = crypto.randomUUID();
    const group = crypto.randomUUID();
    const paid = await applyCommand(s, {
      ...base, id: crypto.randomUUID(), type: "captureTransfer", clientTs: "2026-10-02T18:10:00.000Z",
      payload: { transferGroupId: group, fromTransactionId: out, toTransactionId: crypto.randomUUID(), fromAccountId: accountId, toAccountId: card, amount: 200000, currencyCode: "COP", date: "2026-10-02" },
    });
    expect(paid.status).toBe("applied");
    expect((await s.getAccount(userId, card))?.currentBalance).toBe(300000);
    expect((await s.getAccount(userId, accountId))?.currentBalance).toBe(debitBefore - 200000);
    const rows = (await readInicioData(createUserScopedPgDriver(pool, userId), userId, "2026-09-01")).transactions;
    expect(rows.find((t) => t.id === income)?.flowClass).toBe("INCOME");
    expect(rows.filter((t) => t.transferGroupId === group).map((t) => t.flowClass).sort()).toEqual(["DEBT_CREDIT", "DEBT_PAYMENT"]);
    // Deshacer: deleting one leg removes both and restores both balances.
    expect((await applyCommand(s, { ...base, id: crypto.randomUUID(), type: "deleteTransaction", clientTs: "2026-10-02T18:11:00.000Z", payload: { transactionId: out } })).status).toBe("applied");
    expect((await s.getAccount(userId, card))?.currentBalance).toBe(500000);
    expect((await s.getAccount(userId, accountId))?.currentBalance).toBe(debitBefore);
  });

  it("Pagos: a fixed payment through the encrypted view, detected and merged with the server's own occurrence", async () => {
    const s = createSqlStorage(createUserScopedPgDriver(pool, userId));
    const base = { userId, deviceId: "integration" };
    const today = new Date().toISOString().slice(0, 10);
    const day = 15;
    const due = `${today.slice(0, 8)}${day}`;
    const template = crypto.randomUUID();
    expect((await applyCommand(s, {
      ...base, id: crypto.randomUUID(), type: "createPagoFijo", clientTs: new Date().toISOString(),
      payload: { templateId: template, name: "Internet prueba", amount: 99900, dayOfMonth: day, accountId, startDate: due },
    })).status).toBe("applied");
    // The server's trigger generated this month's occurrence on its own.
    const generated = await pool.query("SELECT id, status FROM recurring_occurrences WHERE template_id = $1 AND occurrence_date = $2", [template, due]);
    expect(generated.rows).toHaveLength(1);
    const pay = crypto.randomUUID();
    await applyCommand(s, {
      ...base, id: crypto.randomUUID(), type: "captureManualTransaction", clientTs: new Date().toISOString(),
      payload: { transactionId: pay, accountId, amount: 99900, direction: "OUTFLOW", currencyCode: "COP", date: due, description: "Pago internet" },
    });
    // Detection updated the server's row (same id), it didn't add a second one.
    const after = await pool.query("SELECT id, status, transaction_id FROM recurring_occurrences WHERE template_id = $1", [template]);
    const row = after.rows.find((r: { id: string }) => r.id === generated.rows[0].id);
    expect(row).toMatchObject({ status: "paid", transaction_id: pay });
    expect(after.rows.filter((r: { status: string }) => r.status === "paid")).toHaveLength(1);
    // The name is stored encrypted, and reads back through the view.
    const [raw] = (await pool.query("SELECT merchant_name FROM recurring_transaction_templates_enc WHERE id = $1", [template])).rows;
    expect(Buffer.from(raw.merchant_name).toString("utf8")).not.toContain("Internet prueba");
    expect((await s.getTemplate(userId, template))?.name).toBe("Internet prueba");
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
