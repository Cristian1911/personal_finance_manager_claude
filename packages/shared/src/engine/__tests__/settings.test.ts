import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { defaultCountsInDisponible } from "../commands/set-account-counts-in-disponible";
import type { CommandEnvelope } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "66666666-6666-4666-8666-666666666666";
const DEBIT = "22222222-2222-4222-8222-222222222222";
const CARD = "33333333-3333-4333-8333-333333333333";

let seq = 0;
const nextId = () => `c${String(++seq).padStart(7, "0")}-0000-4000-8000-000000000000`;

function cmd(type: "setCycleSettings" | "setAccountCountsInDisponible", payload: unknown, clientTs = "2026-09-30T15:00:00.000Z", id = nextId()): CommandEnvelope {
  return { id, type, userId: USER, deviceId: "phone-1", clientTs, payload };
}

describe("defaultCountsInDisponible (S3-0)", () => {
  it.each([
    ["CHECKING", true], ["SAVINGS", true], ["CASH", true],
    ["INVESTMENT", false], ["OTHER", false], ["CREDIT_CARD", false], ["LOAN", false],
  ])("%s → %s", (type, expected) => {
    expect(defaultCountsInDisponible(type)).toBe(expected);
  });
});

describe.each(DRIVERS)("setCycleSettings on %s", (_name, make) => {
  async function setup() {
    return createSqlStorage(await make());
  }

  it("saves the pay schedule and income (onboarding A2, A3)", async () => {
    const s = await setup();
    const r = await applyCommand(s, cmd("setCycleSettings", {
      schedule: { kind: "semimonthly", paydays: [15, 30] }, incomePerCycle: 2_100_000,
    }));
    expect(r).toEqual({ status: "applied", replayed: false, data: { applied: ["schedule", "incomePerCycle"], superseded: [] } });
    expect(await s.getCycleSettings(USER)).toEqual({
      schedule: { kind: "semimonthly", paydays: [15, 30] },
      incomePerCycle: 2_100_000, savingsPerCycle: 0, balanceAnchor: null, bigPurchaseThreshold: 300_000,
    });
  });

  it("each question can be answered alone, in any order", async () => {
    const s = await setup();
    await applyCommand(s, cmd("setCycleSettings", { savingsPerCycle: 200_000 }));
    await applyCommand(s, cmd("setCycleSettings", { schedule: { kind: "monthly", paydays: [1] } }));
    expect(await s.getCycleSettings(USER)).toMatchObject({
      schedule: { kind: "monthly", paydays: [1] }, incomePerCycle: null, savingsPerCycle: 200_000,
    });
  });

  it("the first-day balance is stamped with the command's time (A4)", async () => {
    const s = await setup();
    await applyCommand(s, cmd("setCycleSettings", { balanceAnchor: 1_000_000 }, "2026-09-18T14:00:00.000Z"));
    expect((await s.getCycleSettings(USER))?.balanceAnchor).toEqual({ balance: 1_000_000, at: "2026-09-18T14:00:00.000Z" });
    await applyCommand(s, cmd("setCycleSettings", { balanceAnchor: null }, "2026-09-18T15:00:00.000Z"));
    expect((await s.getCycleSettings(USER))?.balanceAnchor).toBeNull();
  });

  it("biweekly keeps its anchor payday; irregular needs nothing else", async () => {
    const s = await setup();
    await applyCommand(s, cmd("setCycleSettings", { schedule: { kind: "biweekly", anchor: "2026-09-04" } }));
    expect((await s.getCycleSettings(USER))?.schedule).toEqual({ kind: "biweekly", anchor: "2026-09-04" });
    await applyCommand(s, cmd("setCycleSettings", { schedule: { kind: "irregular" } }, "2026-09-30T16:00:00.000Z"));
    expect((await s.getCycleSettings(USER))?.schedule).toEqual({ kind: "irregular" });
  });

  it("latest edit per field wins, whatever the arrival order (S1-2)", async () => {
    const s = await setup();
    await applyCommand(s, cmd("setCycleSettings", { incomePerCycle: 2_500_000 }, "2026-09-30T17:00:00.000Z"));
    const late = await applyCommand(s, cmd("setCycleSettings", { incomePerCycle: 2_000_000, savingsPerCycle: 100_000 }, "2026-09-30T16:00:00.000Z"));
    expect(late).toEqual({ status: "applied", replayed: false, data: { applied: ["savingsPerCycle"], superseded: ["incomePerCycle"] } });
    expect(await s.getCycleSettings(USER)).toMatchObject({ incomePerCycle: 2_500_000, savingsPerCycle: 100_000 });
    const older = await applyCommand(s, cmd("setCycleSettings", { incomePerCycle: 1 }, "2026-09-30T15:00:00.000Z"));
    expect(older.status).toBe("superseded");
  });

  it("a replay changes nothing", async () => {
    const s = await setup();
    const c = cmd("setCycleSettings", { incomePerCycle: 2_100_000 });
    await applyCommand(s, c);
    expect((await applyCommand(s, c)).replayed).toBe(true);
  });

  it("one user's settings never touch another's", async () => {
    const s = await setup();
    await applyCommand(s, cmd("setCycleSettings", { incomePerCycle: 2_100_000 }));
    expect(await s.getCycleSettings(OTHER)).toBeNull();
  });

  it.each([
    [{}, "No hay nada que guardar."],
    [{ schedule: { kind: "semimonthly", paydays: [30, 15] } }, "Los días de pago no son válidos."],
    [{ schedule: { kind: "semimonthly", paydays: [15, 15] } }, "Los días de pago no son válidos."],
    [{ schedule: { kind: "monthly", paydays: [32] } }, "Los días de pago no son válidos."],
    [{ schedule: { kind: "monthly", paydays: [1.5] } }, "Los días de pago no son válidos."],
    [{ schedule: { kind: "biweekly", anchor: "2026-02-30" } }, "La fecha de pago no es válida."],
    [{ schedule: { kind: "weekly" } }, "Frecuencia de pago inválida."],
    [{ incomePerCycle: -1 }, "El monto no es válido."],
    [{ savingsPerCycle: 0.001 }, "El monto no es válido."],
    [{ bigPurchaseThreshold: 0 }, "El monto no es válido."],
    [{ balanceAnchor: Number.NaN }, "El monto no es válido."],
  ])("rejects %j", async (payload, error) => {
    const s = await setup();
    expect(await applyCommand(s, cmd("setCycleSettings", payload))).toEqual({ status: "rejected", replayed: false, code: "invalid", error });
    expect(await s.getCycleSettings(USER)).toBeNull();
  });

  it("a negative first-day balance is allowed (overdrawn)", async () => {
    const s = await setup();
    expect((await applyCommand(s, cmd("setCycleSettings", { balanceAnchor: -50_000 }))).status).toBe("applied");
  });
});

describe.each(DRIVERS)("setAccountCountsInDisponible on %s", (_name, make) => {
  async function setup() {
    const d = await make();
    await seedAccount(d, { id: DEBIT, userId: USER, balance: 0 });
    await seedAccount(d, { id: CARD, userId: USER, balance: 0, accountType: "CREDIT_CARD" });
    return createSqlStorage(d);
  }

  it("keeps a savings account apart (A13)", async () => {
    const s = await setup();
    expect(await s.getAccountSetting(USER, DEBIT)).toBeNull();
    const r = await applyCommand(s, cmd("setAccountCountsInDisponible", { accountId: DEBIT, counts: false }));
    expect(r).toEqual({ status: "applied", replayed: false });
    expect(await s.getAccountSetting(USER, DEBIT)).toEqual({ countsInDisponible: false });
    await applyCommand(s, cmd("setAccountCountsInDisponible", { accountId: DEBIT, counts: true }, "2026-09-30T16:00:00.000Z"));
    expect(await s.getAccountSetting(USER, DEBIT)).toEqual({ countsInDisponible: true });
  });

  it("the latest choice wins across devices", async () => {
    const s = await setup();
    await applyCommand(s, cmd("setAccountCountsInDisponible", { accountId: DEBIT, counts: false }, "2026-09-30T17:00:00.000Z"));
    const late = await applyCommand(s, cmd("setAccountCountsInDisponible", { accountId: DEBIT, counts: true }, "2026-09-30T16:00:00.000Z"));
    expect(late.status).toBe("superseded");
    expect(await s.getAccountSetting(USER, DEBIT)).toEqual({ countsInDisponible: false });
  });

  it("a card or loan can never count", async () => {
    const s = await setup();
    expect(await applyCommand(s, cmd("setAccountCountsInDisponible", { accountId: CARD, counts: true }))).toEqual({
      status: "rejected", replayed: false, code: "invalid", error: "Las tarjetas y los créditos no cuentan para tu Disponible.",
    });
    // Marking it apart is harmless and allowed.
    expect((await applyCommand(s, cmd("setAccountCountsInDisponible", { accountId: CARD, counts: false }))).status).toBe("applied");
  });

  it("another user's account is not found", async () => {
    const s = await setup();
    const r = await applyCommand(s, { ...cmd("setAccountCountsInDisponible", { accountId: DEBIT, counts: false }), userId: OTHER });
    expect(r).toEqual({ status: "rejected", replayed: false, code: "not_found", error: "Cuenta no encontrada." });
  });

  it("rejects a bad payload", async () => {
    const s = await setup();
    expect((await applyCommand(s, cmd("setAccountCountsInDisponible", { accountId: DEBIT, counts: "sí" }))).code).toBe("invalid");
    expect((await applyCommand(s, cmd("setAccountCountsInDisponible", { accountId: "x", counts: true }))).code).toBe("invalid");
  });
});
