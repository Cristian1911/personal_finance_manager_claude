/**
 * Local-timezone date formatting utilities.
 *
 * Never use `new Date().toISOString().slice(0, 10)` — it returns UTC,
 * which is wrong for Colombia (UTC-5). These helpers use local date
 * components so "today" means today in the user's timezone.
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
