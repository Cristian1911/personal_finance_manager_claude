/**
 * Calendar-date arithmetic on ISO `YYYY-MM-DD` strings. Works in UTC so a
 * device's time zone can never shift a day (see CLAUDE.md "Date parsing").
 */
export type IsoDate = string;

const DAY_MS = 86_400_000;

function toUtc(d: IsoDate): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The day in Colombia (UTC−5, no daylight saving) of an ISO instant: 8 p.m. on the 18th is still the 18th. */
export function colombiaDate(iso: string): IsoDate {
  return new Date(Date.parse(iso) - 5 * 3_600_000).toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return fromUtc(toUtc(d) + n * DAY_MS);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(d: IsoDate): number {
  return new Date(toUtc(d)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The given day of a month, clamped to its last day (30 → 28 Feb). */
export function clampedDate(year: number, month: number, day: number): IsoDate {
  const d = Math.min(day, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function yearMonth(d: IsoDate): { year: number; month: number } {
  const [year, month] = d.split("-").map(Number);
  return { year, month };
}

export function addMonths(ym: { year: number; month: number }, n: number): { year: number; month: number } {
  const i = ym.year * 12 + (ym.month - 1) + n;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}
