import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { readInicioData } from "../inicio-read";
import type { CommandEnvelope, CommandType, SqlDriver } from "../types";
import { toDialect } from "../sql";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const DEBIT = "22222222-2222-4222-8222-222222222222";
const RENT = "33333333-3333-4333-8333-333333333333";
const TX = "44444444-4444-4444-8444-444444444444";
const OTHER_ACCOUNT = "77777777-7777-4777-8777-777777777777";

let seq = 0;
const cmd = (type: CommandType, payload: unknown, clientTs = "2026-10-02T15:00:00.000Z"): CommandEnvelope => ({
  id: `e${String(++seq).padStart(7, "0")}-0000-4000-8000-000000000000`, type, userId: USER, deviceId: "phone-1", clientTs, payload,
});
const arriendo = { templateId: RENT, name: "Arriendo", amount: 1_200_000, dayOfMonth: 5, accountId: DEBIT, startDate: "2026-10-05" };
const spend = (amount: number, date: string, id = TX) => cmd("captureManualTransaction", {
  transactionId: id, accountId: DEBIT, amount, direction: "OUTFLOW", currencyCode: "COP", date, description: "Pago arriendo",
});

describe.each(DRIVERS)("Pagos fijos on %s", (_name, make) => {
  let driver: SqlDriver;
  async function setup() {
    driver = await make();
    await seedAccount(driver, { id: DEBIT, userId: USER, balance: 3_000_000 });
    return createSqlStorage(driver);
  }
  const read = () => readInicioData(driver, USER, "2026-09-01");

  it("createPagoFijo saves a monthly bill on its day", async () => {
    const s = await setup();
    expect((await applyCommand(s, cmd("createPagoFijo", arriendo))).status).toBe("applied");
    expect((await read()).templates).toEqual([
      { id: RENT, label: "Arriendo", amount: 1_200_000, direction: "OUTFLOW", frequency: "MONTHLY", startDate: "2026-10-05", endDate: null, accountId: DEBIT, isActive: true },
    ]);
  });

  it.each([
    [{ dayOfMonth: 29 }, "El día va del 1 al 28."],
    [{ amount: 0 }, "El monto debe ser mayor que cero."],
    [{ name: " " }, "Escribe qué pagas."],
  ])("rejects %o", async (patch, error) => {
    const s = await setup();
    expect(await applyCommand(s, cmd("createPagoFijo", { ...arriendo, ...patch }))).toMatchObject({ status: "rejected", error });
  });

  it("a spend of that amount within 3 days pays it on its own (bill detection)", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createPagoFijo", arriendo));
    await applyCommand(s, spend(1_200_000, "2026-10-06"));
    expect((await read()).occurrences).toEqual([
      expect.objectContaining({ templateId: RENT, date: "2026-10-05", status: "paid", transactionId: TX }),
    ]);
  });

  it("a different amount or far from the day isn't taken as the payment", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createPagoFijo", arriendo));
    await applyCommand(s, spend(1_000_000, "2026-10-05", "55555555-5555-4555-8555-555555555555"));
    await applyCommand(s, spend(1_200_000, "2026-10-12", "66666666-6666-4666-8666-666666666666"));
    expect((await read()).occurrences).toEqual([]);
  });

  it("a payment made before adding the bill is found when it's added", async () => {
    const s = await setup();
    await applyCommand(s, spend(1_200_000, "2026-10-04"));
    await applyCommand(s, cmd("createPagoFijo", arriendo));
    expect((await read()).occurrences[0]).toMatchObject({ date: "2026-10-05", status: "paid", transactionId: TX });
  });

  it("deleting the payment puts the bill back to pending", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createPagoFijo", arriendo));
    await applyCommand(s, spend(1_200_000, "2026-10-05"));
    await applyCommand(s, cmd("deleteTransaction", { transactionId: TX }, "2026-10-02T16:00:00.000Z"));
    // Back to the computed "pending": nothing stored stands out any more.
    expect((await read()).occurrences).toEqual([]);
    expect(await s.getOccurrence(USER, RENT, "2026-10-05")).toMatchObject({ status: "pending", transactionId: null });
  });

  it("'Este mes no' skips it; 'Ya lo pagué' marks it paid without a movement; latest choice wins", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createPagoFijo", arriendo));
    await applyCommand(s, cmd("setOccurrenceStatus", { templateId: RENT, date: "2026-10-05", status: "skipped" }, "2026-10-03T10:00:00.000Z"));
    expect((await read()).occurrences[0]).toMatchObject({ status: "skipped" });
    await applyCommand(s, cmd("setOccurrenceStatus", { templateId: RENT, date: "2026-10-05", status: "paid" }, "2026-10-03T11:00:00.000Z"));
    expect((await applyCommand(s, cmd("setOccurrenceStatus", { templateId: RENT, date: "2026-10-05", status: "pending" }, "2026-10-03T09:00:00.000Z"))).status).toBe("superseded");
    expect((await read()).occurrences[0]).toMatchObject({ status: "paid", transactionId: null });
  });

  it("an occurrence date that isn't the bill's is rejected", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createPagoFijo", arriendo));
    expect(await applyCommand(s, cmd("setOccurrenceStatus", { templateId: RENT, date: "2026-10-06", status: "skipped" })))
      .toMatchObject({ status: "rejected" });
  });

  it("editPagoFijo changes the amount; archive stops it", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createPagoFijo", arriendo));
    await applyCommand(s, cmd("editPagoFijo", { templateId: RENT, amount: 1_300_000, name: "Arriendo apto" }, "2026-10-03T10:00:00.000Z"));
    expect((await read()).templates[0]).toMatchObject({ amount: 1_300_000, label: "Arriendo apto" });
    await applyCommand(s, cmd("archivePagoFijo", { templateId: RENT, archived: true }, "2026-10-03T11:00:00.000Z"));
    expect((await read()).templates[0]).toMatchObject({ isActive: false });
  });
});

describe.each(DRIVERS)("Pagos fijos, review fixes, on %s", (_name, make) => {
  let driver: SqlDriver;
  async function setup() {
    driver = await make();
    await seedAccount(driver, { id: DEBIT, userId: USER, balance: 3_000_000 });
    await seedAccount(driver, { id: OTHER_ACCOUNT, userId: USER, balance: 3_000_000 });
    return createSqlStorage(driver);
  }
  const occ = async (s: Awaited<ReturnType<typeof setup>>) => s.getOccurrence(USER, RENT, "2026-10-05");

  it("ignoring the payment puts the bill back to pending; counting it again pays it again", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createPagoFijo", arriendo));
    await applyCommand(s, spend(1_200_000, "2026-10-05"));
    await applyCommand(s, cmd("setTransactionExcluded", { transactionId: TX, excluded: true }, "2026-10-03T10:00:00.000Z"));
    expect(await occ(s)).toMatchObject({ status: "pending", transactionId: null });
    await applyCommand(s, cmd("setTransactionExcluded", { transactionId: TX, excluded: false }, "2026-10-03T11:00:00.000Z"));
    expect(await occ(s)).toMatchObject({ status: "paid", transactionId: TX });
  });

  it("fixing a payment's amount re-checks it", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createPagoFijo", arriendo));
    await applyCommand(s, spend(1_000_000, "2026-10-05"));
    expect(await occ(s)).toBeNull();
    await applyCommand(s, cmd("editTransaction", { transactionId: TX, amount: 1_200_000 }, "2026-10-03T10:00:00.000Z"));
    expect(await occ(s)).toMatchObject({ status: "paid", transactionId: TX });
  });

  it("a bill tied to an account is only paid from that account", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createPagoFijo", arriendo));
    await applyCommand(s, cmd("captureManualTransaction", {
      transactionId: TX, accountId: OTHER_ACCOUNT, amount: 1_200_000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-10-05", description: "Otra cosa",
    }));
    expect(await occ(s)).toBeNull();
  });

  it("after the amount is edited, a spend of the new amount pays the server's stale pending row", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createPagoFijo", arriendo));
    // The server's trigger had generated the row with the old amount.
    await driver.query(toDialect("INSERT INTO recurring_occurrences (id, user_id, template_id, occurrence_date, expected_amount, status) VALUES (?, ?, ?, '2026-10-05', 1200000, 'pending')", driver.dialect),
      ["99999999-9999-4999-8999-999999999999", USER, RENT]);
    await applyCommand(s, cmd("editPagoFijo", { templateId: RENT, amount: 1_300_000 }, "2026-10-03T10:00:00.000Z"));
    await applyCommand(s, spend(1_300_000, "2026-10-05"));
    expect(await occ(s)).toMatchObject({ status: "paid", transactionId: TX });
  });
});
