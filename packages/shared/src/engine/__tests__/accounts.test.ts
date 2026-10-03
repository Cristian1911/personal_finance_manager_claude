import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { readInicioData } from "../inicio-read";
import type { CommandEnvelope, CommandType, SqlDriver } from "../types";
import { DRIVERS } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "77777777-7777-4777-8777-777777777777";
const ACC = "22222222-2222-4222-8222-222222222222";
const CARD = "33333333-3333-4333-8333-333333333333";

let seq = 0;
const cmd = (type: CommandType, payload: unknown, clientTs = "2026-10-02T15:00:00.000Z", userId = USER): CommandEnvelope => ({
  id: `a${String(++seq).padStart(7, "0")}-0000-4000-8000-000000000000`, type, userId, deviceId: "phone-1", clientTs, payload,
});
const bancolombia = {
  accountId: ACC, accountType: "SAVINGS", name: "Bancolombia", institutionName: "Bancolombia", mask: "4821",
  currencyCode: "COP", balance: 1_320_000,
};
const nuCard = {
  accountId: CARD, accountType: "CREDIT_CARD", name: "Tarjeta Nu", institutionName: "Nu", mask: "4398",
  currencyCode: "COP", balance: 480_000, creditLimit: 3_000_000, cutoffDay: 27, paymentDay: 12,
};

describe.each(DRIVERS)("accounts on %s", (_name, make) => {
  let driver: SqlDriver;
  async function setup() {
    driver = await make();
    return createSqlStorage(driver);
  }

  it("createAccount saves what the user told, with the balance they have today", async () => {
    const s = await setup();
    expect((await applyCommand(s, cmd("createAccount", bancolombia))).status).toBe("applied");
    expect(await s.getAccount(USER, ACC)).toEqual({
      id: ACC, userId: USER, name: "Bancolombia", accountType: "SAVINGS", institutionName: "Bancolombia", mask: "4821",
      currencyCode: "COP", currentBalance: 1_320_000, isActive: true,
      creditLimit: null, cutoffDay: null, paymentDay: null, monthlyPayment: null, currencyBalances: null,
    });
  });

  it("a card stores what you owe, its limit and its days", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createAccount", nuCard));
    expect(await s.getAccount(USER, CARD)).toMatchObject({ currentBalance: 480_000, creditLimit: 3_000_000, cutoffDay: 27, paymentDay: 12 });
  });

  it("sending the same account again (offline retry) never creates a second one", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createAccount", bancolombia));
    expect((await applyCommand(s, cmd("createAccount", { ...bancolombia, balance: 9 }))).status).toBe("duplicate");
    expect((await s.getAccount(USER, ACC))?.currentBalance).toBe(1_320_000);
  });

  it.each([
    [{ name: "  " }, "Escribe un nombre para la cuenta."],
    [{ accountType: "INVESTMENT" }, "Tipo de cuenta inválido."],
    [{ mask: "48" }, "Los últimos dígitos son 4 números."],
    [{ balance: 0.001 }, "El saldo no es válido."],
    [{ currencyCode: "pesos" }, "Moneda inválida."],
    [{ cutoffDay: 32 }, "El día debe estar entre 1 y 31."],
  ])("rejects %o", async (patch, error) => {
    const s = await setup();
    expect(await applyCommand(s, cmd("createAccount", { ...bancolombia, ...patch }))).toMatchObject({ status: "rejected", error });
    expect(await s.getAccount(USER, ACC)).toBeNull();
  });

  it("what you owe on a card or loan can't be negative", async () => {
    const s = await setup();
    expect(await applyCommand(s, cmd("createAccount", { ...nuCard, balance: -1 }))).toMatchObject({ status: "rejected" });
  });

  it("editAccount renames and fixes details, one field at a time", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createAccount", nuCard));
    expect((await applyCommand(s, cmd("editAccount", { accountId: CARD, name: "Nu", paymentDay: 15 }, "2026-10-02T16:00:00.000Z"))).status).toBe("applied");
    expect(await s.getAccount(USER, CARD)).toMatchObject({ name: "Nu", paymentDay: 15, cutoffDay: 27, mask: "4398" });
  });

  it("an older rename arriving late loses to the newer one", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createAccount", bancolombia));
    await applyCommand(s, cmd("editAccount", { accountId: ACC, name: "Nómina" }, "2026-10-02T17:00:00.000Z"));
    expect((await applyCommand(s, cmd("editAccount", { accountId: ACC, name: "Ahorros" }, "2026-10-02T16:00:00.000Z"))).status).toBe("superseded");
    expect((await s.getAccount(USER, ACC))?.name).toBe("Nómina");
  });

  it("editing someone else's account finds nothing", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createAccount", bancolombia));
    expect(await applyCommand(s, cmd("editAccount", { accountId: ACC, name: "Mía" }, undefined, OTHER))).toMatchObject({ status: "rejected", code: "not_found" });
    expect((await s.getAccount(USER, ACC))?.name).toBe("Bancolombia");
  });

  it("an archived account leaves Inicio's accounts; un-archiving brings it back", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createAccount", bancolombia));
    await applyCommand(s, cmd("archiveAccount", { accountId: ACC, archived: true }, "2026-10-02T16:00:00.000Z"));
    expect((await s.getAccount(USER, ACC))?.isActive).toBe(false);
    expect((await readInicioData(driver, USER, "2026-09-01")).accounts).toEqual([]);
    await applyCommand(s, cmd("archiveAccount", { accountId: ACC, archived: false }, "2026-10-02T17:00:00.000Z"));
    expect((await readInicioData(driver, USER, "2026-09-01")).accounts.map((a) => a.id)).toEqual([ACC]);
  });

  it("Inicio reads each account's name and kind", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createAccount", bancolombia));
    expect((await readInicioData(driver, USER, "2026-09-01")).accounts[0]).toMatchObject({ name: "Bancolombia", institutionName: "Bancolombia", mask: "4821" });
  });
});
