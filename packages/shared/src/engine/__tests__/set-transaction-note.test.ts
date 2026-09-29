import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import type { CommandEnvelope } from "../types";
import type { SetTransactionNotePayload } from "../commands/set-transaction-note";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const TX = "33333333-3333-4333-8333-333333333333";

function note(id: string, clientTs: string, notes: string | null): CommandEnvelope<SetTransactionNotePayload> {
  return { id, type: "setTransactionNote", userId: USER, deviceId: "phone-1", clientTs, payload: { transactionId: TX, notes } };
}

describe.each(DRIVERS)("setTransactionNote on %s", (_name, make) => {
  async function setup() {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100000 });
    const s = createSqlStorage(d);
    await applyCommand(s, {
      id: "44444444-4444-4444-8444-444444444444", type: "captureManualTransaction", userId: USER,
      deviceId: "phone-1", clientTs: "2026-09-18T15:00:00.000Z",
      payload: { transactionId: TX, accountId: ACCOUNT, amount: 25000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-18", description: "Tostao" },
    });
    return s;
  }

  it("sets the note", async () => {
    const s = await setup();
    const r = await applyCommand(s, note("a1111111-1111-4111-8111-111111111111", "2026-09-18T16:00:00.000Z", "con Ana"));
    expect(r.status).toBe("applied");
    expect((await s.getTransaction(TX))?.notes).toBe("con Ana");
  });

  it("keeps the latest edit when an older one arrives later", async () => {
    const s = await setup();
    await applyCommand(s, note("a2222222-2222-4222-8222-222222222222", "2026-09-18T17:00:00.000Z", "nueva"));
    const late = await applyCommand(s, note("a3333333-3333-4333-8333-333333333333", "2026-09-18T16:00:00.000Z", "vieja"));
    expect(late).toEqual({ status: "superseded", replayed: false });
    expect((await s.getTransaction(TX))?.notes).toBe("nueva");
  });

  it("rejects a note for a movement that doesn't exist", async () => {
    const s = await setup();
    const r = await applyCommand(s, {
      ...note("a4444444-4444-4444-8444-444444444444", "2026-09-18T16:00:00.000Z", "x"),
      payload: { transactionId: "99999999-9999-4999-8999-999999999999", notes: "x" },
    });
    expect(r).toEqual({ status: "rejected", replayed: false, error: "Movimiento no encontrado." });
  });
});
