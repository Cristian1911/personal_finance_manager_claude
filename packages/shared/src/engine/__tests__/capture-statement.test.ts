import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { readInicioData } from "../inicio-read";
import { computeIdempotencyKey } from "../../utils/idempotency";
import type { CommandEnvelope, CommandType, SqlDriver } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const DEBIT = "22222222-2222-4222-8222-222222222222";
const CARD = "33333333-3333-4333-8333-333333333333";
const T = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-00000000000${n % 10}`;

let seq = 0;
let ts = Date.parse("2026-10-02T15:00:00.000Z");
const cmd = (type: CommandType, payload: unknown): CommandEnvelope => ({
  id: `f${String(++seq).padStart(7, "0")}-0000-4000-8000-000000000002`, type, userId: USER, deviceId: "server",
  clientTs: new Date((ts += 60_000)).toISOString(), payload,
});
const row = (n: number, over: Record<string, unknown> = {}) => cmd("captureBankTransaction", {
  transactionId: T(n), accountId: DEBIT, source: "PDF", amount: 50_000, direction: "OUTFLOW", currencyCode: "COP",
  date: "2026-09-20", rawLine: "TRANSFERENCIA A NEQUI 3001234567", description: "TRANSFERENCIA A NEQUI 3001234567", ...over,
});

describe.each(DRIVERS)("statement rows (PDF, tier 1) on %s", (_name, make) => {
  let driver: SqlDriver;
  async function setup() {
    driver = await make();
    await seedAccount(driver, { id: DEBIT, userId: USER, balance: 1_000_000, accountType: "SAVINGS" });
    await seedAccount(driver, { id: CARD, userId: USER, balance: 0, accountType: "CREDIT_CARD" });
    return createSqlStorage(driver);
  }
  const counted = async () => (await readInicioData(driver, USER, "2026-09-01")).transactions.filter((t) => !t.reconciledIntoTransactionId);

  it("uses v1's statement key (provider OCR), so the same statement twice is one copy", async () => {
    const s = await setup();
    expect(await applyCommand(s, row(1))).toMatchObject({ status: "applied" });
    const key = await computeIdempotencyKey({ provider: "OCR", transactionDate: "2026-09-20", amount: 50_000, rawDescription: "TRANSFERENCIA A NEQUI 3001234567" });
    expect(await s.findTransactionByIdempotencyKey(USER, key)).toEqual({ id: T(1) });
    expect(await s.getTransaction(USER, T(1))).toMatchObject({ captureMethod: "PDF_IMPORT" });
    expect(await applyCommand(s, row(2))).toMatchObject({ status: "duplicate", data: { transactionId: T(1) } });
  });

  it("two identical rows in one statement are two movements (occurrence index, like v1)", async () => {
    const s = await setup();
    await applyCommand(s, row(1, { occurrence: 1 }));
    expect(await applyCommand(s, row(2, { occurrence: 2 }))).toMatchObject({ status: "applied" });
    expect(await counted()).toHaveLength(2);
  });

  it("a cuota keys on the purchase price and its number: cuota 2 isn't a duplicate of cuota 1", async () => {
    const s = await setup();
    const cuota = (n: number, i: number, date: string) => row(n, { accountId: CARD, amount: 100_000, originalAmount: 300_000, installmentCurrent: i, installmentTotal: 3, date, rawLine: "TIENDA X", description: "TIENDA X" });
    await applyCommand(s, cuota(1, 1, "2026-08-20"));
    expect(await applyCommand(s, cuota(2, 2, "2026-09-20"))).toMatchObject({ status: "applied" });
    expect((await s.getAccount(USER, CARD))?.currentBalance).toBe(200_000);
  });

  it("the statement takes over the email's row of the same purchase (higher tier), counted once", async () => {
    const s = await setup();
    await applyCommand(s, row(1, { source: "EMAIL", rawLine: "Bancolombia: Transferiste $50.000,00 a NEQUI 3001234567", description: "NEQUI 3001234567", time: "10:00" }));
    expect(await applyCommand(s, row(2))).toMatchObject({ status: "applied", data: { mergedFrom: T(1) } });
    expect((await counted()).map((t) => t.id)).toEqual([T(2)]);
    expect((await s.getAccount(USER, DEBIT))?.currentBalance).toBe(950_000);
  });

  it("anchors the account to the statement's final balance, keeping what moved after the cut", async () => {
    const s = await setup();
    await applyCommand(s, cmd("captureManualTransaction", { transactionId: T(9), accountId: DEBIT, amount: 20_000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-10-02", description: "Almuerzo" }));
    expect(await applyCommand(s, cmd("anchorStatementBalance", { accountId: DEBIT, finalBalance: 500_000, asOf: "2026-09-30" }))).toMatchObject({ status: "applied", data: { balance: 480_000 } });
    expect((await s.getAccount(USER, DEBIT))?.currentBalance).toBe(480_000);
    // A card's statement balance is what you owe.
    await applyCommand(s, cmd("anchorStatementBalance", { accountId: CARD, finalBalance: 750_000, asOf: "2026-09-30" }));
    expect((await s.getAccount(USER, CARD))?.currentBalance).toBe(750_000);
  });
});
