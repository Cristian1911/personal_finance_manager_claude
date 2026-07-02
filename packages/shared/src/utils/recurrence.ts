import { addWeeks, addMonths, addYears, format, parseISO, isBefore, isAfter, startOfDay, getDaysInMonth, setDate } from "date-fns";
import type { RecurrenceFrequency } from "../types/domain";

/**
 * BIWEEKLY = quincenal, anchored to two fixed days of the month derived from
 * the start date: D and D+15 when D ≤ 15 (e.g. 15 → {15, 30}), or D−15 and D
 * when D > 15 (e.g. 20 → {5, 20}). The second day clamps to month end in
 * shorter months (30 → Feb 28) but returns to its anchor afterwards.
 *
 * NOT literal 14-day jumps: those drift ~2 days per month, so a quincena that
 * starts on the 15th ends up falling on the 7th within a few months.
 *
 * Mirrors generate_occurrences_for_template() in SQL — keep both in sync.
 */
function quincenalOccurrenceAt(start: Date, k: number): Date {
  const D = start.getDate();
  const dayLow = D <= 15 ? D : D - 15;
  const dayHigh = D <= 15 ? D + 15 : D;
  // Position within the combined low/high series; offset 1 when the series
  // starts on the high day so k=0 still lands exactly on `start`.
  const idx = k + (D <= 15 ? 0 : 1);
  const base = addMonths(start, Math.floor(idx / 2));
  const day = idx % 2 === 0 ? dayLow : dayHigh;
  return setDate(base, Math.min(day, getDaysInMonth(base)));
}

/**
 * Compute the k-th occurrence of a recurring series from its anchor start date.
 * Computing relative to `start` (rather than iteratively from previous occurrence)
 * avoids end-of-month drift — e.g., a series starting Jan 31 stays anchored on
 * the 31st and only clamps in shorter months (Feb 28, Apr 30), not permanently.
 */
function occurrenceAt(start: Date, k: number, frequency: RecurrenceFrequency): Date {
  switch (frequency) {
    case "WEEKLY":
      return addWeeks(start, k);
    case "BIWEEKLY":
      return quincenalOccurrenceAt(start, k);
    case "MONTHLY":
      return addMonths(start, k);
    case "QUARTERLY":
      return addMonths(start, k * 3);
    case "ANNUAL":
      return addYears(start, k);
    case "ONCE":
      return start;
    default: {
      const _exhaustive: never = frequency;
      return _exhaustive;
    }
  }
}

/**
 * Given a recurring template's schedule data, find the next occurrence
 * on or after `fromDate`. Returns null if the template has ended.
 */
export function getNextOccurrence(
  startDate: string,
  frequency: RecurrenceFrequency,
  endDate: string | null,
  fromDate: Date = new Date()
): string | null {
  const from = startOfDay(fromDate);
  const start = startOfDay(parseISO(startDate));
  const end = endDate ? startOfDay(parseISO(endDate)) : null;

  if (end && isBefore(end, from)) return null;

  if (frequency === "ONCE") {
    if (isBefore(start, from)) return null;
    if (end && isAfter(start, end)) return null;
    return format(start, "yyyy-MM-dd");
  }

  let k = 0;
  let current = start;
  while (isBefore(current, from)) {
    k += 1;
    current = occurrenceAt(start, k, frequency);
  }

  if (end && isAfter(current, end)) return null;
  return format(current, "yyyy-MM-dd");
}

/**
 * Get all occurrences between two dates for a recurring template.
 */
export function getOccurrencesBetween(
  startDate: string,
  frequency: RecurrenceFrequency,
  endDate: string | null,
  rangeStart: Date,
  rangeEnd: Date
): string[] {
  const dates: string[] = [];
  const start = startOfDay(parseISO(startDate));
  const end = endDate ? startOfDay(parseISO(endDate)) : null;
  const from = startOfDay(rangeStart);
  const to = startOfDay(rangeEnd);

  if (frequency === "ONCE") {
    if (!isAfter(start, to) && !isBefore(start, from)) {
      if (!end || !isAfter(start, end)) {
        dates.push(format(start, "yyyy-MM-dd"));
      }
    }
    return dates;
  }

  let k = 0;
  let current = start;
  while (isBefore(current, from)) {
    k += 1;
    current = occurrenceAt(start, k, frequency);
  }

  while (!isAfter(current, to)) {
    if (end && isAfter(current, end)) break;
    dates.push(format(current, "yyyy-MM-dd"));
    k += 1;
    current = occurrenceAt(start, k, frequency);
  }

  return dates;
}

/**
 * Human-readable frequency label in Spanish.
 */
export function frequencyLabel(frequency: RecurrenceFrequency): string {
  const labels: Record<RecurrenceFrequency, string> = {
    ONCE: "Una vez",
    WEEKLY: "Semanal",
    BIWEEKLY: "Quincenal",
    MONTHLY: "Mensual",
    QUARTERLY: "Trimestral",
    ANNUAL: "Anual",
  };
  return labels[frequency];
}
