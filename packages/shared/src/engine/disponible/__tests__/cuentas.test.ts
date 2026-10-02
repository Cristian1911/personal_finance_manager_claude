import { describe, expect, it } from "vitest";
import { cuentasView } from "../cuentas";
import type { InicioAccount } from "../inicio";

const acc = (over: Partial<InicioAccount> & { id: string; accountType: string }): InicioAccount =>
  ({ name: "", institutionName: null, mask: null, currentBalance: 0, countsInDisponible: null, ...over });

describe("cuentasView (Mis cuentas, S8-4)", () => {
  const accounts = [
    acc({ id: "b", name: "Bancolombia", accountType: "SAVINGS", mask: "4821", currentBalance: 1_320_000 }),
    acc({ id: "e", name: "Efectivo", accountType: "CASH", currentBalance: 200_000 }),
    acc({ id: "nu", name: "Ahorros Nu", accountType: "SAVINGS", currentBalance: 2_400_000, countsInDisponible: false }),
    acc({ id: "t", name: "Tarjeta Nu", accountType: "CREDIT_CARD", mask: "4398", currentBalance: 1_850_000, cutoffDay: 27 }),
    acc({ id: "l", name: "Libre inversión", accountType: "LOAN", institutionName: "Davivienda", currentBalance: 600_000, monthlyPayment: 98_000 }),
  ];

  it("splits money you have from money you owe, and says what counts", () => {
    const v = cuentasView({ accounts });
    // The rows add up: Bancolombia + Efectivo (Ahorros Nu is apart).
    expect(v.counted).toBe("$1.520.000");
    expect(v.apart).toBe("$2.400.000");
    expect(v.owed).toBe("$2.450.000");
    expect(v.cuentas.map((r) => r.id)).toEqual(["b", "e", "nu"]);
    expect(v.deudas.map((r) => r.id)).toEqual(["t", "l"]);
  });

  it("each row says what it is in a few words", () => {
    const v = cuentasView({ accounts });
    expect(v.cuentas[0]).toMatchObject({ title: "Bancolombia", sub: "Ahorros ··4821", amount: "$1.320.000", counts: true, canCount: true });
    expect(v.cuentas[1]).toMatchObject({ sub: "Lo que llevas encima", counts: true });
    expect(v.cuentas[2]).toMatchObject({ sub: "Ahorros · aparte", counts: false });
    expect(v.deudas[0]).toMatchObject({ title: "Tarjeta Nu", sub: "Tarjeta ··4398 · corte el 27", amount: "$1.850.000", canCount: false });
    expect(v.deudas[1]).toMatchObject({ sub: "Davivienda · cuota $98.000" });
  });

  it("an account from before names existed still has a title", () => {
    const v = cuentasView({ accounts: [acc({ id: "x", accountType: "CHECKING" })] });
    expect(v.cuentas[0].title).toBe("Cuenta corriente");
  });

  it("nothing yet: empty lists, no totals to show", () => {
    const v = cuentasView({ accounts: [] });
    expect(v).toMatchObject({ cuentas: [], deudas: [], counted: null, apart: null, owed: null });
  });
});
