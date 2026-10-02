import { describe, expect, it } from "vitest";
import { createSqlStorage } from "../sql-storage";
import type { CommandEnvelope } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const TX = "33333333-3333-4333-8333-333333333333";
const CMD = "44444444-4444-4444-8444-444444444444";
const OTHER_USER = "66666666-6666-4666-8666-666666666666";

describe.each(DRIVERS)("createSqlStorage on %s", (_name, make) => {
  it("reads an account and adjusts its balance", async () => {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100000 });
    const s = createSqlStorage(d);
    await s.adjustAccountBalance(USER, ACCOUNT, -25000.5);
    expect(await s.getAccount(USER, ACCOUNT)).toEqual({
      id: ACCOUNT, userId: USER, name: "", accountType: "CHECKING", institutionName: null, mask: null, currencyCode: "COP",
      currentBalance: 74999.5, isActive: true, creditLimit: null, cutoffDay: null, paymentDay: null, monthlyPayment: null,
    });
    expect(await s.getAccount(USER, "99999999-9999-4999-8999-999999999999")).toBeNull();
    expect(await s.getAccount(OTHER_USER, ACCOUNT)).toBeNull();
  });

  it("inserts, finds and updates a transaction", async () => {
    const d = await make();
    const s = createSqlStorage(d);
    await s.insertTransaction({
      id: TX, userId: USER, accountId: ACCOUNT, amount: 25000, currencyCode: "COP",
      direction: "OUTFLOW", transactionDate: "2026-09-18", cleanDescription: "Tostao",
      notes: null, captureMethod: "MANUAL_FORM", idempotencyKey: "k1", createdAt: "2026-09-18T15:00:00.000Z",
    });
    expect(await s.findTransactionByIdempotencyKey(USER, "k1")).toEqual({ id: TX });
    expect(await s.findTransactionByIdempotencyKey(USER, "nope")).toBeNull();
    expect(await s.findTransactionByIdempotencyKey(OTHER_USER, "k1")).toBeNull();
    await s.updateTransactionNotes(USER, TX, "con Ana");
    expect(await s.getTransaction(OTHER_USER, TX)).toBeNull();
    expect(await s.getTransaction(USER, TX)).toEqual({
      id: TX, userId: USER, accountId: ACCOUNT, amount: 25000, currencyCode: "COP", direction: "OUTFLOW",
      transactionDate: "2026-09-18", cleanDescription: "Tostao", notes: "con Ana", captureMethod: "MANUAL_FORM",
      idempotencyKey: "k1", createdAt: "2026-09-18T15:00:00.000Z", isExcluded: false, transferGroupId: null, categoryId: null, destinatarioId: null,
      flowClass: null, flowClassVersion: null, rawDescription: null, transactionTime: null, sourcePattern: null, reconciledIntoTransactionId: null, status: "POSTED",
    });
    await s.updateTransactionFacts(USER, TX, { amount: 30000, transactionDate: "2026-09-17", accountId: ACCOUNT, cleanDescription: "Tostao", transactionTime: null });
    expect(await s.getTransaction(USER, TX)).toMatchObject({ amount: 30000, transactionDate: "2026-09-17" });
    await s.deleteTransaction(OTHER_USER, TX); // scoped: another user's delete does nothing
    expect(await s.getTransaction(USER, TX)).not.toBeNull();
    await s.deleteTransaction(USER, TX);
    expect(await s.getTransaction(USER, TX)).toBeNull();
  });

  it("records a command and finds it again with its result", async () => {
    const d = await make();
    const s = createSqlStorage(d);
    const cmd: CommandEnvelope = {
      id: CMD, type: "captureManualTransaction", userId: USER, deviceId: "phone-1",
      clientTs: "2026-09-18T15:00:00.000Z", payload: { a: 1 },
    };
    await s.recordCommand(cmd, { status: "applied", replayed: false, data: { transactionId: TX } });
    expect(await s.findCommand(OTHER_USER, CMD)).toBeNull();
    expect(await s.findCommand(USER, CMD)).toEqual({
      id: CMD, result: { status: "applied", replayed: false, data: { transactionId: TX } },
    });
    expect(await s.findCommand(USER, "55555555-5555-4555-8555-555555555555")).toBeNull();
  });

  it("upserts and reads field versions (ISO timestamp + command id)", async () => {
    const d = await make();
    const s = createSqlStorage(d);
    expect(await s.getFieldVersion(USER, "transaction", TX, "notes")).toBeNull();
    const base = { userId: USER, entity: "transaction", entityId: TX, field: "notes", commandId: CMD };
    await s.setFieldVersion({ ...base, clientTs: "2026-09-18T15:00:00.000Z" });
    await s.setFieldVersion({ ...base, clientTs: "2026-09-18T16:00:00.000Z" });
    expect(await s.getFieldVersion(USER, "transaction", TX, "notes")).toEqual({ clientTs: "2026-09-18T16:00:00.000Z", commandId: CMD });
    expect(await s.getFieldVersion(OTHER_USER, "transaction", TX, "notes")).toBeNull();
  });

  it("keeps balances at cents (no floating-point drift)", async () => {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 0 });
    const s = createSqlStorage(d);
    await s.adjustAccountBalance(USER, ACCOUNT, 0.1);
    await s.adjustAccountBalance(USER, ACCOUNT, 0.2);
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(0.3);
  });

  it("withTransaction rolls back everything on error", async () => {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100 });
    const s = createSqlStorage(d);
    await expect(
      s.withTransaction(async (t) => {
        await t.adjustAccountBalance(USER, ACCOUNT, -50);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(100);
  });
});
