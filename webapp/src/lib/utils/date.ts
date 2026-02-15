import {
  format,
  formatDistanceToNow,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
} from "date-fns";
import { es } from "date-fns/locale";

export function formatDate(date: string | Date, pattern = "dd MMM yyyy"): string {
  const parsed = typeof date === "string" ? parseISO(date) : date;
  return format(parsed, pattern, { locale: es });
}

export function formatRelativeDate(date: string | Date): string {
  const parsed = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(parsed, { addSuffix: true, locale: es });
}

export function toISODateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Parse a "YYYY-MM" string into a Date (1st of that month). Falls back to current month. */
export function parseMonth(month?: string | null): Date {
  if (!month) return startOfMonth(new Date());
  const match = month.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return startOfMonth(new Date());
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

/** Format a Date as "YYYY-MM" */
export function formatMonthParam(date: Date): string {
  return format(date, "yyyy-MM");
}

/** First day of the month as "YYYY-MM-DD" */
export function monthStartStr(date: Date): string {
  return format(startOfMonth(date), "yyyy-MM-dd");
}

/** Last day of the month as "YYYY-MM-DD" */
export function monthEndStr(date: Date): string {
  return format(endOfMonth(date), "yyyy-MM-dd");
}

/** First day of the month N months before the given date, as "YYYY-MM-DD" */
export function monthsBeforeStart(date: Date, n: number): string {
  return format(startOfMonth(subMonths(date, n)), "yyyy-MM-dd");
}

/** Spanish month label, e.g. "febrero 2026" */
export function formatMonthLabel(date: Date): string {
  return format(date, "MMMM yyyy", { locale: es });
}

/** Check if a date falls in the current month */
export function isCurrentMonth(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export { addMonths, subMonths };
