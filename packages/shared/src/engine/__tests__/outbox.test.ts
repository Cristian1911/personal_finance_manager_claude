import { describe, expect, it } from "vitest";
import { OUTBOX_SCHEMA, applyAndEnqueue } from "../outbox";
import { createSqlStorage } from "../sql-storage";
import type { CommandEnvelope, SqlDriver } from "../types";
import { createSqlJsDriver, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const TX = "33333333-3333-4333-8333-333333333333";

function capture(over: Record<string, unknown> = {}, id = "44444444-4444-4444-8444-444444444444"): CommandEnvelope {
  return {
    id, type: "captureManualTransaction", userId: USER, deviceId: "phone-1",
    clientTs: "2026-09-30T15:00:00.000Z",
    payload: { transactionId: TX, accountId: ACCOUNT, amount: 25000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-30", description: "Tostao", ...over },
  };
}

async function setup(withOutbox = true) {
  const d = await createSqlJsDriver();
  if (withOutbox) await d.query(OUTBOX_SCHEMA);
  await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100000 });
  return d;
}

const outbox = (d: SqlDriver) =>
  d.query<{ command_id: string; user_id: string; state: string; attempts: number }>(
    "SELECT command_id, user_id, state, attempts FROM outbox ORDER BY seq");

describe("applyAndEnqueue (phone outbox)", () => {
  it("queues an applied command as pending", async () => {
    const d = await setup();
    const r = await applyAndEnqueue(d, capture());
    expect(r.status).toBe("applied");
    expect(await outbox(d)).toEqual([
      { command_id: "44444444-4444-4444-8444-444444444444", user_id: USER, state: "pending", attempts: 0 },
    ]);
  });

  it("queues a duplicate too (the server must see it)", async () => {
    const d = await setup();
    await applyAndEnqueue(d, capture());
    const dup = await applyAndEnqueue(d, capture({}, "77777777-7777-4777-8777-777777777777"));
    expect(dup.status).toBe("duplicate");
    expect((await outbox(d)).map((r) => r.command_id)).toEqual([
      "44444444-4444-4444-8444-444444444444", "77777777-7777-4777-8777-777777777777",
    ]);
  });

  it("does not queue a rejected command", async () => {
    const d = await setup();
    const r = await applyAndEnqueue(d, capture({ amount: -5 }));
    expect(r.status).toBe("rejected");
    expect(await outbox(d)).toEqual([]);
  });

  it("does not queue a replay a second time", async () => {
    const d = await setup();
    await applyAndEnqueue(d, capture());
    const again = await applyAndEnqueue(d, capture());
    expect(again.replayed).toBe(true);
    expect(await outbox(d)).toHaveLength(1);
  });

  it("is atomic: if queueing fails, the command leaves no trace", async () => {
    const d = await setup(false); // no outbox table → the insert fails
    await expect(applyAndEnqueue(d, capture())).rejects.toThrow();
    const s = createSqlStorage(d);
    expect(await s.findCommand(USER, "44444444-4444-4444-8444-444444444444")).toBeNull();
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(100000);
  });
});
