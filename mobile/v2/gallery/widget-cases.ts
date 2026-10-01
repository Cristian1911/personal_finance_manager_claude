import {
  buildInicioWidgets,
  computeDisponible,
  toDisponibleMovements,
  type CardSummary,
  type InicioWidget,
  type Obligation,
  type PayCycle,
  type PersonOwing,
  type StoredTransaction,
} from "@zeta/shared";

/**
 * Gallery data cases for the first six Inicio widgets (13 §Testing): normal,
 * empty (first week), long values, negative, amber, red — computed by the
 * real @zeta/shared functions from Laura's session-3 cycle (15–29 sep,
 * today 18 sep).
 */
const TODAY = "2026-09-18";
const CYCLE: PayCycle = {
  start: "2026-09-15", end: "2026-09-29", payday: "2026-09-15", nextPayday: "2026-09-30",
  days: 15, daysLeft: 12, startsOnExpectedDate: false, irregular: false,
};
const DEBIT = "debit";
const BILLS: Obligation[] = [
  { id: "rent", kind: "bill", label: "Arriendo", dueDate: "2026-09-19", amount: 700_000 },
  { id: "nu", kind: "card_bill", label: "Tarjeta Nu · mínimo", dueDate: "2026-09-22", amount: 640_000, estimated: true },
  { id: "nf", kind: "bill", label: "Netflix", dueDate: "2026-09-24", amount: 38_900 },
];
const LATER_BILLS: Obligation[] = BILLS.map((b) => ({ ...b, dueDate: b.dueDate.replace("-09-19", "-09-26") }));

let n = 0;
const tx = (date: string, amount: number, description: string, at?: string, direction: "INFLOW" | "OUTFLOW" = "OUTFLOW"): StoredTransaction => ({
  id: `g${++n}`, accountId: DEBIT, date, amount, direction, currencyCode: "COP", flowClass: null, description,
  createdAt: at ? `${date}T${at}:00.000Z` : null,
});

function widgets(c: {
  income?: number;
  spends: StoredTransaction[];
  obligations?: Obligation[];
  balance?: number;
  people?: PersonOwing[];
  cards?: CardSummary[];
}): InicioWidget[] {
  const income = c.income ?? 2_100_000;
  const salary = tx("2026-09-15", income, "Nómina", "13:00", "INFLOW");
  const transactions = [salary, ...c.spends];
  const movements = toDisponibleMovements({ transactions, accounts: [{ id: DEBIT, accountType: "CHECKING" }] })
    .map((m) => (m.id === salary.id ? { ...m, kind: "salary" as const, expectedIncomeId: "salary" } : m));
  const obligations = c.obligations ?? BILLS;
  const result = computeDisponible({
    cycle: CYCLE, today: TODAY,
    accounts: [{ id: DEBIT, countsInDisponible: true }],
    expectedIncomes: [{ id: "salary", label: "Salario", amount: income, expectedDate: "2026-09-15" }],
    movements, obligations, savingsTarget: 200_000,
  });
  return buildInicioWidgets({
    today: TODAY, cycle: CYCLE, result, movements, counted: new Set([DEBIT]), transactions, obligations,
    balances: [{ accountId: DEBIT, balance: c.balance ?? 2_000_000 }],
    people: c.people, cards: c.cards,
    youOwe: [{ name: "Mateo", amount: 50_000 }],
  });
}

const people = (oldest: string): PersonOwing[] => [
  { id: "j", name: "Juan", amount: 180_000, since: oldest },
  { id: "c", name: "Caro", amount: 140_000, since: "2026-09-06" },
  { id: "a", name: "Ana", amount: 60_000, since: "2026-09-15" },
];
const card = (over: Partial<CardSummary> = {}): CardSummary => ({
  accountId: "nu", name: "Tarjeta Nu", estimatedBill: 480_000, projectedAtCut: 620_000, usedPercent: 37,
  cutDate: "2026-09-27", dueDate: "2026-10-05", minimum: 640_000, totalOwed: 1_850_000, ...over,
});
const day = (spentBefore: number, spentToday: number) => [
  tx("2026-09-17", spentBefore, "Éxito", "20:00"),
  tx(TODAY, Math.round(spentToday * 0.25), "Tostao", "13:10"),
  tx(TODAY, spentToday - Math.round(spentToday * 0.25), "Rappi", "17:41"),
];

export const WIDGET_CASES: { key: string; title: string; widgets: InicioWidget[] }[] = [
  {
    key: "normal", title: "Normal",
    widgets: widgets({ spends: day(87_000, 13_000), obligations: LATER_BILLS, people: people("2026-09-10"), cards: [card()] }),
  },
  {
    key: "amber", title: "Ámbar",
    widgets: widgets({ spends: day(67_000, 33_000), people: people("2026-08-15"), cards: [card({ cutDate: "2026-09-20" })] }),
  },
  {
    key: "red", title: "Rojo",
    widgets: widgets({
      spends: day(359_000, 41_000), balance: 500_000, people: people("2026-07-20"),
      cards: [card({ dueDate: TODAY, cutDate: "2026-09-10" })],
    }),
  },
  { key: "empty", title: "Primera semana (sin datos)", widgets: widgets({ spends: [], obligations: [] }) },
  {
    key: "long", title: "Montos largos",
    widgets: widgets({
      income: 16_000_000, spends: day(1_200_000, 950_000), obligations: LATER_BILLS,
      people: [{ id: "x", name: "Xiomara", amount: 14_250_000, since: "2026-09-10" }],
      cards: [card({ estimatedBill: 14_250_000, projectedAtCut: 15_100_000, totalOwed: 24_100_000 })],
    }),
  },
  { key: "negative", title: "Negativo", widgets: widgets({ spends: day(560_000, 60_000), obligations: LATER_BILLS }) },
];
