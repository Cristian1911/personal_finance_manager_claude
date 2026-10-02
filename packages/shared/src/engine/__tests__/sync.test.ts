import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { readInicioData } from "../inicio-read";
import { applySnapshot, readSnapshot } from "../sync";
import type { CommandEnvelope, CommandType } from "../types";
import { createPgliteDriver, createSqlJsDriver } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const DEBIT = "22222222-2222-4222-8222-222222222222";
const CARD = "33333333-3333-4333-8333-333333333333";
const RENT = "44444444-4444-4444-8444-444444444444";

let seq = 0;
const cmd = (type: CommandType, payload: unknown, userId = USER): CommandEnvelope => ({
  id: `f${String(++seq).padStart(7, "0")}-0000-4000-8000-000000000000`, type, userId, deviceId: "server", clientTs: "2026-10-02T15:00:00.000Z", payload,
});

async function serverWithData() {
  const pg = await createPgliteDriver();
  const s = createSqlStorage(pg);
  const run = async (c: CommandEnvelope) => {
    const r = await applyCommand(s, c);
    if (r.status !== "applied") throw new Error(`${c.type}: ${JSON.stringify(r)}`);
  };
  await run(cmd("setCycleSettings", { schedule: { kind: "semimonthly", paydays: [15, 30] }, incomePerCycle: 2_100_000, balanceAnchor: 1_500_000 }));
  await run(cmd("createAccount", { accountId: DEBIT, accountType: "SAVINGS", name: "Bancolombia", mask: "4821", currencyCode: "COP", balance: 1_500_000 }));
  await run(cmd("createAccount", { accountId: CARD, accountType: "CREDIT_CARD", name: "Tarjeta Nu", currencyCode: "COP", balance: 300_000, cutoffDay: 27, paymentDay: 12 }));
  await run(cmd("setAccountCountsInDisponible", { accountId: DEBIT, counts: true }));
  await run(cmd("createPagoFijo", { templateId: RENT, name: "Arriendo", amount: 500_000, dayOfMonth: 5, accountId: DEBIT, startDate: "2026-10-05" }));
  await run(cmd("captureManualTransaction", {
    transactionId: "55555555-5555-4555-8555-555555555555", accountId: DEBIT, amount: 500_000, direction: "OUTFLOW",
    currencyCode: "COP", date: "2026-10-05", description: "Pago arriendo", notes: "octubre",
  }));
  await run(cmd("captureTransfer", {
    transferGroupId: "66666666-6666-4666-8666-666666666666", fromTransactionId: "77777777-7777-4777-8777-777777777777",
    toTransactionId: "88888888-8888-4888-8888-888888888888", fromAccountId: DEBIT, toAccountId: CARD, amount: 100_000, currencyCode: "COP", date: "2026-10-06",
  }));
  // Someone else's data never travels.
  await run(cmd("createAccount", { accountId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", accountType: "CASH", name: "Ajeno", currencyCode: "COP", balance: 1 }, OTHER));
  return pg;
}

describe("sync snapshot (S9-4 pull: the server's rows replace the phone's)", () => {
  it("a phone that applies the server's snapshot reads exactly what the server reads", async () => {
    const pg = await serverWithData();
    const snapshot = JSON.parse(JSON.stringify(await readSnapshot(pg, USER, "2026-09-01")));
    const phone = await createSqlJsDriver();
    await applySnapshot(phone, USER, snapshot, "2026-09-01");
    expect(await readInicioData(phone, USER, "2026-09-01")).toEqual(await readInicioData(pg, USER, "2026-09-01"));
    expect((await createSqlStorage(phone).getAccount(USER, CARD))?.currentBalance).toBe(200_000);
    expect(JSON.stringify(snapshot)).not.toContain("Ajeno");
  });

  it("rows deleted on the server leave the phone; rows outside the window stay", async () => {
    const pg = await serverWithData();
    const phone = await createSqlJsDriver();
    await applySnapshot(phone, USER, await readSnapshot(pg, USER, "2026-09-01"), "2026-09-01");
    // An old movement the phone keeps (before the window) and one deleted on the server.
    await phone.query("INSERT INTO transactions (id, user_id, account_id, amount, currency_code, direction, transaction_date, capture_method, idempotency_key) VALUES ('old', ?, ?, 1, 'COP', 'OUTFLOW', '2026-08-01', 'MANUAL_FORM', 'old')", [USER, DEBIT]);
    await applyCommand(createSqlStorage(pg), cmd("deleteTransaction", { transactionId: "55555555-5555-4555-8555-555555555555" }));
    await applySnapshot(phone, USER, await readSnapshot(pg, USER, "2026-09-01"), "2026-09-01");
    const ids = (await phone.query<{ id: string }>("SELECT id FROM transactions ORDER BY id")).map((r) => r.id);
    expect(ids).toContain("old");
    expect(ids).not.toContain("55555555-5555-4555-8555-555555555555");
  });
});
