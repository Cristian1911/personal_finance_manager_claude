import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { toDialect } from "../sql";
import type { CommandEnvelope } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const A = "22222222-2222-4222-8222-222222222222";
const B = "66666666-6666-4666-8666-666666666666";
const TX = "33333333-3333-4333-8333-333333333333";

const edit = (id: string, clientTs: string, payload: Record<string, unknown>): CommandEnvelope => ({
  id, type: "editTransaction", userId: USER, deviceId: "phone-1", clientTs, payload: { transactionId: TX, ...payload },
});

describe.each(DRIVERS)("editTransaction on %s", (_name, make) => {
  async function setup() {
    const d = await make();
    await seedAccount(d, { id: A, userId: USER, balance: 100000 });
    await seedAccount(d, { id: B, userId: USER, balance: 50000 });
    const s = createSqlStorage(d);
    await applyCommand(s, {
      id: "44444444-4444-4444-8444-444444444444", type: "captureManualTransaction", userId: USER, deviceId: "phone-1",
      clientTs: "2026-09-18T15:00:00.000Z",
      payload: { transactionId: TX, accountId: A, amount: 25000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-18", description: "Tostao" },
    });
    return s;
  }

  it("fixing the amount moves the account balance by exactly the difference", async () => {
    const s = await setup();
    expect((await applyCommand(s, edit("a1111111-1111-4111-8111-111111111111", "2026-09-18T16:00:00.000Z", { amount: 32000 }))).status).toBe("applied");
    expect((await s.getTransaction(USER, TX))?.amount).toBe(32000);
    expect((await s.getAccount(USER, A))?.currentBalance).toBe(68000);
  });

  it("renames it and sets its time; the balance doesn't move, the time places it", async () => {
    const s = await setup();
    expect((await applyCommand(s, edit("a5555555-5555-4555-8555-555555555555", "2026-09-18T16:00:00.000Z", { description: "Tostao Calle 85", time: "07:45" }))).status).toBe("applied");
    expect(await s.getTransaction(USER, TX)).toMatchObject({ cleanDescription: "Tostao Calle 85", transactionTime: "07:45" });
    expect((await s.getAccount(USER, A))?.currentBalance).toBe(75000);
    expect((await applyCommand(s, edit("a6666666-6666-4666-8666-666666666666", "2026-09-18T16:01:00.000Z", { time: "25:00" }))).status).toBe("rejected");
    expect((await applyCommand(s, edit("a7777777-7777-4777-8777-777777777777", "2026-09-18T16:02:00.000Z", { description: "  " }))).status).toBe("rejected");
  });

  it("fixing the date keeps the balance", async () => {
    const s = await setup();
    await applyCommand(s, edit("a2222222-2222-4222-8222-222222222222", "2026-09-18T16:00:00.000Z", { date: "2026-09-17" }));
    expect((await s.getTransaction(USER, TX))?.transactionDate).toBe("2026-09-17");
    expect((await s.getAccount(USER, A))?.currentBalance).toBe(75000);
  });

  it("moving it to another account takes the amount out of one and into the other", async () => {
    const s = await setup();
    await applyCommand(s, edit("a3333333-3333-4333-8333-333333333333", "2026-09-18T16:00:00.000Z", { accountId: B }));
    expect((await s.getAccount(USER, A))?.currentBalance).toBe(100000);
    expect((await s.getAccount(USER, B))?.currentBalance).toBe(25000);
  });

  it("an older edit arriving later doesn't overwrite a newer one, per field", async () => {
    const s = await setup();
    await applyCommand(s, edit("a4444444-4444-4444-8444-444444444444", "2026-09-18T17:00:00.000Z", { amount: 30000 }));
    const late = await applyCommand(s, edit("a5555555-5555-4555-8555-555555555555", "2026-09-18T16:00:00.000Z", { amount: 20000, date: "2026-09-16" }));
    expect(late.status).toBe("applied"); // the date was free to change
    expect(await s.getTransaction(USER, TX)).toMatchObject({ amount: 30000, transactionDate: "2026-09-16" });
    expect((await s.getAccount(USER, A))?.currentBalance).toBe(70000);
  });

  it("rejects nothing-to-change, a bad amount, a bad date and an unknown account", async () => {
    const s = await setup();
    const r = (p: Record<string, unknown>, id: string) => applyCommand(s, edit(id, "2026-09-18T16:00:00.000Z", p));
    expect(await r({}, "a6666666-6666-4666-8666-666666666666")).toMatchObject({ status: "rejected", code: "invalid" });
    expect(await r({ amount: 0 }, "a7777777-7777-4777-8777-777777777777")).toMatchObject({ status: "rejected", code: "invalid" });
    expect(await r({ date: "18/09/2026" }, "a8888888-8888-4888-8888-888888888888")).toMatchObject({ status: "rejected", code: "invalid" });
    expect(await r({ accountId: "99999999-9999-4999-8999-999999999999" }, "a9999999-9999-4999-8999-999999999999")).toMatchObject({ status: "rejected", code: "not_found" });
    expect((await s.getAccount(USER, A))?.currentBalance).toBe(75000);
  });

  it("editing an ignored movement moves no balance", async () => {
    const s = await setup();
    await applyCommand(s, { id: "c1111111-1111-4111-8111-111111111111", type: "setTransactionExcluded", userId: USER, deviceId: "phone-1", clientTs: "2026-09-18T15:30:00.000Z", payload: { transactionId: TX, excluded: true } });
    await applyCommand(s, edit("c2222222-2222-4222-8222-222222222222", "2026-09-18T16:00:00.000Z", { amount: 40000, accountId: B }));
    expect((await s.getAccount(USER, A))?.currentBalance).toBe(100000);
    expect((await s.getAccount(USER, B))?.currentBalance).toBe(50000);
  });

  it("rejects an amount over the cap and an impossible date (they'd never replay on Postgres)", async () => {
    const s = await setup();
    const r = (p: Record<string, unknown>, id: string) => applyCommand(s, edit(id, "2026-09-18T16:00:00.000Z", p));
    expect(await r({ amount: 1e16 }, "c3333333-3333-4333-8333-333333333333")).toMatchObject({ status: "rejected", code: "invalid" });
    expect(await r({ date: "2026-02-30" }, "c4444444-4444-4444-8444-444444444444")).toMatchObject({ status: "rejected", code: "invalid" });
  });

  it("never edits a bank movement (the bank's facts win)", async () => {
    const d = await make();
    await seedAccount(d, { id: A, userId: USER, balance: 100000 });
    const s = createSqlStorage(d);
    await d.query(
      toDialect("INSERT INTO transactions (id, user_id, account_id, amount, currency_code, direction, transaction_date, clean_description, notes, capture_method, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", d.dialect),
      [TX, USER, A, 32000, "COP", "OUTFLOW", "2026-09-18", "RAPPI", null, "EMAIL_IMPORT", "bank-key-2", "2026-09-18T17:41:00.000Z"],
    );
    const r = await applyCommand(s, edit("b1111111-1111-4111-8111-111111111111", "2026-09-18T18:00:00.000Z", { amount: 1000 }));
    expect(r).toMatchObject({ status: "rejected", code: "invalid" });
    expect((await s.getTransaction(USER, TX))?.amount).toBe(32000);
  });
});
