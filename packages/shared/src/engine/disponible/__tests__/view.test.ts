import { describe, expect, it } from "vitest";
import { computeDisponible, type DisponibleInput } from "../disponible";
import { computeVerdict } from "../verdict";
import { cycleLabel, disponibleBlockView, shortMoney } from "../view";

const CYCLE = { start: "2026-09-15", end: "2026-09-29", days: 15, daysLeft: 12 };

function laura(spent: number, over: Partial<DisponibleInput> = {}): DisponibleInput {
  return {
    cycle: CYCLE, today: "2026-09-18",
    accounts: [{ id: "debit", countsInDisponible: true }],
    expectedIncomes: [{ id: "salary", label: "Salario", amount: 2_100_000, expectedDate: "2026-09-15" }],
    movements: [
      { id: "s", accountId: "debit", date: "2026-09-15", amount: 2_100_000, direction: "INFLOW", kind: "salary", expectedIncomeId: "salary" },
      { id: "x", accountId: "debit", date: "2026-09-17", amount: spent, direction: "OUTFLOW", kind: "spend" },
    ],
    obligations: [
      { id: "rent", kind: "bill", label: "Arriendo", dueDate: "2026-09-19", amount: 700_000 },
      { id: "nu", kind: "card_bill", label: "Tarjeta Nu", dueDate: "2026-09-22", amount: 640_000 },
      { id: "nf", kind: "bill", label: "Netflix", dueDate: "2026-09-24", amount: 38_900 },
    ],
    savingsTarget: 200_000,
    ...over,
  };
}

function view(spent: number, extra: { teDeben?: number; over?: Partial<DisponibleInput>; nextPayday?: string | null } = {}) {
  const r = computeDisponible(laura(spent, extra.over));
  const nextPayday = extra.nextPayday === undefined ? "2026-09-30" : extra.nextPayday;
  const v = computeVerdict({
    disponible: r.disponible, perDay: r.perDay, startingPerDay: r.startingPerDay,
    nextPayday, now: "2026-09-18T15:00:00.000Z",
  });
  return disponibleBlockView({ result: r, verdict: v, today: "2026-09-18", nextPayday, teDeben: extra.teDeben ?? 0 });
}

describe("disponibleBlockView — the session-5 prototype lines", () => {
  it("Vas bien: $421.100, $35.000 al día · 12 días, +$180.000 cuando te paguen", () => {
    expect(view(100_000, { teDeben: 180_000 })).toMatchObject({
      state: "vas_bien", pill: "Vas bien", payday: "Te pagan en 12 días",
      amount: "$421.100", perDay: "$35.000 al día · 12 días", sub: "+$180.000 cuando te paguen", approxNote: null,
    });
  });

  it("Cuidado: $271.100, Máximo $22.500 al día para llegar al 30", () => {
    expect(view(250_000, { teDeben: 180_000 })).toMatchObject({
      state: "cuidado", pill: "Cuidado", amount: "$271.100",
      perDay: "Máximo $22.500 al día para llegar al 30", sub: "+$180.000 cuando te paguen",
    });
  });

  it("Te pasaste: −$64.000, Lo restamos del próximo ciclo, Mira en qué se fue ›", () => {
    expect(view(585_100, { teDeben: 180_000 })).toMatchObject({
      state: "te_pasaste", pill: "Te pasaste", amount: "−$64.000",
      perDay: "Lo restamos del próximo ciclo", sub: "Mira en qué se fue ›",
    });
  });

  it("no Te deben: no '+$X cuando te paguen' line", () => {
    expect(view(100_000).sub).toBeNull();
  });

  it("the four lines of 'Así sale tu número'", () => {
    expect(view(100_000).breakdown).toEqual([
      { label: "Te llega este ciclo", amount: "$2.100.000" },
      { label: "− Por pagar", amount: "$1.378.900" },
      { label: "− Ahorro", amount: "$200.000" },
      { label: "− Ya salió", amount: "$100.000" },
    ]);
  });

  it("adjustments show as a fifth line only when there are any", () => {
    expect(view(100_000, { over: { carryOver: -85_000 } }).breakdown.at(-1)).toEqual({ label: "± Ajustes", amount: "−$85.000" });
  });
});

describe("disponibleBlockView — payday, approximations, edge days", () => {
  it.each([
    ["2026-09-18", "Te pagan hoy"],
    ["2026-09-19", "Te pagan mañana"],
    ["2026-09-30", "Te pagan en 12 días"],
  ])("payday %s → %s", (nextPayday, text) => {
    expect(view(100_000, { nextPayday }).payday).toBe(text);
  });

  it("irregular income: the month's days left instead of a payday", () => {
    expect(view(100_000, { nextPayday: null }).payday).toBe("Quedan 12 días del mes");
  });

  it("one day left says 'día'", () => {
    const r = computeDisponible(laura(100_000, { cycle: { ...CYCLE, daysLeft: 1 }, today: "2026-09-29" }));
    const v = computeVerdict({ disponible: r.disponible, perDay: r.perDay, startingPerDay: r.startingPerDay, nextPayday: "2026-09-30", now: "2026-09-29T15:00:00.000Z" });
    expect(disponibleBlockView({ result: r, verdict: v, today: "2026-09-29", nextPayday: "2026-09-30", teDeben: 0 }).perDay).toBe("$421.100 al día · 1 día");
  });

  it("an approximate number gets a '~' and its reason; it's never hidden", () => {
    const v = view(100_000, { over: { movements: laura(100_000).movements.slice(1) } });
    expect(v.amount).toBe("~$421.100");
    expect(v.approxNote).toBe("Tu salario aún no llega");
  });

  it("a bill at risk speaks for itself", () => {
    const r = computeDisponible(laura(100_000));
    const v = computeVerdict({
      disponible: r.disponible, perDay: r.perDay, startingPerDay: r.startingPerDay, nextPayday: "2026-09-30",
      billAtRisk: { label: "Arriendo", dueDate: "2026-09-19" }, now: "2026-09-18T15:00:00.000Z",
    });
    expect(disponibleBlockView({ result: r, verdict: v, today: "2026-09-18", nextPayday: "2026-09-30", teDeben: 0 }).perDay)
      .toBe("Tu saldo no alcanza para Arriendo, que vence el 19.");
  });
});

describe("shortMoney — the fallback when the full amount can't fit at 62%", () => {
  it("shortens millions to one decimal with a comma", () => {
    expect(shortMoney(14_421_100)).toBe("$14,4 M");
    expect(shortMoney(14_350_000)).toBe("$14,4 M");
    expect(shortMoney(3_000_000)).toBe("$3 M");
    expect(shortMoney(1_249_000_000)).toBe("$1.249 M");
    expect(shortMoney(-2_560_000)).toBe("−$2,6 M");
  });

  it("keeps the full amount under a million", () => {
    expect(shortMoney(421_100)).toBe("$421.100");
    expect(shortMoney(-64_000)).toBe("−$64.000");
  });

  it("the view carries both, with the same '~'", () => {
    const v = view(100_000, { over: { movements: laura(100_000).movements.slice(1) } });
    expect(v.amountShort).toBe("~$421.100");
  });
});

describe("cycleLabel", () => {
  it("one month, or both months when it crosses one", () => {
    expect(cycleLabel({ start: "2026-09-15", end: "2026-09-29" })).toBe("Ciclo 15 – 29 sep");
    expect(cycleLabel({ start: "2026-09-30", end: "2026-10-14" })).toBe("Ciclo 30 sep – 14 oct");
    expect(cycleLabel({ start: "2026-12-30", end: "2027-01-14" })).toBe("Ciclo 30 dic – 14 ene");
  });
});
