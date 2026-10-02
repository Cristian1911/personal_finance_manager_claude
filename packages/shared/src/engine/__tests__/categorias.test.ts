import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { readInicioData } from "../inicio-read";
import { V2_CATEGORIES } from "../categories";
import type { CommandEnvelope, CommandType, SqlDriver } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const DEBIT = "22222222-2222-4222-8222-222222222222";
const RAPPI = "33333333-3333-4333-8333-333333333333";
const LAURA = "44444444-4444-4444-8444-444444444444";
const T1 = "55555555-5555-4555-8555-555555555555";
const T2 = "66666666-6666-4666-8666-666666666666";
const DOMICILIOS = V2_CATEGORIES.find((c) => c.name === "Domicilios")!.id;
const MERCADO = V2_CATEGORIES.find((c) => c.name === "Mercado")!.id;

let seq = 0;
let ts = Date.parse("2026-10-02T15:00:00.000Z");
const cmd = (type: CommandType, payload: unknown): CommandEnvelope => ({
  id: `d${String(++seq).padStart(7, "0")}-0000-4000-8000-000000000001`, type, userId: USER, deviceId: "phone-1",
  clientTs: new Date((ts += 60_000)).toISOString(), payload,
});
const spend = (id: string, description: string) => cmd("captureManualTransaction", {
  transactionId: id, accountId: DEBIT, amount: 32_000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-10-02", description,
});

describe.each(DRIVERS)("categorías y destinatarios on %s", (_name, make) => {
  let driver: SqlDriver;
  async function setup() {
    driver = await make();
    await seedAccount(driver, { id: DEBIT, userId: USER, balance: 1_000_000 });
    return createSqlStorage(driver);
  }
  const row = async (id: string) => (await readInicioData(driver, USER, "2026-09-01")).transactions.find((t) => t.id === id);

  it("a movement takes a category; the latest choice wins", async () => {
    const s = await setup();
    await applyCommand(s, spend(T1, "Rappi"));
    expect((await applyCommand(s, cmd("setTransactionCategory", { transactionId: T1, categoryId: DOMICILIOS }))).status).toBe("applied");
    expect(await row(T1)).toMatchObject({ categoryId: DOMICILIOS });
    await applyCommand(s, cmd("setTransactionCategory", { transactionId: T1, categoryId: null }));
    expect((await row(T1))?.categoryId).toBeNull();
  });

  it("rejects a category that isn't one of the 25", async () => {
    const s = await setup();
    await applyCommand(s, spend(T1, "Rappi"));
    expect(await applyCommand(s, cmd("setTransactionCategory", { transactionId: T1, categoryId: "99999999-9999-4999-8999-999999999999" })))
      .toMatchObject({ status: "rejected" });
  });

  it("a new destinatario with its pattern; later movements that say it get it and its category", async () => {
    const s = await setup();
    expect((await applyCommand(s, cmd("createDestinatario", { destinatarioId: RAPPI, name: "Rappi", kind: "merchant", pattern: "rappi", defaultCategoryId: DOMICILIOS }))).status).toBe("applied");
    await applyCommand(s, spend(T1, "COMPRA RAPPI COLOMBIA"));
    expect(await row(T1)).toMatchObject({ destinatarioId: RAPPI, categoryId: DOMICILIOS });
    expect((await readInicioData(driver, USER, "2026-09-01")).destinatarios).toEqual([
      expect.objectContaining({ id: RAPPI, name: "Rappi", kind: "merchant", defaultCategoryId: DOMICILIOS }),
    ]);
  });

  it("choosing the destinatario of a movement can remember its text for next time", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createDestinatario", { destinatarioId: LAURA, name: "Laura Gómez", kind: "person" }));
    await applyCommand(s, spend(T1, "TRANSFERENCIA A LAURA G"));
    await applyCommand(s, cmd("setTransactionDestinatario", { transactionId: T1, destinatarioId: LAURA, remember: true }));
    await applyCommand(s, spend(T2, "TRANSFERENCIA A LAURA G"));
    expect(await row(T2)).toMatchObject({ destinatarioId: LAURA });
  });

  it("'¿Siempre Domicilios para Rappi?' sets the default and fixes the past, except what the user chose by hand", async () => {
    const s = await setup();
    await applyCommand(s, cmd("createDestinatario", { destinatarioId: RAPPI, name: "Rappi", kind: "merchant", pattern: "rappi" }));
    await applyCommand(s, spend(T1, "RAPPI"));
    await applyCommand(s, spend(T2, "RAPPI"));
    await applyCommand(s, cmd("setTransactionCategory", { transactionId: T2, categoryId: MERCADO }));
    await applyCommand(s, cmd("setDestinatarioCategory", { destinatarioId: RAPPI, categoryId: DOMICILIOS, applyToPast: true }));
    expect((await row(T1))?.categoryId).toBe(DOMICILIOS);
    expect((await row(T2))?.categoryId).toBe(MERCADO);
  });

  it("a destinatario's name is required and its kind is comercio or persona", async () => {
    const s = await setup();
    expect(await applyCommand(s, cmd("createDestinatario", { destinatarioId: RAPPI, name: " ", kind: "merchant" }))).toMatchObject({ status: "rejected" });
    expect(await applyCommand(s, cmd("createDestinatario", { destinatarioId: RAPPI, name: "X", kind: "company" }))).toMatchObject({ status: "rejected" });
  });
});
