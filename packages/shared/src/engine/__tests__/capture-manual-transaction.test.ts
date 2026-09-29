import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import type { CaptureManualTransactionPayload } from "../commands/capture-manual-transaction";
import type { CommandEnvelope } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "66666666-6666-4666-8666-666666666666";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const TX = "33333333-3333-4333-8333-333333333333";

function capture(
  over: Partial<CaptureManualTransactionPayload> = {},
  id = "44444444-4444-4444-8444-444444444444",
): CommandEnvelope<CaptureManualTransactionPayload> {
  return {
    id, type: "captureManualTransaction", userId: USER, deviceId: "phone-1",
    clientTs: "2026-09-18T15:00:00.000Z",
    payload: {
      transactionId: TX, accountId: ACCOUNT, amount: 25000, direction: "OUTFLOW",
      currencyCode: "COP", date: "2026-09-18", description: "Tostao", notes: null, ...over,
    },
  };
}

describe.each(DRIVERS)("captureManualTransaction on %s", (_name, make) => {
  async function setup() {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100000 });
    return createSqlStorage(d);
  }

  it("creates the movement and lowers the account balance", async () => {
    const s = await setup();
    const r = await applyCommand(s, capture());
    expect(r).toEqual({ status: "applied", replayed: false, data: { transactionId: TX } });
    expect((await s.getTransaction(TX))?.cleanDescription).toBe("Tostao");
    expect((await s.getAccount(ACCOUNT))?.currentBalance).toBe(75000);
  });

  it("raises the balance for an INFLOW", async () => {
    const s = await setup();
    await applyCommand(s, capture({ direction: "INFLOW", amount: 50000 }));
    expect((await s.getAccount(ACCOUNT))?.currentBalance).toBe(150000);
  });

  it("accepts cents that aren't exact in floating point", async () => {
    const s = await setup();
    const r = await applyCommand(s, capture({ amount: 0.29 }));
    expect(r.status).toBe("applied");
  });

  it("applies a replayed command only once and returns the original result", async () => {
    const s = await setup();
    const first = await applyCommand(s, capture());
    const again = await applyCommand(s, capture());
    expect(again).toEqual({ ...first, replayed: true });
    expect((await s.getAccount(ACCOUNT))?.currentBalance).toBe(75000);
  });

  it("reports a duplicate when a different command captures the same movement", async () => {
    const s = await setup();
    await applyCommand(s, capture());
    const dup = await applyCommand(s, capture({}, "77777777-7777-4777-8777-777777777777"));
    expect(dup).toEqual({ status: "duplicate", replayed: false, data: { transactionId: TX } });
    expect((await s.getAccount(ACCOUNT))?.currentBalance).toBe(75000);
  });

  it("rejects invalid input, records the rejection and changes nothing", async () => {
    const s = await setup();
    const bad = capture({ amount: -5 });
    const r = await applyCommand(s, bad);
    expect(r.status).toBe("rejected");
    expect(r.error).toBe("El monto debe ser mayor que cero.");
    expect(await applyCommand(s, bad)).toEqual({ ...r, replayed: true });
    expect((await s.getAccount(ACCOUNT))?.currentBalance).toBe(100000);
  });

  it("rejects an account that belongs to someone else", async () => {
    const s = await setup();
    const r = await applyCommand(s, { ...capture(), userId: OTHER_USER });
    expect(r).toEqual({ status: "rejected", replayed: false, error: "Cuenta no encontrada." });
  });
});
