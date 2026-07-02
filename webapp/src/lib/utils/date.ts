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

/**
 * Format a TIME string (e.g. "14:32" or "14:32:05") as "HH:mm".
 * Returns null when the input is null/empty.
 */
export function formatTime(time: string | null | undefined, pattern = "HH:mm"): string | null {
  if (!time) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const hh = match[1].padStart(2, "0");
  const mm = match[2];
  const ss = match[3] ?? "00";
  // Build a Date in local time so date-fns can format with the requested pattern.
  const ref = new Date();
  ref.setHours(Number(hh), Number(mm), Number(ss), 0);
  return format(ref, pattern, { locale: es });
}

/**
 * Combine a date string (YYYY-MM-DD) and an optional time string (HH:mm[:ss])
 * into a single user-facing label. Falls back to date-only when time is null.
 */
export function formatDateTime(
  date: string | Date,
  time: string | null | undefined,
  pattern = "dd MMM yyyy HH:mm",
): string {
  if (!time) return formatDate(date);
  const datePart = typeof date === "string" ? parseISO(date) : date;
  const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return formatDate(date);
  datePart.setHours(Number(match[1]), Number(match[2]), Number(match[3] ?? "0"), 0);
  return format(datePart, pattern, { locale: es });
}

export function formatRelativeDate(date: string | Date): string {
  const parsed = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(parsed, { addSuffix: true, locale: es });
}

export function toISODateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Format a Date as "YYYY-MM-DD" in Colombia timezone (America/Bogota, UTC-5).
 * Transaction dates from Colombian banks are always in local time, so server-side
 * "today" comparisons must use Colombian time — not the server's system timezone
 * (UTC in Docker containers).
 */
export function toColombiaDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

/**
 * Format a Date as "HH:mm" (24h) in Colombia timezone (America/Bogota, UTC-5).
 * Transaction times are Colombian local time, so "now" defaults must use
 * Colombian time — not the device's system timezone (which may differ) nor UTC
 * (`toTimeString()`/`toISOString()` both drift from the intended local clock).
 */
export function toColombiaTimeString(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    timeZone: "America/Bogota",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get the day-of-month in Colombia timezone.
 * Used for daysRemaining calculations that must match Colombian calendar day.
 */
export function getColombiaDayOfMonth(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", day: "numeric" }).format(date)
  );
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

/** Short Spanish month label, e.g. "Abr" (no year) */
export function formatMonthLabelShort(date: Date): string {
  return format(date, "MMM", { locale: es });
}

/** Check if a date falls in the current month */
export function isCurrentMonth(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

/** Number of days remaining in the given month. Returns full month length for past/future months. */
export function getDaysRemainingInMonth(date: Date): number {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const today = new Date();
  if (date.getMonth() !== today.getMonth() || date.getFullYear() !== today.getFullYear()) {
    return lastDay;
  }
  return Math.max(0, lastDay - today.getDate());
}

/** Relative past label in Spanish: "Hoy", "Hace 1 día", "Hace N días" */
export function daysAgoLabel(dateStr: string): string {
  const due = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((now.getTime() - due.getTime()) / 86_400_000);
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Hace 1 día";
  return `Hace ${diff} días`;
}

/** Relative future label in Spanish: "Hoy", "Mañana", "En N días" */
export function daysUntilLabel(dateStr: string): string {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((target.getTime() - now.getTime()) / 86_400_000);
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return `En ${diff} días`;
}

export { addMonths, subMonths };
