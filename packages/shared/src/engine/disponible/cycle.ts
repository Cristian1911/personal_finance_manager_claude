import {
  addDays,
  addMonths,
  clampedDate,
  dayOfWeek,
  daysInMonth,
  diffDays,
  yearMonth,
  type IsoDate,
} from "./dates";

/** When the user gets paid (use case A2). */
export type PaySchedule =
  | { kind: "semimonthly"; days: readonly [number, number] }
  | { kind: "monthly"; day: number }
  /** Every 14 days from a known payday. */
  | { kind: "biweekly"; anchor: IsoDate }
  /** No fixed payday: the cycle is the calendar month. */
  | { kind: "irregular" };

export interface PayCycle {
  start: IsoDate;
  end: IsoDate;
  /** Expected date of the next salary (after weekend/holiday moves); null when irregular. */
  nextPayday: IsoDate | null;
  days: number;
  /** Days left including today. */
  daysLeft: number;
  /** The salary that opens this cycle hasn't been seen: the UI shows "~". */
  startsOnExpectedDate: boolean;
  irregular: boolean;
}

/** A salary seen up to this many days before its payday opens that payday's cycle. */
export const EARLY_ARRIVAL_DAYS = 5;

/** A payday on a weekend or holiday is paid the business day before. */
function businessDayOnOrBefore(d: IsoDate, holidays: ReadonlySet<IsoDate>): IsoDate {
  let day = d;
  while (dayOfWeek(day) === 0 || dayOfWeek(day) === 6 || holidays.has(day)) day = addDays(day, -1);
  return day;
}

/** Nominal paydays around `today`, sorted (enough to find the cycle on both sides). */
function nominalPaydays(schedule: Exclude<PaySchedule, { kind: "irregular" }>, today: IsoDate): IsoDate[] {
  if (schedule.kind === "biweekly") {
    const k = Math.floor(diffDays(schedule.anchor, today) / 14);
    return [-2, -1, 0, 1, 2].map((i) => addDays(schedule.anchor, (k + i) * 14));
  }
  const days = schedule.kind === "monthly" ? [schedule.day] : [...schedule.days];
  const out: IsoDate[] = [];
  for (let m = -2; m <= 2; m++) {
    const ym = addMonths(yearMonth(today), m);
    for (const d of days) out.push(clampedDate(ym.year, ym.month, d));
  }
  return out.sort();
}

/**
 * The pay cycle containing `today`: from a payday to the day before the next.
 * Pure: holidays and seen salary dates come in as input.
 */
export function computePayCycle(input: {
  schedule: PaySchedule;
  today: IsoDate;
  holidays?: readonly IsoDate[];
  /** Dates the salary actually arrived. */
  salaryArrivals?: readonly IsoDate[];
}): PayCycle {
  const { schedule, today } = input;
  if (schedule.kind === "irregular") {
    const { year, month } = yearMonth(today);
    const start = clampedDate(year, month, 1);
    const end = clampedDate(year, month, daysInMonth(year, month));
    return {
      start, end, nextPayday: null,
      days: diffDays(start, end) + 1, daysLeft: diffDays(today, end) + 1,
      startsOnExpectedDate: false, irregular: true,
    };
  }

  const holidays = new Set(input.holidays ?? []);
  const arrivals = input.salaryArrivals ?? [];
  const boundaries = [...new Set(nominalPaydays(schedule, today).map((d) => businessDayOnOrBefore(d, holidays)))]
    .sort()
    .map((expected) => {
      // The earliest arrival in the window opens the cycle.
      const arrival = arrivals
        .filter((a) => a <= expected && diffDays(a, expected) <= EARLY_ARRIVAL_DAYS)
        .sort()[0];
      return { expected, start: arrival ?? expected, arrived: arrival !== undefined };
    });

  let i = 0;
  while (boundaries[i + 1].start <= today) i++;
  const current = boundaries[i];
  const next = boundaries[i + 1];
  const end = addDays(next.start, -1);
  return {
    start: current.start,
    end,
    nextPayday: next.expected,
    days: diffDays(current.start, end) + 1,
    daysLeft: diffDays(today, end) + 1,
    startsOnExpectedDate: !current.arrived,
    irregular: false,
  };
}
