import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { readInicioData } from "../inicio-read";
import { toDisponibleMovements } from "../disponible/movements";
import type { CommandEnvelope, CommandType, SqlDriver } from "../types";
import { toDialect } from "../sql";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const DEBIT = "22222222-2222-4222-8222-222222222222";
const SAVINGS = "33333333-3333-4333-8333-333333333333";
const CARD = "44444444-4444-4444-8444-444444444444";
const GROUP = "55555555-5555-4555-8555-555555555555";
const OUT = "66666666-6666-4666-8666-666666666666";
const IN = "77777777-7777-4777-8777-777777777777";

let seq = 0;
const cmd = (type: CommandType, payload: unknown, clientTs = "2026-10-02T15:00:00.000Z"): CommandEnvelope => ({
  id: `b${String(++seq).padStart(7, "0")}-0000-4000-8000-000000000000`, type, userId: USER, deviceId: "phone-1", clientTs, payload,
});
const transfer = (to: string, amount = 100_000) => cmd("captureTransfer", {
  transferGroupId: GROUP, fromTransactionId: OUT, toTransactionId: IN, fromAccountId: DEBIT, toAccountId: to,
  amount, currencyCode: "COP", date: "2026-10-02",
});

describe.each(DRIVERS)("Anotar on %s", (_name, make) => {
  let driver: SqlDriver;
  async function setup() {
    driver = await make();
    await seedAccount(driver, { id: DEBIT, userId: USER, balance: 1_000_000 });
    await seedAccount(driver, { id: SAVINGS, userId: USER, balance: 0, accountType: "SAVINGS" });
    await seedAccount(driver, { id: CARD, userId: USER, balance: 480_000, accountType: "CREDIT_CARD" });
    return createSqlStorage(driver);
  }
  const balance = async (s: Awaited<ReturnType<typeof setup>>, id: string) => (await s.getAccount(USER, id))?.currentBalance;
  const rows = async () => (await readInicioData(driver, USER, "2026-09-01")).transactions;

  it("an Ingreso is stored as income (flow class), so the classifier never reads it as spending", async () => {
    const s = await setup();
    await applyCommand(s, cmd("captureManualTransaction", {
      transactionId: IN, accountId: DEBIT, amount: 200_000, direction: "INFLOW", currencyCode: "COP", date: "2026-10-02",
      description: "Ingreso extra", flowClass: "INCOME",
    }));
    expect((await rows())[0]).toMatchObject({ flowClass: "INCOME", direction: "INFLOW" });
  });

  it("rejects a flow class Anotar doesn't offer", async () => {
    const s = await setup();
    const r = await applyCommand(s, cmd("captureManualTransaction", {
      transactionId: IN, accountId: DEBIT, amount: 1, direction: "OUTFLOW", currencyCode: "COP", date: "2026-10-02",
      description: "x", flowClass: "DEBT_PAYMENT",
    }));
    expect(r).toMatchObject({ status: "rejected" });
  });

  it("Entre cuentas moves the money: out of one, into the other, as one transfer", async () => {
    const s = await setup();
    expect((await applyCommand(s, transfer(SAVINGS))).status).toBe("applied");
    expect(await balance(s, DEBIT)).toBe(900_000);
    expect(await balance(s, SAVINGS)).toBe(100_000);
    const legs = await rows();
    expect(legs.map((t) => [t.id, t.direction, t.flowClass, t.transferGroupId])).toEqual(expect.arrayContaining([
      [OUT, "OUTFLOW", "SELF_TRANSFER", GROUP],
      [IN, "INFLOW", "SELF_TRANSFER", GROUP],
    ]));
    // Each leg knows the other's account: the classifier sees a transfer, not spending.
    const accounts = (await readInicioData(driver, USER, "2026-09-01")).accounts;
    const kinds = toDisponibleMovements({ transactions: legs, accounts }).map((m) => [m.id, m.kind, m.counterpartAccountId]);
    expect(kinds).toEqual(expect.arrayContaining([[OUT, "transfer", SAVINGS], [IN, "transfer", DEBIT]]));
  });

  it("paying the card lowers what you owe and is a debt payment", async () => {
    const s = await setup();
    await applyCommand(s, transfer(CARD, 300_000));
    expect(await balance(s, DEBIT)).toBe(700_000);
    expect(await balance(s, CARD)).toBe(180_000);
    expect((await rows()).map((t) => t.flowClass).sort()).toEqual(["DEBT_CREDIT", "DEBT_PAYMENT"]);
  });

  it("sending the same transfer again changes nothing", async () => {
    const s = await setup();
    await applyCommand(s, transfer(SAVINGS));
    expect((await applyCommand(s, transfer(SAVINGS))).status).toBe("duplicate");
    expect(await balance(s, DEBIT)).toBe(900_000);
  });

  it.each([
    [{ toAccountId: DEBIT }, "Elige dos cuentas distintas."],
    [{ amount: 0 }, "El monto debe ser mayor que cero."],
    [{ toTransactionId: OUT }, "Identificador inválido."],
  ])("rejects %o", async (patch, error) => {
    const s = await setup();
    const base = transfer(SAVINGS);
    expect(await applyCommand(s, { ...base, payload: { ...(base.payload as object), ...patch } })).toMatchObject({ status: "rejected", error });
  });

  it("deleting either leg removes the whole transfer and puts both balances back", async () => {
    const s = await setup();
    await applyCommand(s, transfer(CARD, 300_000));
    expect((await applyCommand(s, cmd("deleteTransaction", { transactionId: IN }, "2026-10-02T16:00:00.000Z"))).status).toBe("applied");
    expect(await rows()).toEqual([]);
    expect(await balance(s, DEBIT)).toBe(1_000_000);
    expect(await balance(s, CARD)).toBe(480_000);
  });

  it("a manual leg linked to a bank row (v1 'link as transfer') deletes alone", async () => {
    const s = await setup();
    await applyCommand(s, cmd("captureManualTransaction", {
      transactionId: OUT, accountId: DEBIT, amount: 50_000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-10-02", description: "A Nu",
    }));
    await driver.query(toDialect(
      `INSERT INTO transactions (id, user_id, account_id, amount, currency_code, direction, transaction_date, clean_description, capture_method, idempotency_key, transfer_group_id)
       VALUES (?, ?, ?, 50000, 'COP', 'INFLOW', '2026-10-02', 'Desde Bancolombia', 'PDF_IMPORT', 'bank-leg', ?)`, driver.dialect), [IN, USER, SAVINGS, GROUP]);
    await driver.query(toDialect("UPDATE transactions SET transfer_group_id = ? WHERE id = ?", driver.dialect), [GROUP, OUT]);
    expect((await applyCommand(s, cmd("deleteTransaction", { transactionId: OUT }, "2026-10-02T16:00:00.000Z"))).status).toBe("applied");
    expect((await rows()).map((t) => t.id)).toEqual([IN]);
    expect(await balance(s, DEBIT)).toBe(1_000_000);
  });

  it("a transfer leg can't be edited on its own", async () => {
    const s = await setup();
    await applyCommand(s, transfer(SAVINGS));
    expect(await applyCommand(s, cmd("editTransaction", { transactionId: OUT, amount: 5 }, "2026-10-02T16:00:00.000Z")))
      .toMatchObject({ status: "rejected" });
  });
});
