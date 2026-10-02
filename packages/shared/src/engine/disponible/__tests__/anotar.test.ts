import { describe, expect, it } from "vitest";
import type { CycleSettings } from "../../types";
import { anotarPreview, dictado, yaEsta } from "../anotar";
import type { InicioAccount } from "../inicio";
import type { StoredTransaction } from "../movements";

// Semimonthly 15/30; $1.500.000 told on the 16th; today the 18th (12 days left).
const settings: CycleSettings = {
  schedule: { kind: "semimonthly", paydays: [15, 30] }, incomePerCycle: 2_100_000, savingsPerCycle: 0,
  balanceAnchor: { balance: 1_500_000, at: "2026-09-16T14:00:00.000Z" }, bigPurchaseThreshold: 300_000,
};
const acc = (id: string, accountType: string, over: Partial<InicioAccount> = {}): InicioAccount =>
  ({ id, name: id, accountType, currentBalance: 0, countsInDisponible: null, ...over });
const accounts = [acc("Bancolombia", "SAVINGS", { currentBalance: 2_000_000 }), acc("Ahorros Nu", "SAVINGS", { countsInDisponible: false, currentBalance: 1_000_000 }), acc("Tarjeta Nu", "CREDIT_CARD")];
const base = { today: "2026-09-18", now: "2026-09-18T15:00:00.000Z", settings, accounts, transactions: [] };

describe("anotarPreview (the effect line while you type, S8-9)", () => {
  it("a spend from a counted account: what's left and per day", () => {
    expect(anotarPreview(base, { kind: "gasto", amount: 120_000, accountId: "Bancolombia" }))
      .toEqual({ line: "Te quedan $1.380.000 · $115.000 al día · 12 días", tone: "neutral" });
  });

  it("more than you have left warns", () => {
    expect(anotarPreview(base, { kind: "gasto", amount: 1_600_000, accountId: "Bancolombia" })?.tone).toBe("bad");
  });

  it("on a card it doesn't move Disponible now: the bill does", () => {
    expect(anotarPreview(base, { kind: "gasto", amount: 50_000, accountId: "Tarjeta Nu" })?.line)
      .toBe("Va a Tarjeta Nu: tu Disponible no cambia hoy, lo pagas con la factura.");
  });

  it("from an account apart, nothing changes", () => {
    expect(anotarPreview(base, { kind: "gasto", amount: 50_000, accountId: "Ahorros Nu" })?.line)
      .toBe("Ahorros Nu no cuenta para tu Disponible: no cambia.");
  });

  it("an income raises it", () => {
    expect(anotarPreview(base, { kind: "ingreso", amount: 300_000, accountId: "Bancolombia" })?.line)
      .toBe("Tu Disponible sube a $1.800.000");
  });

  it("between two counted accounts nothing changes; to one apart it goes down; to a card it's a payment", () => {
    const counted2 = [...accounts, acc("Nequi", "SAVINGS", { currentBalance: 50_000 })];
    expect(anotarPreview({ ...base, accounts: counted2 }, { kind: "entre", amount: 100_000, accountId: "Bancolombia", toAccountId: "Nequi" })?.line)
      .toBe("Las dos cuentan para tu Disponible: no cambia.");
    expect(anotarPreview(base, { kind: "entre", amount: 200_000, accountId: "Bancolombia", toAccountId: "Ahorros Nu" })?.line)
      .toBe("Ahorros Nu no cuenta para tu Disponible: baja a $1.300.000.");
    expect(anotarPreview(base, { kind: "entre", amount: 200_000, accountId: "Bancolombia", toAccountId: "Tarjeta Nu" })?.line)
      .toBe("Pagas Tarjeta Nu: tu Disponible baja a $1.300.000.");
  });

  it("warns when the account doesn't have that much", () => {
    const low = [acc("Bancolombia", "SAVINGS", { currentBalance: 75_000 }), acc("Tarjeta Nu", "CREDIT_CARD")];
    expect(anotarPreview({ ...base, accounts: low }, { kind: "entre", amount: 200_000, accountId: "Bancolombia", toAccountId: "Tarjeta Nu" }))
      .toEqual({ line: "Bancolombia tiene $75.000: quedaría en −$125.000.", tone: "bad" });
    expect(anotarPreview({ ...base, accounts: low }, { kind: "gasto", amount: 100_000, accountId: "Bancolombia" })?.tone).toBe("bad");
  });

  it("between two accounts that don't count, it says so (not 'las dos cuentan')", () => {
    const apart2 = [...accounts, acc("CDT", "SAVINGS", { countsInDisponible: false, currentBalance: 500_000 })];
    expect(anotarPreview({ ...base, accounts: apart2 }, { kind: "entre", amount: 100_000, accountId: "Ahorros Nu", toAccountId: "CDT" })?.line)
      .toBe("Ninguna de las dos cuenta para tu Disponible: no cambia.");
  });

  it("an account already below zero warns too", () => {
    const over = [acc("Bancolombia", "SAVINGS", { currentBalance: -170_000 })];
    expect(anotarPreview({ ...base, accounts: over }, { kind: "gasto", amount: 10_000, accountId: "Bancolombia" })?.tone).toBe("bad");
  });

  it("an account whose balance was never given doesn't warn on every spend", () => {
    const fresh = [acc("Efectivo", "CASH", { currentBalance: 0 })];
    expect(anotarPreview({ ...base, accounts: fresh }, { kind: "gasto", amount: 20_000, accountId: "Efectivo" })?.tone).toBe("neutral");
  });

  it("nothing to say without an amount or before the first-run questions", () => {
    expect(anotarPreview(base, { kind: "gasto", amount: 0, accountId: "Bancolombia" })).toBeNull();
    expect(anotarPreview({ ...base, settings: null }, { kind: "gasto", amount: 10, accountId: "Bancolombia" })).toBeNull();
  });
});

describe("dictado (Dictar fills Anotar)", () => {
  const accts = [acc("Bancolombia", "SAVINGS"), acc("Efectivo", "CASH"), acc("Tarjeta Nu", "CREDIT_CARD")];
  it("amount, what and the account it names", () => {
    expect(dictado("almuerzo 45 mil en efectivo", accts, new Date("2026-09-18T15:00:00Z"))).toMatchObject({
      kind: "gasto", amount: 45_000, what: "Almuerzo", accountId: "Efectivo",
    });
  });
  it("an income said as such", () => {
    expect(dictado("me pagaron 300 mil del freelance", accts, new Date("2026-09-18T15:00:00Z"))).toMatchObject({ kind: "ingreso", amount: 300_000 });
  });
  it("names the card even with accents or case", () => {
    expect(dictado("taxi 20000 con la tarjeta nu", accts, new Date("2026-09-18T15:00:00Z"))?.accountId).toBe("Tarjeta Nu");
  });
  it("in Ingreso, a sentence without a verb stays an income", () => {
    expect(dictado("300 mil del freelance", accts, new Date("2026-09-18T15:00:00Z"), "ingreso")).toMatchObject({ kind: "ingreso", amount: 300_000 });
  });

  it("what it couldn't read goes to En qué", () => {
    expect(dictado("no sé qué compré", accts, new Date("2026-09-18T15:00:00Z"))).toEqual({ kind: "gasto", amount: null, what: "no sé qué compré", accountId: null });
  });
});

describe("anotarPreview and Pagos: paying a bill that's already set aside", () => {
  const rent = {
    id: "rent", label: "Arriendo", amount: 500_000, direction: "OUTFLOW" as const, frequency: "MONTHLY",
    startDate: "2026-09-19", endDate: null, accountId: null, isActive: true,
  };
  it("a spend that matches a pending bill doesn't lower Disponible again", () => {
    expect(anotarPreview({ ...base, templates: [rent], occurrences: [] }, { kind: "gasto", amount: 500_000, accountId: "Bancolombia" }))
      .toEqual({ line: "Pagas Arriendo: ya estaba apartado, tu Disponible no cambia.", tone: "neutral" });
  });
  it("a different amount is a normal spend", () => {
    expect(anotarPreview({ ...base, templates: [rent], occurrences: [] }, { kind: "gasto", amount: 80_000, accountId: "Bancolombia" })?.line)
      .toMatch(/^Te quedan/);
  });
});

describe("yaEsta (Anotar: 'Ya está' before saving a second copy)", () => {
  const t = (id: string, over: Partial<StoredTransaction>): StoredTransaction => ({
    id, accountId: "debit", date: "2026-10-02", amount: 32_000, direction: "OUTFLOW", currencyCode: "COP", flowClass: null, ...over,
  });
  it("finds the bank's email (or the same thing anotado) of that amount, account and day", () => {
    const line = yaEsta([t("e", { description: "IFOOD", captureMethod: "EMAIL_IMPORT", time: "03:26" })], "2026-10-02",
      { kind: "gasto", amount: 32_000, accountId: "debit" });
    expect(line).toBe("Ya está: Ifood −$32.000 · hoy 03:26. ¿Es otro?");
  });
  it("nothing for another amount, account, direction, an ignored one, or two days away", () => {
    const txs = [t("a", { amount: 31_000 }), t("b", { accountId: "cash" }), t("c", { direction: "INFLOW" }), t("d", { isExcluded: true }), t("e", { date: "2026-09-29" })];
    expect(yaEsta(txs, "2026-10-02", { kind: "gasto", amount: 32_000, accountId: "debit" })).toBeNull();
  });
});
