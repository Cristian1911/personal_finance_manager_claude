import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { toDialect } from "../sql";
import type { CommandEnvelope } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const TX = "33333333-3333-4333-8333-333333333333";
const BANK_TX = "55555555-5555-4555-8555-555555555555";

const capture = (id: string, clientTs: string, extra: Record<string, unknown> = {}): CommandEnvelope => ({
  id, type: "captureManualTransaction", userId: USER, deviceId: "phone-1", clientTs,
  payload: { transactionId: TX, accountId: ACCOUNT, amount: 25000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-18", description: "Tostao", notes: "con Ana", ...extra },
});
const del = (id: string, transactionId = TX): CommandEnvelope => ({
  id, type: "deleteTransaction", userId: USER, deviceId: "phone-1", clientTs: "2026-09-18T16:00:00.000Z", payload: { transactionId },
});

describe.each(DRIVERS)("deleteTransaction on %s", (_name, make) => {
  async function setup() {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100000 });
    const s = createSqlStorage(d);
    await applyCommand(s, capture("44444444-4444-4444-8444-444444444444", "2026-09-18T15:00:00.000Z"));
    return { d, s };
  }

  it("deletes a manual movement and puts its amount back on the account", async () => {
    const { s } = await setup();
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(75000);
    expect((await applyCommand(s, del("a1111111-1111-4111-8111-111111111111"))).status).toBe("applied");
    expect(await s.getTransaction(USER, TX)).toBeNull();
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(100000);
  });

  it("replaying the same delete or deleting again never moves the balance twice", async () => {
    const { s } = await setup();
    const cmd = del("a2222222-2222-4222-8222-222222222222");
    await applyCommand(s, cmd);
    expect((await applyCommand(s, cmd)).replayed).toBe(true);
    expect(await applyCommand(s, del("a3333333-3333-4333-8333-333333333333"))).toMatchObject({ status: "rejected", code: "not_found" });
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(100000);
  });

  it("Deshacer: re-capturing with the same id and capturedAt brings it back exactly", async () => {
    const { s } = await setup();
    await applyCommand(s, del("a4444444-4444-4444-8444-444444444444"));
    const undo = await applyCommand(s, capture("a5555555-5555-4555-8555-555555555555", "2026-09-18T16:00:03.000Z", { capturedAt: "2026-09-18T15:00:00.000Z" }));
    expect(undo.status).toBe("applied");
    expect(await s.getTransaction(USER, TX)).toMatchObject({ amount: 25000, notes: "con Ana", transactionDate: "2026-09-18", createdAt: "2026-09-18T15:00:00.000Z" });
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(75000);
  });

  it("rejects a capturedAt after the command's own time", async () => {
    const { s } = await setup();
    await applyCommand(s, del("a6666666-6666-4666-8666-666666666666"));
    const r = await applyCommand(s, capture("a7777777-7777-4777-8777-777777777777", "2026-09-18T16:00:00.000Z", { capturedAt: "2026-09-19T00:00:00.000Z" }));
    expect(r).toMatchObject({ status: "rejected", code: "invalid" });
  });

  it("deleting an ignored movement doesn't touch the balance again", async () => {
    const { s } = await setup();
    await applyCommand(s, { id: "b4444444-4444-4444-8444-444444444444", type: "setTransactionExcluded", userId: USER, deviceId: "phone-1", clientTs: "2026-09-18T15:30:00.000Z", payload: { transactionId: TX, excluded: true } });
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(100000);
    await applyCommand(s, del("b5555555-5555-4555-8555-555555555555"));
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(100000);
  });

  it("never deletes a bank movement (it can only be ignored)", async () => {
    const { d, s } = await setup();
    await d.query(
      toDialect("INSERT INTO transactions (id, user_id, account_id, amount, currency_code, direction, transaction_date, clean_description, notes, capture_method, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", d.dialect),
      [BANK_TX, USER, ACCOUNT, 32000, "COP", "OUTFLOW", "2026-09-18", "RAPPI", null, "EMAIL_IMPORT", "bank-key-1", "2026-09-18T17:41:00.000Z"],
    );
    const r = await applyCommand(s, del("a8888888-8888-4888-8888-888888888888", BANK_TX));
    expect(r).toEqual({ status: "rejected", replayed: false, code: "invalid", error: "Solo se pueden borrar los movimientos que anotaste a mano." });
    expect(await s.getTransaction(USER, BANK_TX)).not.toBeNull();
  });
});
