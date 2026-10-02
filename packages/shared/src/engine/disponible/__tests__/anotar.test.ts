import { describe, expect, it } from "vitest";
import type { CycleSettings } from "../../types";
import { anotarPreview } from "../anotar";
import type { InicioAccount } from "../inicio";

// Semimonthly 15/30; $1.500.000 told on the 16th; today the 18th (12 days left).
const settings: CycleSettings = {
  schedule: { kind: "semimonthly", paydays: [15, 30] }, incomePerCycle: 2_100_000, savingsPerCycle: 0,
  balanceAnchor: { balance: 1_500_000, at: "2026-09-16T14:00:00.000Z" }, bigPurchaseThreshold: 300_000,
};
const acc = (id: string, accountType: string, over: Partial<InicioAccount> = {}): InicioAccount =>
  ({ id, name: id, accountType, currentBalance: 0, countsInDisponible: null, ...over });
const accounts = [acc("Bancolombia", "SAVINGS"), acc("Ahorros Nu", "SAVINGS", { countsInDisponible: false }), acc("Tarjeta Nu", "CREDIT_CARD")];
const base = { today: "2026-09-18", now: "2026-09-18T15:00:00.000Z", settings, accounts, transactions: [] };

describe("anotarPreview (the effect line while you type, S8-9)", () => {
  it("a spend from a counted account: what's left and per day", () => {
    expect(anotarPreview(base, { kind: "gasto", amount: 120_000, accountId: "Bancolombia" }))
      .toEqual({ line: "Te quedan $1.380.000 · $115.000 al día · 12 días", tone: "neutral" });
  });

  it("more than you have left warns", () => {
    expect(anotarPreview(base, { kind: "gasto", amount: 1_600_000, accountId: "Bancolombia" }).tone).toBe("bad");
  });

  it("on a card it doesn't move Disponible now: the bill does", () => {
    expect(anotarPreview(base, { kind: "gasto", amount: 50_000, accountId: "Tarjeta Nu" }).line)
      .toBe("Va a Tarjeta Nu: tu Disponible no cambia hoy, lo pagas con la factura.");
  });

  it("from an account apart, nothing changes", () => {
    expect(anotarPreview(base, { kind: "gasto", amount: 50_000, accountId: "Ahorros Nu" }).line)
      .toBe("Ahorros Nu no cuenta para tu Disponible: no cambia.");
  });

  it("an income raises it", () => {
    expect(anotarPreview(base, { kind: "ingreso", amount: 300_000, accountId: "Bancolombia" }).line)
      .toBe("Tu Disponible sube a $1.800.000");
  });

  it("between two counted accounts nothing changes; to one apart it goes down; to a card it's a payment", () => {
    const counted2 = [...accounts, acc("Nequi", "SAVINGS")];
    expect(anotarPreview({ ...base, accounts: counted2 }, { kind: "entre", amount: 100_000, accountId: "Bancolombia", toAccountId: "Nequi" }).line)
      .toBe("Las dos cuentan para tu Disponible: no cambia.");
    expect(anotarPreview(base, { kind: "entre", amount: 200_000, accountId: "Bancolombia", toAccountId: "Ahorros Nu" }).line)
      .toBe("Ahorros Nu no cuenta para tu Disponible: baja a $1.300.000.");
    expect(anotarPreview(base, { kind: "entre", amount: 200_000, accountId: "Bancolombia", toAccountId: "Tarjeta Nu" }).line)
      .toBe("Pagas Tarjeta Nu: tu Disponible baja a $1.300.000.");
  });

  it("nothing to say without an amount or before the first-run questions", () => {
    expect(anotarPreview(base, { kind: "gasto", amount: 0, accountId: "Bancolombia" })).toBeNull();
    expect(anotarPreview({ ...base, settings: null }, { kind: "gasto", amount: 10, accountId: "Bancolombia" })).toBeNull();
  });
});
