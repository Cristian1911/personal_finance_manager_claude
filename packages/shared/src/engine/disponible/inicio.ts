import { defaultCountsInDisponible } from "../commands/set-account-counts-in-disponible";
import type { CycleSettings, StoredPaySchedule } from "../types";
import { computePayCycle, EARLY_ARRIVAL_DAYS, LATE_ARRIVAL_DAYS, type PayCycle, type PaySchedule } from "./cycle";
import { addDays, colombiaDate, diffDays, type IsoDate } from "./dates";
import { computeDisponible, type DisponibleResult, type ExpectedIncome } from "./disponible";
import { isLiveTransaction, toDisponibleMovements, type OccurrenceLink, type StoredTransaction } from "./movements";
import { computeVerdict, type DisponibleVerdict, type DisponibleVerdictMemo } from "./verdict";
import { disponibleBlockView, type DisponibleBlockView } from "./view";
import { buildInicioWidgets, type CardSummary, type InicioWidget, type PersonOwing } from "./widgets";

/** An account as Inicio needs it; `countsInDisponible` is null when the user never chose. */
export interface InicioAccount {
  id: string;
  accountType: string;
  currentBalance: number;
  countsInDisponible: boolean | null;
}

/**
 * Until the classifier links salaries to recurring income (M2), an inflow of
 * at least this share of the usual income, on a counted account, within the
 * payday window, is taken as the salary. Smaller inflows are "Otros ingresos".
 */
export const SALARY_SHARE_PERCENT = 50;

/** How far back Inicio reads: a cycle is at most a month, plus an early salary. */
export const INICIO_LOOKBACK_DAYS = 70;

/** The first movement date Inicio needs for `today`. */
export const inicioSince = (today: IsoDate): IsoDate => addDays(today, -INICIO_LOOKBACK_DAYS);

export type InicioState =
  | { status: "needs_setup" }
  | {
      status: "ready";
      cycle: PayCycle;
      result: DisponibleResult;
      verdict: DisponibleVerdict;
      view: DisponibleBlockView;
      widgets: InicioWidget[];
    };

const isDebt = (type: string) => type === "CREDIT_CARD" || type === "LOAN";

function toPaySchedule(s: StoredPaySchedule): PaySchedule {
  switch (s.kind) {
    case "semimonthly": return { kind: "semimonthly", days: s.paydays };
    case "monthly": return { kind: "monthly", day: s.paydays[0] };
    case "biweekly": return { kind: "biweekly", anchor: s.anchor };
    case "irregular": return { kind: "irregular" };
  }
}

/**
 * Inicio's Disponible from what the phone stores: settings, accounts and
 * movements in, the block's strings out. Pure (today, now and the verdict
 * memo come in), so the same data gives the same number anywhere.
 * `needs_setup` until the first-run questions are answered: when you get
 * paid, how much (unless irregular) and how much you have today.
 */
export function buildInicio(input: {
  today: IsoDate;
  /** ISO instant, for the verdict's 24 h rule. */
  now: string;
  settings: CycleSettings | null;
  accounts: InicioAccount[];
  transactions: StoredTransaction[];
  holidays?: readonly IsoDate[];
  memo?: DisponibleVerdictMemo | null;
  /** Te deben total: shown beside the number, never added. */
  teDeben?: number;
  /** Who owes you (Te deben widget); none on the phone until people sync (M4). */
  people?: PersonOwing[];
  /** Cards with statement data (one Tarjeta widget each); none on the phone until M2. */
  cards?: CardSummary[];
}): InicioState {
  const { settings, today } = input;
  const schedule = settings?.schedule;
  const irregular = schedule?.kind === "irregular";
  if (!settings || !schedule || !settings.balanceAnchor || (!irregular && settings.incomePerCycle == null)) {
    return { status: "needs_setup" };
  }
  const income = settings.incomePerCycle ?? 0;

  const accounts = input.accounts.map((a) => ({
    id: a.id,
    countsInDisponible: a.countsInDisponible ?? defaultCountsInDisponible(a.accountType),
    isDebt: isDebt(a.accountType),
  }));
  const counted = new Set(accounts.filter((a) => a.countsInDisponible && !a.isDebt).map((a) => a.id));
  const live = input.transactions.filter(isLiveTransaction);

  // Salary candidates: big inflows into counted accounts that aren't classed as something else.
  const big = irregular || income <= 0 ? [] : live.filter((t) =>
    t.direction === "INFLOW" && counted.has(t.accountId)
    && (t.flowClass == null || t.flowClass === "INCOME")
    && t.amount * 100 >= SALARY_SHARE_PERCENT * income);

  const cycle = computePayCycle({
    schedule: toPaySchedule(schedule),
    today,
    holidays: input.holidays,
    salaryArrivals: big.map((t) => t.date),
  });

  // The balance told on the first day opens the cycle it falls in; later cycles start from the salary.
  const told = settings.balanceAnchor;
  const toldOn = colombiaDate(told.at);
  const anchor = toldOn >= cycle.start ? told : undefined;

  const expectedIncomes: ExpectedIncome[] = [];
  const occurrenceLinks: OccurrenceLink[] = [];
  // A salary due on or before the day the balance was told is taken as inside
  // that balance (told on payday, it usually is); if it lands later after all,
  // it counts then as money in, never twice.
  const salaryInsideAnchor = !!anchor && cycle.payday <= toldOn;
  if (income > 0 && !salaryInsideAnchor) {
    const id = `salary:${cycle.payday}`;
    expectedIncomes.push({ id, label: "Salario", amount: income, expectedDate: cycle.payday });
    // The one closest to payday (the bigger on a tie) is this cycle's salary.
    const salary = big
      .filter((t) => t.date >= cycle.start && t.date <= cycle.end
        && t.date >= addDays(cycle.payday, -EARLY_ARRIVAL_DAYS) && t.date <= addDays(cycle.payday, LATE_ARRIVAL_DAYS))
      .sort((a, b) => Math.abs(diffDays(a.date, cycle.payday)) - Math.abs(diffDays(b.date, cycle.payday)) || b.amount - a.amount)[0];
    if (salary) occurrenceLinks.push({ transactionId: salary.id, occurrenceId: id, isIncome: true });
  }

  const movements = toDisponibleMovements({
    transactions: input.transactions,
    accounts: input.accounts,
    occurrenceLinks,
  });

  // Irregular income without that anchor: the counted balance at the month's start,
  // i.e. today's balance minus what moved since.
  let openingBalance: number | undefined;
  if (irregular && !anchor) {
    const now = input.accounts.filter((a) => counted.has(a.id)).reduce((s, a) => s + a.currentBalance, 0);
    const moved = live
      .filter((t) => counted.has(t.accountId) && t.date >= cycle.start)
      .reduce((s, t) => s + (t.direction === "INFLOW" ? t.amount : -t.amount), 0);
    openingBalance = Math.round((now - moved) * 100) / 100;
  }

  const result = computeDisponible({
    cycle, today, accounts, expectedIncomes, movements,
    obligations: [],
    savingsTarget: settings.savingsPerCycle,
    anchor,
    irregular,
    openingBalance,
  });
  const verdict = computeVerdict({
    disponible: result.disponible,
    perDay: result.perDay,
    startingPerDay: result.startingPerDay,
    nextPayday: cycle.nextPayday,
    now: input.now,
    memo: input.memo,
  });
  const view = disponibleBlockView({ result, verdict, today, nextPayday: cycle.nextPayday, teDeben: input.teDeben ?? 0 });
  const widgets = buildInicioWidgets({
    today, cycle, result, movements, counted,
    transactions: input.transactions,
    obligations: [],
    balances: input.accounts.filter((a) => counted.has(a.id)).map((a) => ({ accountId: a.id, balance: a.currentBalance })),
    people: input.people,
    cards: input.cards,
  });
  return { status: "ready", cycle, result, verdict, view, widgets };
}
