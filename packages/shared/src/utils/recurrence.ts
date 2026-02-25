import { addWeeks, addMonths, addYears, parseISO, isBefore, isAfter, startOfDay } from "date-fns";
import type { RecurrenceFrequency } from "../types/domain";

/**
 * Advance a date by one period of the given frequency.
 */
function advanceByFrequency(date: Date, frequency: RecurrenceFrequency): Date {
  switch (frequency) {
    case "WEEKLY":
      return addWeeks(date, 1);
    case "BIWEEKLY":
      return addWeeks(date, 2);
    case "MONTHLY":
      return addMonths(date, 1);
    case "QUARTERLY":
      return addMonths(date, 3);
    case "ANNUAL":
      return addYears(date, 1);
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

  // If end date has passed, no more occurrences
  if (end && isBefore(end, from)) return null;

  let current = start;

  // Advance until we reach or pass fromDate
  while (isBefore(current, from)) {
    current = advanceByFrequency(current, frequency);
  }

  // Check if this occurrence is past the end date
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

  let current = start;

  // Advance to first occurrence on or after rangeStart
  while (isBefore(current, from)) {
    current = advanceByFrequency(current, frequency);
  }

  // Collect all dates within range
  while (!isAfter(current, to)) {
    if (end && isAfter(current, end)) break;
    dates.push(current.toISOString().split("T")[0]);
    current = advanceByFrequency(current, frequency);
  }

  return dates;
}

/**
 * Human-readable frequency label in Spanish.
 */
export function frequencyLabel(frequency: RecurrenceFrequency): string {
  const labels: Record<RecurrenceFrequency, string> = {
    WEEKLY: "Semanal",
    BIWEEKLY: "Quincenal",
    MONTHLY: "Mensual",
    QUARTERLY: "Trimestral",
    ANNUAL: "Anual",
  };
  return labels[frequency];
}
