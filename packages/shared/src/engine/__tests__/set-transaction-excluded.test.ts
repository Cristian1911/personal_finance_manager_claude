import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { readInicioData } from "../inicio-read";
import type { CommandEnvelope } from "../types";
import type { SetTransactionExcludedPayload } from "../commands/set-transaction-excluded";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const TX = "33333333-3333-4333-8333-333333333333";

function ignore(id: string, clientTs: string, excluded: boolean): CommandEnvelope<SetTransactionExcludedPayload> {
  return { id, type: "setTransactionExcluded", userId: USER, deviceId: "phone-1", clientTs, payload: { transactionId: TX, excluded } };
}

describe.each(DRIVERS)("setTransactionExcluded on %s", (_name, make) => {
  async function setup() {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100000 });
    const s = createSqlStorage(d);
    await applyCommand(s, {
      id: "44444444-4444-4444-8444-444444444444", type: "captureManualTransaction", userId: USER,
      deviceId: "phone-1", clientTs: "2026-09-18T15:00:00.000Z",
      payload: { transactionId: TX, accountId: ACCOUNT, amount: 25000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-18", description: "Tostao" },
    });
    return { d, s };
  }
  const excludedNow = async (d: Awaited<ReturnType<typeof setup>>["d"]) =>
    (await readInicioData(d, USER, "2026-09-01")).transactions.find((t) => t.id === TX)?.isExcluded;

  it("ignores a movement and counts it again; Inicio's read sees both", async () => {
    const { d, s } = await setup();
    expect(await excludedNow(d)).toBe(false);
    expect((await applyCommand(s, ignore("a1111111-1111-4111-8111-111111111111", "2026-09-18T16:00:00.000Z", true))).status).toBe("applied");
    expect(await excludedNow(d)).toBe(true);
    await applyCommand(s, ignore("a2222222-2222-4222-8222-222222222222", "2026-09-18T17:00:00.000Z", false));
    expect(await excludedNow(d)).toBe(false);
  });

  it("keeps the latest choice when an older one arrives later", async () => {
    const { d, s } = await setup();
    await applyCommand(s, ignore("a3333333-3333-4333-8333-333333333333", "2026-09-18T17:00:00.000Z", true));
    const late = await applyCommand(s, ignore("a4444444-4444-4444-8444-444444444444", "2026-09-18T16:00:00.000Z", false));
    expect(late.status).toBe("superseded");
    expect(await excludedNow(d)).toBe(true);
  });

  it("rejects a bad payload and an unknown movement", async () => {
    const { s } = await setup();
    const bad = await applyCommand(s, { ...ignore("a5555555-5555-4555-8555-555555555555", "2026-09-18T16:00:00.000Z", true), payload: { transactionId: TX, excluded: "sí" as unknown as boolean } });
    expect(bad).toMatchObject({ status: "rejected", code: "invalid" });
    const missing = await applyCommand(s, { ...ignore("a6666666-6666-4666-8666-666666666666", "2026-09-18T16:00:00.000Z", true), payload: { transactionId: "99999999-9999-4999-8999-999999999999", excluded: true } });
    expect(missing).toEqual({ status: "rejected", replayed: false, code: "not_found", error: "Movimiento no encontrado." });
  });
});
