import { describe, expect, it } from "vitest";
import type { PayCycle } from "../cycle";
import { disponibleDetailView } from "../detail";
import { computeDisponible, type DisponibleMovement, type Obligation } from "../disponible";
import { toDisponibleMovements, type StoredTransaction } from "../movements";

// Laura's cycle (15–29 sep), today 18 sep.
const TODAY = "2026-09-18";
const CYCLE: PayCycle = {
  start: "2026-09-15", end: "2026-09-29", payday: "2026-09-15", nextPayday: "2026-09-30",
  days: 15, daysLeft: 12, startsOnExpectedDate: false, irregular: false,
};
const DEBIT = "debit";
const BILLS: Obligation[] = [
  { id: "agua", kind: "bill", label: "Agua", dueDate: "2026-09-16", amount: 60_000 },
  { id: "rent", kind: "bill", label: "Arriendo", dueDate: "2026-09-19", amount: 700_000 },
  { id: "nu", kind: "card_bill", label: "Tarjeta Nu", dueDate: "2026-09-22", amount: 640_000, estimated: true },
  { id: "nf", kind: "bill", label: "Netflix", dueDate: "2026-09-24", amount: 38_900 },
  { id: "gym", kind: "bill", label: "Gimnasio", dueDate: "2026-09-27", amount: 90_000 },
];

let n = 0;
const tx = (date: string, amount: number, over: Partial<StoredTransaction> = {}): StoredTransaction =>
  ({ id: `d${++n}`, accountId: DEBIT, date, amount, direction: "OUTFLOW", currencyCode: "COP", flowClass: null, ...over });

function detail(spends: StoredTransaction[], opts: { payAgua?: boolean; savings?: number; obligations?: Obligation[] } = {}) {
  const salary = tx("2026-09-15", 2_100_000, { direction: "INFLOW" });
  const agua = tx("2026-09-16", 60_000, { description: "Acueducto" });
  const transactions = [salary, ...(opts.payAgua ? [agua] : []), ...spends];
  const movements: DisponibleMovement[] = toDisponibleMovements({ transactions, accounts: [{ id: DEBIT, accountType: "CHECKING" }] })
    .map((m) => m.id === salary.id ? { ...m, kind: "salary" as const, expectedIncomeId: "salary" }
      : m.id === agua.id ? { ...m, kind: "payment" as const, obligationId: "agua" } : m);
  const obligations = opts.obligations ?? BILLS;
  const result = computeDisponible({
    cycle: CYCLE, today: TODAY, accounts: [{ id: DEBIT, countsInDisponible: true }],
    expectedIncomes: [{ id: "salary", label: "Salario", amount: 2_100_000, expectedDate: "2026-09-15" }],
    movements, obligations, savingsTarget: opts.savings ?? 200_000,
  });
  return disponibleDetailView({ today: TODAY, cycle: CYCLE, result, obligations, movements, counted: new Set([DEBIT]), transactions });
}

describe("disponibleDetailView", () => {
  it("title, bar order and the closing row", () => {
    const v = detail([tx("2026-09-17", 100_000, { description: "Éxito" })]);
    expect(v.title).toBe("De tus $2.100.000 de este ciclo");
    expect(v.parts.map((p) => `${p.key}:${p.amount}`)).toEqual([
      "porPagar:$1.528.900", "ahorro:$200.000", "gastado:$100.000", "queda:$271.100",
    ]);
    expect(v.result).toMatchObject({ label: "Te queda", amount: "$271.100", over: false, sub: "$22.500 al día por 12 días" });
    expect(v.scaleEnd).toBe("$2.100.000");
  });

  it("Por pagar: the 3 nearest pending, a paid bill struck through among them, the rest behind 'Ver los N'", () => {
    const p = detail([], { payAgua: true }).parts[0];
    expect(p.sub).toBe("4 pagos antes del 30");
    expect(p.items.map((i) => `${i.title}|${i.detail}|${i.amount}|${i.done ? "pagado" : ""}`)).toEqual([
      "Agua|16 sep|$60.000|pagado",
      "Arriendo|19 sep|$700.000|",
      "Tarjeta Nu|22 sep|≈ $640.000|",
      "Netflix|24 sep|$38.900|",
    ]);
    expect(p.more).toBe("Ver los 4 ›");
  });

  it("Gastado: newest first, 3 shown, the count in the sub line", () => {
    const g = detail([
      tx("2026-09-16", 5_000, { description: "Uber" }),
      tx("2026-09-17", 64_000, { description: "Éxito", createdAt: "2026-09-17T20:00:00.000Z" }),
      tx(TODAY, 8_000, { description: "Tostao", createdAt: "2026-09-18T13:10:00.000Z" }),
      tx(TODAY, 32_000, { description: "Rappi", createdAt: "2026-09-18T17:41:00.000Z" }),
    ]).parts[2];
    expect(g.sub).toBe("4 movimientos desde el 15");
    expect(g.items.map((i) => `${i.title}|${i.detail}`)).toEqual(["Rappi|hoy 12:41", "Tostao|hoy 8:10", "Éxito|ayer 15:00"]);
    expect(g.more).toBe("Ver los 4 ›");
  });

  it("overspent: nothing left in the bar, a red closing row", () => {
    const v = detail([tx("2026-09-17", 700_000)], { obligations: BILLS.slice(1, 3) });
    expect(v.parts.find((p) => p.key === "queda")?.weight).toBe(0);
    expect(v.result).toMatchObject({ label: "Te pasaste", over: true });
    expect(v.result.amount.startsWith("−")).toBe(true);
  });

  it("empty first week: no payments, no savings, nothing spent", () => {
    const v = detail([], { obligations: [], savings: 0 });
    expect(v.parts.map((p) => p.sub)).toEqual(["Nada pendiente", "No apartas nada este ciclo", "Nada todavía", "$175.000 al día por 12 días"]);
  });
});
