import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import type { CommandEnvelope } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const TX = "33333333-3333-4333-8333-333333333333";
const CMD = "44444444-4444-4444-8444-444444444444";

function capture(over: Partial<CommandEnvelope> = {}): CommandEnvelope {
  return {
    id: CMD, type: "captureManualTransaction", userId: USER, deviceId: "phone-1",
    clientTs: "2026-09-18T15:00:00.000Z",
    payload: { transactionId: TX, accountId: ACCOUNT, amount: 1000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-18", description: "Tostao" },
    ...over,
  };
}

describe.each(DRIVERS)("applyCommand envelope checks on %s", (_name, make) => {
  async function setup() {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100000 });
    return createSqlStorage(d);
  }

  it.each([
    ["no timezone", "2026-09-18T15:00:00"],
    ["not a date", "ayer"],
    ["microseconds", "2026-09-18T15:00:00.123456Z"],
  ])("rejects a clientTs with %s without recording it", async (_label, clientTs) => {
    const s = await setup();
    const r = await applyCommand(s, capture({ clientTs }));
    expect(r).toMatchObject({ status: "rejected", replayed: false, code: "invalid" });
    expect(await s.findCommand(USER, CMD)).toBeNull();
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(100000);
  });

  it("rejects an upper-case command id without recording it", async () => {
    const s = await setup();
    const r = await applyCommand(s, capture({ id: CMD.toUpperCase().replace(/4/g, "A") }));
    expect(r).toMatchObject({ status: "rejected", code: "invalid" });
  });

  it("does not record an unknown command type, so a newer server can apply it later", async () => {
    const s = await setup();
    const r = await applyCommand(s, capture({ type: "futureCommand" as never }));
    expect(r).toMatchObject({ status: "rejected", replayed: false, code: "unsupported" });
    expect(await s.findCommand(USER, CMD)).toBeNull();
  });
});
