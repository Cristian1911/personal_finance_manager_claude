import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { readInicioData } from "../inicio-read";
import { buildInicio } from "../disponible";
import type { CommandEnvelope, CommandType, SqlDriver } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "66666666-6666-4666-8666-666666666666";
const DEBIT = "22222222-2222-4222-8222-222222222222";
const CARD = "33333333-3333-4333-8333-333333333333";

let seq = 0;
const nextId = () => `d${String(++seq).padStart(7, "0")}-0000-4000-8000-000000000000`;

function cmd(type: CommandType, payload: unknown, clientTs = "2026-09-16T14:00:00.000Z", userId = USER): CommandEnvelope {
  return { id: nextId(), type, userId, deviceId: "phone-1", clientTs, payload };
}

function expense(transactionId: string, date: string, amount: number, accountId = DEBIT, userId = USER) {
  return cmd("captureManualTransaction", {
    transactionId, accountId, amount, direction: "OUTFLOW", currencyCode: "COP", date, description: "Gasto", notes: null,
  }, `${date}T20:00:00.000Z`, userId);
}

describe.each(DRIVERS)("readInicioData on %s", (_name, make) => {
  async function setup(): Promise<SqlDriver> {
    const d = await make();
    await seedAccount(d, { id: DEBIT, userId: USER, balance: 1_500_000 });
    await seedAccount(d, { id: CARD, userId: USER, balance: 0, accountType: "CREDIT_CARD" });
    return d;
  }

  it("returns settings, accounts with their choice and the movements since a date", async () => {
    const d = await setup();
    const s = createSqlStorage(d);
    await applyCommand(s, cmd("setCycleSettings", {
      schedule: { kind: "semimonthly", paydays: [15, 30] }, incomePerCycle: 2_100_000, savingsPerCycle: 200_000, balanceAnchor: 1_500_000,
    }));
    await applyCommand(s, cmd("setAccountCountsInDisponible", { accountId: DEBIT, counts: false }));
    await applyCommand(s, expense("44444444-4444-4444-8444-444444444441", "2026-07-01", 1_000));
    await applyCommand(s, expense("44444444-4444-4444-8444-444444444442", "2026-09-17", 100_000));

    const data = await readInicioData(d, USER, "2026-08-01");
    expect(data.settings).toMatchObject({ incomePerCycle: 2_100_000, balanceAnchor: { balance: 1_500_000, at: "2026-09-16T14:00:00.000Z" } });
    expect(data.accounts).toEqual([
      { id: DEBIT, name: "", accountType: "CHECKING", institutionName: null, mask: null, currentBalance: 1_399_000, cutoffDay: null, monthlyPayment: null, paymentDay: null, countsInDisponible: false, usdOwed: null },
      { id: CARD, name: "", accountType: "CREDIT_CARD", institutionName: null, mask: null, currentBalance: 0, cutoffDay: null, monthlyPayment: null, paymentDay: null, countsInDisponible: null, usdOwed: null },
    ]);
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0]).toMatchObject({
      id: "44444444-4444-4444-8444-444444444442", accountId: DEBIT, date: "2026-09-17", amount: 100_000,
      direction: "OUTFLOW", currencyCode: "COP", captureMethod: "MANUAL_FORM", flowClass: null,
    });
    // Stamped on insert, so a movement on the anchor's day can be placed around it.
    expect(data.transactions[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("reads only the user's own rows", async () => {
    const d = await setup();
    await seedAccount(d, { id: "55555555-5555-4555-8555-555555555555", userId: OTHER, balance: 9 });
    const data = await readInicioData(d, OTHER, "2026-01-01");
    expect(data.settings).toBeNull();
    expect(data.accounts.map((a) => a.id)).toEqual(["55555555-5555-4555-8555-555555555555"]);
  });

  it("M1 acceptance: an offline manual expense moves Disponible", async () => {
    const d = await setup();
    const s = createSqlStorage(d);
    await applyCommand(s, cmd("setCycleSettings", {
      schedule: { kind: "semimonthly", paydays: [15, 30] }, incomePerCycle: 2_100_000, savingsPerCycle: 200_000, balanceAnchor: 1_500_000,
    }));
    const inicio = async () => {
      const data = await readInicioData(d, USER, "2026-07-10");
      const r = buildInicio({ today: "2026-09-18", now: "2026-09-18T15:00:00.000Z", ...data });
      if (r.status !== "ready") throw new Error("expected ready");
      return r;
    };
    expect((await inicio()).view.amount).toBe("$1.300.000");
    await applyCommand(s, expense("44444444-4444-4444-8444-444444444443", "2026-09-17", 100_000));
    expect((await inicio()).view.amount).toBe("$1.200.000");
    // A card purchase doesn't lower it.
    await applyCommand(s, expense("44444444-4444-4444-8444-444444444444", "2026-09-17", 300_000, CARD));
    expect((await inicio()).view.amount).toBe("$1.200.000");
  });
});
