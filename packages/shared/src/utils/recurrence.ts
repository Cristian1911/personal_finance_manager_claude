import { addWeeks, addMonths, addYears, parseISO, isBefore, isAfter, startOfDay } from "date-fns";
import type { RecurrenceFrequency } from "../types/domain";

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
      return addWeeks(start, k * 2);
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
    return start.toISOString().split("T")[0];
  }

  let k = 0;
  let current = start;
  while (isBefore(current, from)) {
    k += 1;
    current = occurrenceAt(start, k, frequency);
  }

  if (end && isAfter(current, end)) return null;
  return current.toISOString().split("T")[0];
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
        dates.push(start.toISOString().split("T")[0]);
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
    dates.push(current.toISOString().split("T")[0]);
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
