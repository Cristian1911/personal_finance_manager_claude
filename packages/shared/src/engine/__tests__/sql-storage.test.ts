import { describe, expect, it } from "vitest";
import { createSqlStorage } from "../sql-storage";
import type { CommandEnvelope } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const TX = "33333333-3333-4333-8333-333333333333";
const CMD = "44444444-4444-4444-8444-444444444444";

describe.each(DRIVERS)("createSqlStorage on %s", (_name, make) => {
  it("reads an account and adjusts its balance", async () => {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100000 });
    const s = createSqlStorage(d);
    await s.adjustAccountBalance(ACCOUNT, -25000.5);
    expect(await s.getAccount(ACCOUNT)).toEqual({ id: ACCOUNT, userId: USER, currentBalance: 74999.5 });
    expect(await s.getAccount("99999999-9999-4999-8999-999999999999")).toBeNull();
  });

  it("inserts, finds and updates a transaction", async () => {
    const d = await make();
    const s = createSqlStorage(d);
    await s.insertTransaction({
      id: TX, userId: USER, accountId: ACCOUNT, amount: 25000, currencyCode: "COP",
      direction: "OUTFLOW", transactionDate: "2026-09-18", cleanDescription: "Tostao",
      notes: null, captureMethod: "MANUAL_FORM", idempotencyKey: "k1",
    });
    expect(await s.findTransactionByIdempotencyKey("k1")).toEqual({ id: TX });
    expect(await s.findTransactionByIdempotencyKey("nope")).toBeNull();
    await s.updateTransactionNotes(TX, "con Ana");
    expect(await s.getTransaction(TX)).toEqual({
      id: TX, userId: USER, accountId: ACCOUNT, amount: 25000, direction: "OUTFLOW",
      cleanDescription: "Tostao", notes: "con Ana", idempotencyKey: "k1",
    });
  });

  it("records a command and finds it again with its result", async () => {
    const d = await make();
    const s = createSqlStorage(d);
    const cmd: CommandEnvelope = {
      id: CMD, type: "captureManualTransaction", userId: USER, deviceId: "phone-1",
      clientTs: "2026-09-18T15:00:00.000Z", payload: { a: 1 },
    };
    await s.recordCommand(cmd, { status: "applied", replayed: false, data: { transactionId: TX } });
    expect(await s.findCommand(CMD)).toEqual({
      id: CMD, result: { status: "applied", replayed: false, data: { transactionId: TX } },
    });
    expect(await s.findCommand("55555555-5555-4555-8555-555555555555")).toBeNull();
  });

  it("upserts and reads field versions as ISO timestamps", async () => {
    const d = await make();
    const s = createSqlStorage(d);
    expect(await s.getFieldVersion("transaction", TX, "notes")).toBeNull();
    const base = { userId: USER, entity: "transaction", entityId: TX, field: "notes", commandId: CMD };
    await s.setFieldVersion({ ...base, clientTs: "2026-09-18T15:00:00.000Z" });
    await s.setFieldVersion({ ...base, clientTs: "2026-09-18T16:00:00.000Z" });
    expect(await s.getFieldVersion("transaction", TX, "notes")).toBe("2026-09-18T16:00:00.000Z");
  });

  it("withTransaction rolls back everything on error", async () => {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100 });
    const s = createSqlStorage(d);
    await expect(
      s.withTransaction(async (t) => {
        await t.adjustAccountBalance(ACCOUNT, -50);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect((await s.getAccount(ACCOUNT))?.currentBalance).toBe(100);
  });
});
