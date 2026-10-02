import { describe, expect, it } from "vitest";
import type { PayCycle } from "../cycle";
import type { InicioAccount } from "../inicio";
import type { StoredTransaction } from "../movements";
import { detalleView, movimientosView } from "../movimientos";

const TODAY = "2026-09-18";
const cyc = (start: string, end: string): PayCycle => ({
  start, end, payday: start, nextPayday: null, days: 15, daysLeft: 0, startsOnExpectedDate: false, irregular: false,
});
const CYCLES = [cyc("2026-09-15", "2026-09-29"), cyc("2026-08-30", "2026-09-14")];
const ACCOUNTS: InicioAccount[] = [
  { id: "banc", accountType: "CHECKING", currentBalance: 0, countsInDisponible: null },
  { id: "nu", accountType: "CREDIT_CARD", currentBalance: 0, countsInDisponible: null },
  { id: "aparte", accountType: "SAVINGS", currentBalance: 0, countsInDisponible: false },
];
let n = 0;
const tx = (date: string, amount: number, description: string | null, over: Partial<StoredTransaction> = {}): StoredTransaction => ({
  id: `t${++n}`, accountId: "banc", date, amount, direction: "OUTFLOW", currencyCode: "COP", flowClass: null,
  description, captureMethod: "MANUAL_FORM", createdAt: `${date}T17:41:00.000Z`, ...over,
});
const TXS = [
  tx("2026-09-18", 32_000, "Rappi"),
  tx("2026-09-18", 8_000, "Tostao", { createdAt: "2026-09-18T13:15:00.000Z", notes: "con Ana" }),
  tx("2026-09-18", 5_000, "Uber", { accountId: "nu", createdAt: "2026-09-18T12:52:00.000Z" }),
  tx("2026-09-17", 64_000, "Éxito"),
  tx("2026-09-17", 45_000, "Caro", { isExcluded: true }),
  tx("2026-09-15", 2_100_000, "Salario", { direction: "INFLOW" }),
  tx("2026-09-15", 200_000, null, { accountId: "aparte", direction: "INFLOW" }),
  tx("2026-09-05", 50_000, "Arriendo parqueadero"),
];
const view = (over: Partial<Parameters<typeof movimientosView>[0]> = {}) =>
  movimientosView({ today: TODAY, transactions: TXS, accounts: ACCOUNTS, cycles: CYCLES, index: 0, filter: "todos", query: "", ...over });

describe("Movimientos", () => {
  it("this cycle by day, newest first, with each day's total counting only what counts", () => {
    const v = view();
    expect(v.cycle).toBe("Este ciclo · 15–29 sep");
    expect([v.canNewer, v.canOlder]).toEqual([false, true]);
    expect(v.groups.map((g) => `${g.label}|${g.total}`)).toEqual([
      "Hoy · vie 18|−$45.000", "Ayer · jue 17|−$64.000", "Mar 15|+$2.100.000",
    ]);
    expect(v.groups[0].rows.map((r) => `${r.title}|${r.amount}|${r.tone}|${r.time}|${r.account}`)).toEqual([
      "Rappi|−$32.000|out|12:41|Cuenta", "Tostao|−$8.000|out|8:15|Cuenta", "Uber|−$5.000|card|7:52|Tarjeta",
    ]);
    const row = (title: string) => v.groups.flatMap((g) => g.rows).find((r) => r.title === title);
    expect(row("Caro")).toMatchObject({ title: "Caro", amount: "$45.000", tone: "neutral", status: "Ignorado" });
    expect(row("Entrada")).toMatchObject({ title: "Entrada", initial: "E", tone: "neutral", status: "No cuenta", account: "Ahorros" });
    expect(v.groups[0].rows[0].spoken).toBe("Rappi, menos $32.000, 12:41, Cuenta");
  });

  it("filters and searches (accents and notes too)", () => {
    expect(view({ filter: "entradas" }).groups.flatMap((g) => g.rows.map((r) => r.title))).toEqual(["Entrada", "Salario"]);
    expect(view({ filter: "tarjetas" }).groups.flatMap((g) => g.rows.map((r) => r.title))).toEqual(["Uber"]);
    expect(view({ query: "exito" }).groups.flatMap((g) => g.rows.map((r) => r.title))).toEqual(["Éxito"]);
    expect(view({ query: "ana" }).groups.flatMap((g) => g.rows.map((r) => r.title))).toEqual(["Tostao"]);
    expect(view({ query: "zz" }).empty).toBe("Nada con «zz».");
    expect(view({ filter: "tarjetas", index: 1 }).empty).toBe("Nada con ese filtro en este ciclo.");
  });

  it("one account's movements (Cuenta › Ver todos), with a chip to remove the filter", () => {
    const v = view({ accountId: "nu", accounts: [...ACCOUNTS.slice(0, 1), { ...ACCOUNTS[1], name: "Tarjeta Nu" }, ACCOUNTS[2]] });
    expect(v.groups.flatMap((g) => g.rows.map((r) => r.title))).toEqual(["Uber"]);
    expect(v.account).toEqual({ id: "nu", label: "Tarjeta Nu" });
    expect(v.groups[0].rows[0].account).toBe("Tarjeta Nu");
    expect(view().account).toBeNull();
  });

  it("a movement shows its destinatario's name and its category; search finds both", () => {
    const rappi = { id: "d-rappi", name: "Rappi", kind: "merchant" as const };
    const txs = [tx("2026-09-18", 32_000, "COMPRA RAPPI COLOMBIA", { destinatarioId: "d-rappi", categoryId: "c2000000-0000-4000-8000-000000000003" })];
    const v = view({ transactions: txs, destinatarios: [rappi] });
    expect(v.groups[0].rows[0]).toMatchObject({ title: "Rappi", category: "Domicilios", categoryId: "c2000000-0000-4000-8000-000000000003", destinatario: rappi });
    expect(view({ transactions: txs, destinatarios: [rappi], query: "domicil" }).groups).toHaveLength(1);
  });

  it("steps back to the last cycle the phone holds", () => {
    const v = view({ index: 1 });
    expect(v.cycle).toBe("Ciclo pasado · 30 ago–14 sep");
    expect([v.canNewer, v.canOlder]).toEqual([true, false]);
    expect(v.groups.map((g) => g.label)).toEqual(["Sáb 5"]);
  });
});

describe("Detalle", () => {
  const view = (t: StoredTransaction) => detalleView({ today: TODAY, transaction: t, accounts: ACCOUNTS });

  it("a manual spend: source, facts, editable, counts (no status)", () => {
    expect(view(TXS[1])).toEqual({
      id: TXS[1].id, initial: "T", title: "Tostao", amount: "−$8.000", tone: "out",
      source: "manual", facts: "A mano · hoy 8:15 · Cuenta", status: null,
      note: "con Ana", excluded: false, manual: true, raw: { amount: 8000, date: "2026-09-18" },
    });
  });

  it("a bank movement can't be fixed or deleted, and says where it came from", () => {
    const bank = { ...TXS[0], captureMethod: "EMAIL_IMPORT" };
    expect(view(bank)).toMatchObject({ source: "email", facts: "Correo · hoy 12:41 · Cuenta", manual: false });
  });

  it("says why it doesn't count", () => {
    expect(view(TXS[4]).status).toBe("No cuenta · lo ignoraste");
    expect(view(TXS[2]).status).toBe("No cuenta · va a la factura");
    expect(view(TXS[6]).status).toBe("No cuenta · esa cuenta está aparte");
    expect(view(TXS[3]).facts).toBe("A mano · ayer 12:41 · Cuenta");
  });
});
