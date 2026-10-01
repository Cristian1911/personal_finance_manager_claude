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

  it("steps back to the last cycle the phone holds", () => {
    const v = view({ index: 1 });
    expect(v.cycle).toBe("Ciclo pasado · 30 ago–14 sep");
    expect([v.canNewer, v.canOlder]).toEqual([true, false]);
    expect(v.groups.map((g) => g.label)).toEqual(["Sáb 5"]);
  });
});

describe("Detalle", () => {
  it("a spend: when, account, counts, note and where it came from", () => {
    expect(detalleView({ today: TODAY, transaction: TXS[1], accounts: ACCOUNTS })).toEqual({
      id: TXS[1].id, initial: "T", title: "Tostao", subtitle: "Hoy 8:15 · Cuenta", amount: "−$8.000", tone: "out",
      counts: { value: "Sí", accountId: "banc", accountToggle: "on" },
      note: "con Ana", source: "Anotado a mano · 18 sep 8:15", excluded: false,
    });
  });

  it("why it doesn't count: ignored, a card, or an account left out", () => {
    const counts = (t: StoredTransaction) => detalleView({ today: TODAY, transaction: t, accounts: ACCOUNTS }).counts;
    expect(counts(TXS[4])).toEqual({ value: "No · lo ignoraste", accountId: "banc", accountToggle: null });
    expect(counts(TXS[2])).toMatchObject({ value: "No · va a la factura", accountToggle: null });
    expect(counts(TXS[6])).toMatchObject({ value: "No · esta cuenta no cuenta", accountToggle: "off" });
    expect(detalleView({ today: TODAY, transaction: TXS[3], accounts: ACCOUNTS }).subtitle).toBe("Ayer 12:41 · Cuenta");
  });
});
