import {
  computeDisponible,
  computeVerdict,
  disponibleBlockView,
  type DisponibleBlockView,
  type DisponibleInput,
} from "@zeta/shared";

/**
 * Gallery data cases for the Disponible block, computed by the real engine
 * from Laura's session-3 cycle (15–29 sep, today 18 sep): normal, Cuidado,
 * Te pasaste, approximate, long values, a value too long even at 62% (shown
 * shortened), first week (empty).
 */
const CYCLE = { start: "2026-09-15", end: "2026-09-29", days: 15, daysLeft: 12 };
const TODAY = "2026-09-18";
const NOW = "2026-09-18T15:00:00.000Z";

function laura(spent: number, over: Partial<DisponibleInput> = {}): DisponibleInput {
  return {
    cycle: CYCLE, today: TODAY,
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

function build(input: DisponibleInput, teDeben: number, nextPayday: string | null = "2026-09-30"): DisponibleBlockView {
  const r = computeDisponible(input);
  const v = computeVerdict({ disponible: r.disponible, perDay: r.perDay, startingPerDay: r.startingPerDay, nextPayday, now: NOW });
  return disponibleBlockView({ result: r, verdict: v, today: TODAY, nextPayday, teDeben });
}

export const DISPONIBLE_CASES: { key: string; title: string; view: DisponibleBlockView }[] = [
  { key: "ok", title: "Vas bien", view: build(laura(100_000), 180_000) },
  { key: "warn", title: "Cuidado", view: build(laura(250_000), 180_000) },
  { key: "bad", title: "Te pasaste", view: build(laura(585_100), 180_000) },
  {
    key: "approx", title: "Salario sin confirmar (~)",
    view: build(laura(100_000, { movements: laura(100_000).movements.slice(1) }), 0),
  },
  {
    key: "long", title: "Monto largo",
    view: build(laura(100_000, {
      expectedIncomes: [{ id: "salary", label: "Salario", amount: 16_000_000, expectedDate: "2026-09-15" }],
      movements: [{ id: "s", accountId: "debit", date: "2026-09-15", amount: 16_000_000, direction: "INFLOW", kind: "salary", expectedIncomeId: "salary" }],
    }), 1_250_000),
  },
  {
    key: "huge", title: "Monto que no cabe (se acorta)",
    view: build(laura(100_000, {
      expectedIncomes: [{ id: "salary", label: "Salario", amount: 240_100_000_000, expectedDate: "2026-09-15" }],
      movements: [{ id: "s", accountId: "debit", date: "2026-09-15", amount: 240_100_000_000, direction: "INFLOW", kind: "salary", expectedIncomeId: "salary" }],
    }), 0),
  },
  {
    key: "empty", title: "Primera semana (sin datos)",
    view: build({ ...laura(0), movements: [], expectedIncomes: [], obligations: [], savingsTarget: 0 }, 0),
  },
  { key: "irregular", title: "Ingreso irregular", view: build(laura(100_000), 0, null) },
];
