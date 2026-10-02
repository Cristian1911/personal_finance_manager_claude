import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { readInicioData } from "../inicio-read";
import { V2_CATEGORIES } from "../categories";
import type { CommandEnvelope, CommandType, SqlDriver } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const DEBIT = "22222222-2222-4222-8222-222222222222";
const CARD = "33333333-3333-4333-8333-333333333333";
const MANUAL = "44444444-4444-4444-8444-444444444444";
const BANK = "55555555-5555-4555-8555-555555555555";
const BANK2 = "66666666-6666-4666-8666-666666666666";
const RAPPI = "77777777-7777-4777-8777-777777777777";
const RENT = "88888888-8888-4888-8888-888888888888";
const MERCADO = V2_CATEGORIES.find((c) => c.name === "Mercado")!.id;
const DOMICILIOS = V2_CATEGORIES.find((c) => c.name === "Domicilios")!.id;

let seq = 0;
let ts = Date.parse("2026-10-02T15:00:00.000Z");
const cmd = (type: CommandType, payload: unknown): CommandEnvelope => ({
  id: `e${String(++seq).padStart(7, "0")}-0000-4000-8000-000000000001`, type, userId: USER, deviceId: "server",
  clientTs: new Date((ts += 60_000)).toISOString(), payload,
});

// What the route builds from parseBancolombiaEmail (webapp/src/lib/parsers).
const RAW = "Bancolombia: Compraste $32.000,00 en RAPPI COLOMBIA con tu T.Deb *0735, el 02/10/2026 a las 12:41.";
const email = (over: Record<string, unknown> = {}) => cmd("captureBankTransaction", {
  transactionId: BANK, accountId: DEBIT, source: "EMAIL", amount: 32_000, direction: "OUTFLOW", currencyCode: "COP",
  date: "2026-10-02", time: "12:41", rawLine: RAW, description: "RAPPI COLOMBIA", merchantName: "RAPPI COLOMBIA",
  sourcePattern: "compra_debito", ...over,
});
const manual = (amount: number, description = "Rappi", date = "2026-10-02") => cmd("captureManualTransaction", {
  transactionId: MANUAL, accountId: DEBIT, amount, direction: "OUTFLOW", currencyCode: "COP", date, description,
});

describe.each(DRIVERS)("captureBankTransaction (bank emails, tier 2) on %s", (_name, make) => {
  let driver: SqlDriver;
  async function setup() {
    driver = await make();
    await seedAccount(driver, { id: DEBIT, userId: USER, balance: 1_000_000, accountType: "SAVINGS" });
    await seedAccount(driver, { id: CARD, userId: USER, balance: 0, accountType: "CREDIT_CARD" });
    return createSqlStorage(driver);
  }
  const counted = async () => (await readInicioData(driver, USER, "2026-09-01")).transactions.filter((t) => !t.reconciledIntoTransactionId);

  it("records the bank's movement: its text and time, the balance, a flow class, and the destinatario rules", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createDestinatario", { destinatarioId: RAPPI, name: "Rappi", kind: "merchant", pattern: "rappi", defaultCategoryId: DOMICILIOS }));
    expect(await applyCommand(s, email())).toMatchObject({ status: "applied", data: { transactionId: BANK } });
    const row = await s.getTransaction(USER, BANK);
    expect(row).toMatchObject({ captureMethod: "EMAIL_IMPORT", rawDescription: RAW, transactionTime: "12:41", destinatarioId: RAPPI, categoryId: DOMICILIOS, flowClass: "SPEND" });
    expect((await s.getAccount(USER, DEBIT))?.currentBalance).toBe(968_000);
  });

  it("the same email twice (a webhook retry) is one movement", async () => {
    const s = await setup();
    await applyCommand(s, email());
    expect(await applyCommand(s, email({ transactionId: BANK2 }))).toMatchObject({ status: "duplicate", data: { transactionId: BANK } });
    expect(await counted()).toHaveLength(1);
    expect((await s.getAccount(USER, DEBIT))?.currentBalance).toBe(968_000);
  });

  it("what you anotaste becomes the bank's movement: one movement, the bank's amount, your category and note kept", async () => {
    const s = await setup();
    await applyCommand(s, manual(32_000));
    await applyCommand(s, cmd("setTransactionCategory", { transactionId: MANUAL, categoryId: MERCADO }));
    await applyCommand(s, cmd("setTransactionNote", { transactionId: MANUAL, notes: "con Ana" }));
    expect(await applyCommand(s, email())).toMatchObject({ status: "applied", data: { transactionId: BANK, mergedFrom: MANUAL } });
    const rows = await counted();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: BANK, amount: 32_000, categoryId: MERCADO, notes: "con Ana" });
    // Counted once: what you anotaste already moved the balance.
    expect((await s.getAccount(USER, DEBIT))?.currentBalance).toBe(968_000);
    // Your choice stays yours: a later rule doesn't overwrite it.
    await applyCommand(s, cmd("createDestinatario", { destinatarioId: RAPPI, name: "Rappi", kind: "merchant" }));
    await applyCommand(s, cmd("setTransactionDestinatario", { transactionId: BANK, destinatarioId: RAPPI }));
    await applyCommand(s, cmd("setDestinatarioCategory", { destinatarioId: RAPPI, categoryId: DOMICILIOS, applyToPast: true }));
    expect((await s.getTransaction(USER, BANK))?.categoryId).toBe(MERCADO);
  });

  it("same amount, different words ('Almuerzo' vs CREPES Y WAFFLES): held for Revisar, not counted twice (S1-2)", async () => {
    const s = await setup();
    await applyCommand(s, manual(32_000, "Almuerzo"));
    const crepes = { rawLine: "Bancolombia: Compraste $32.000,00 en CREPES Y WAFFLES", description: "CREPES Y WAFFLES", merchantName: "CREPES Y WAFFLES" };
    expect(await applyCommand(s, email(crepes))).toMatchObject({ status: "applied", data: { transactionId: BANK, heldFor: MANUAL } });
    expect((await counted()).map((t) => t.id)).toEqual([MANUAL]);
    expect((await s.getAccount(USER, DEBIT))?.currentBalance).toBe(968_000);
    expect(await s.getTransaction(USER, BANK)).toMatchObject({ status: "PENDING", reconciledIntoTransactionId: MANUAL });
    // "No, son dos": both count.
    expect(await applyCommand(s, cmd("resolveBankDuplicate", { transactionId: BANK, same: false }))).toMatchObject({ status: "applied" });
    expect(await counted()).toHaveLength(2);
    expect((await s.getAccount(USER, DEBIT))?.currentBalance).toBe(936_000);
  });

  it("'Sí, es el mismo': the bank's row takes over, and the fixed payment it paid stays paid", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createPagoFijo", { templateId: RENT, name: "Arriendo", amount: 32_000, dayOfMonth: 2, accountId: DEBIT, startDate: "2026-10-02" }));
    await applyCommand(s, manual(32_000, "Arriendo"));
    await applyCommand(s, cmd("setTransactionNote", { transactionId: MANUAL, notes: "octubre" }));
    expect(await s.findOccurrencesByTransaction(USER, MANUAL)).toHaveLength(1);
    await applyCommand(s, email({ rawLine: "Bancolombia: Transferiste $32.000,00 a ARRENDAMIENTOS SAS", description: "ARRENDAMIENTOS SAS", sourcePattern: "transferencia" }));
    expect(await applyCommand(s, cmd("resolveBankDuplicate", { transactionId: BANK, same: true }))).toMatchObject({ status: "applied" });
    expect((await counted()).map((t) => [t.id, t.notes])).toEqual([[BANK, "octubre"]]);
    expect((await s.getAccount(USER, DEBIT))?.currentBalance).toBe(968_000);
    expect(await s.findOccurrencesByTransaction(USER, MANUAL)).toHaveLength(0);
    expect(await s.findOccurrencesByTransaction(USER, BANK)).toEqual([expect.objectContaining({ status: "paid" })]);
    // Answered once: a second answer changes nothing.
    expect(await applyCommand(s, cmd("resolveBankDuplicate", { transactionId: BANK, same: false }))).toMatchObject({ status: "rejected" });
  });

  it("two real purchases of the same amount the same day (two emails) are two movements", async () => {
    const s = await setup();
    await applyCommand(s, email({ time: "08:10", rawLine: `${RAW} 08:10` }));
    expect(await applyCommand(s, email({ transactionId: BANK2, time: "17:55", rawLine: `${RAW} 17:55` }))).toMatchObject({ status: "applied" });
    expect(await counted()).toHaveLength(2);
    expect((await s.getAccount(USER, DEBIT))?.currentBalance).toBe(936_000);
  });

  it("a card purchase raises what you owe on the card", async () => {
    const s = await setup();
    await applyCommand(s, email({ accountId: CARD, sourcePattern: "compra_credito" }));
    expect((await s.getAccount(USER, CARD))?.currentBalance).toBe(32_000);
  });

  it("rejects a malformed email capture", async () => {
    const s = await setup();
    expect(await applyCommand(s, email({ rawLine: "" }))).toMatchObject({ status: "rejected", code: "invalid" });
    expect(await applyCommand(s, email({ source: "SMS" }))).toMatchObject({ status: "rejected", code: "invalid" });
    expect(await applyCommand(s, email({ time: "25:99" }))).toMatchObject({ status: "rejected", code: "invalid" });
  });
});
