import { COLOMBIA_TIMEZONE, formatWallTime } from "@zeta/shared";

/**
 * Date formatting utilities.
 *
 * Never use `new Date().toISOString().slice(0, 10)` — it returns UTC,
 * which is wrong for Colombia (UTC-5).
 *
 * Two families live here on purpose:
 * - `toLocal*` — the device clock. Use for UI that should follow the phone
 *   (month selectors, "today" chips).
 * - `toColombia*` — the Colombian wall clock, which is what every
 *   `transaction_date` / `transaction_time` is stored in (bank statements
 *   report in that clock and the webapp assumes it). Use for record
 *   defaults; when the phone is abroad the two differ, and the capture flow
 *   converts explicitly (see `lib/travel-context.ts`).
 */

/** "YYYY-MM-DD" in local timezone */
export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM" in local timezone */
export function toLocalMonthString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** "YYYY-MM-DD" in Colombia (America/Bogota), regardless of the phone's zone. */
export function toColombiaDateString(date: Date = new Date()): string {
  return formatWallTime(date, COLOMBIA_TIMEZONE).date;
}

/**
 * "HH:mm:00" in Colombia. PostgreSQL TIME wants seconds, so the stored shape
 * is always HH:mm:ss — keep that here so callers don't re-append it.
 */
export function toColombiaTimeString(date: Date = new Date()): string {
  return `${formatWallTime(date, COLOMBIA_TIMEZONE).time}:00`;
}
