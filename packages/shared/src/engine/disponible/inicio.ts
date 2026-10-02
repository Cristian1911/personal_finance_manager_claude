import { defaultCountsInDisponible } from "../commands/set-account-counts-in-disponible";
import type { CycleSettings, StoredPaySchedule } from "../types";
import { computePayCycle, EARLY_ARRIVAL_DAYS, LATE_ARRIVAL_DAYS, type PayCycle, type PaySchedule } from "./cycle";
import { addDays, colombiaDate, diffDays, type IsoDate } from "./dates";
import { computeDisponible, type DisponibleResult, type ExpectedIncome, type Obligation } from "./disponible";
import { isLiveTransaction, toDisponibleMovements, type OccurrenceLink, type StoredTransaction } from "./movements";
import { computeVerdict, type DisponibleVerdict, type DisponibleVerdictMemo } from "./verdict";
import { disponibleBlockView, type DisponibleBlockView } from "./view";
import { disponibleDetailView, type DisponibleDetailView } from "./detail";
import { buildInicioWidgets, flowScreenView, type CardSummary, type FlowScreenTab, type InicioWidget, type InicioWidgetsInput, type PersonOwing } from "./widgets";
import type { InicioTemplate } from "../inicio-read";
import type { OccurrenceRow } from "../types";
import { cycleBills, type BillItem } from "./pagos";

/** An account as Inicio needs it; `countsInDisponible` is null when the user never chose. */
export interface InicioAccount {
  id: string;
  /** Empty for accounts created before names existed (phone schema < 5). */
  name?: string;
  accountType: string;
  institutionName?: string | null;
  mask?: string | null;
  /** Cards: the statement's cut day. */
  cutoffDay?: number | null;
  /** Loans: the cuota. */
  monthlyPayment?: number | null;
  /** Cards and loans: the day the bill or cuota is due. */
  paymentDay?: number | null;
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

/** Cycles Movimientos can step back through (S1-3: the phone keeps the last 3). */
export const MOVIMIENTOS_CYCLES = 3;

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
      /** What the Disponible block opens into. */
      detail: DisponibleDetailView;
      widgets: InicioWidget[];
      /** The Tu flujo screen: Pasado, Este ciclo, Próximo. */
      flow: FlowScreenTab[];
      /** Counted money now: the balance told plus what moved since, else the counted accounts (Mis cuentas' header). */
      balanceToday: number;
      /** What's due this cycle and the next (the Pagos tab). */
      bills: BillItem[];
      /** Movimientos' cycles, newest first: this one and those the phone still holds whole (up to 3, S1-3). */
      cycles: PayCycle[];
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
/** The description Anotar gives "Mi sueldo" (the user's "De qué" goes to notes). */
export const MANUAL_SALARY_DESCRIPTION = "Sueldo";
const MANUAL_SALARY_CHECK = new Set(["MANUAL_FORM", "TEXT_QUICK_CAPTURE"]);

export function buildInicio(input: {
  today: IsoDate;
  /** ISO instant, for the verdict's 24 h rule. */
  now: string;
  settings: CycleSettings | null;
  accounts: InicioAccount[];
  transactions: StoredTransaction[];
  holidays?: readonly IsoDate[];
  memo?: DisponibleVerdictMemo | null;
  /** Who owes you (Te deben widget); none on the phone until people sync (M4). */
  people?: PersonOwing[];
  /** Cards with statement data (one Tarjeta widget each); none on the phone until M2. */
  cards?: CardSummary[];
  /** Pagos fijos and their stored occurrences (Pagos). */
  templates?: InicioTemplate[];
  occurrences?: OccurrenceRow[];
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
    // Written by hand, only Anotar's "Mi sueldo" is a salary: an Ingreso extra or a
    // Me pagaron near payday must add to Disponible, not stand in for the salary.
    // ponytail: matched by its fixed description; a real mark when salaries link to their recurring income.
    && (!t.captureMethod || !MANUAL_SALARY_CHECK.has(t.captureMethod) || t.description === MANUAL_SALARY_DESCRIPTION)
    && t.amount * 100 >= SALARY_SHARE_PERCENT * income);

  const cycleOn = (day: IsoDate) => computePayCycle({
    schedule: toPaySchedule(schedule),
    today: day,
    holidays: input.holidays,
    salaryArrivals: big.map((t) => t.date),
  });
  const cycle = cycleOn(today);

  // The balance told on the first day opens the cycle it falls in; later cycles start from the salary.
  const told = settings.balanceAnchor;
  const toldOn = colombiaDate(told.at);
  const anchor = toldOn >= cycle.start ? told : undefined;

  const expectedIncomes: ExpectedIncome[] = [];
  const occurrenceLinks: OccurrenceLink[] = [];
  // Bills due this cycle and the next (Por pagar now; Tu flujo and Pagos look ahead).
  const nextCycle = cycleOn(addDays(cycle.end, 1));
  const bills = cycleBills({
    from: cycle.start, to: nextCycle.end, templates: input.templates ?? [], occurrences: input.occurrences ?? [],
    accounts: input.accounts, transactions: input.transactions,
    cycleStart: cycle.start, counts: (id) => counted.has(id),
  });
  occurrenceLinks.push(...bills.occurrenceLinks);
  const dueNow = bills.obligations.filter((o) => o.dueDate <= cycle.end);
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
    obligations: dueNow,
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
  const view = disponibleBlockView({ result, verdict, today, nextPayday: cycle.nextPayday, nextIncome: irregular ? 0 : income });
  // Counted money now: the balance told plus what moved since, else the accounts' balances.
  const balanceToday = anchor
    ? Math.round((anchor.balance + movements
      .filter((m) => counted.has(m.accountId) && m.kind !== "ignored"
        && (m.at ? m.at > anchor.at : m.date > toldOn))
      .reduce((s, m) => s + (m.direction === "INFLOW" ? m.amount : -m.amount), 0)) * 100) / 100
    : input.accounts.filter((a) => counted.has(a.id)).reduce((s, a) => s + a.currentBalance, 0);
  const obligations = bills.obligations;
  const widgetsInput: InicioWidgetsInput = {
    today, cycle, result, movements, counted,
    transactions: input.transactions,
    obligations,
    balances: input.accounts.filter((a) => counted.has(a.id)).map((a) => ({ accountId: a.id, balance: a.currentBalance })),
    people: input.people,
    cards: input.cards ?? cardsFrom(input.accounts, obligations, today),
    balanceToday,
    nextIncome: irregular ? 0 : income,
    cycles: { prev: cycleOn(addDays(cycle.start, -1)), next: cycleOn(addDays(cycle.end, 1)) },
  };
  const widgets = buildInicioWidgets(widgetsInput);
  const flow = flowScreenView(widgetsInput);
  const cycles = [cycle];
  while (cycles.length < MOVIMIENTOS_CYCLES) {
    const before = cycleOn(addDays(cycles[cycles.length - 1].start, -1));
    if (before.start < inicioSince(today)) break;
    cycles.push(before);
  }
  const detail = disponibleDetailView({ today, cycle, result, obligations: dueNow, movements, counted, transactions: input.transactions });
  return { status: "ready", cycle, result, verdict, view, detail, widgets, flow, cycles, balanceToday, bills: bills.items };
}

/**
 * The Tarjeta widget's cards, from the accounts and the bills Pagos already
 * computes (D11: the next bill = what was bought in its statement period).
 * Usage, minimum and the at-cut projection come with the statement later.
 */
function cardsFrom(accounts: InicioAccount[], obligations: Obligation[], today: IsoDate): CardSummary[] {
  return accounts.filter((a) => a.accountType === "CREDIT_CARD").map((a) => {
    const bills = obligations.filter((o) => o.accountId === a.id && o.kind === "card_bill").sort((x, y) => x.dueDate.localeCompare(y.dueDate));
    const bill = bills.find((o) => o.dueDate >= today) ?? bills[bills.length - 1];
    return {
      accountId: a.id,
      name: a.name?.trim() || "Tarjeta",
      estimatedBill: bill ? Math.max(0, bill.amount - (bill.paidBefore ?? 0)) : 0,
      cutDate: a.cutoffDay ? nextDay(today, a.cutoffDay) : null,
      dueDate: bill?.dueDate ?? null,
      totalOwed: a.currentBalance,
    };
  });
}

/** The next date (today or later) that falls on `day` of a month, clamped to short months. */
function nextDay(today: IsoDate, day: number): IsoDate {
  let [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  for (let i = 0; i < 2; i++) {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const d = `${y}-${String(m).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
    if (d >= today) return d;
    [y, m] = m === 12 ? [y + 1, 1] : [y, m + 1];
  }
  return today;
}
