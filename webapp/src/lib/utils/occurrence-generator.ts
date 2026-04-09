import { getOccurrencesBetween } from "@zeta/shared";
import type { RecurrenceFrequency } from "@zeta/shared";

export interface OccurrenceRow {
  template_id: string;
  user_id: string;
  occurrence_date: string; // YYYY-MM-DD
  expected_amount: number;
}

interface TemplateForGeneration {
  id: string;
  user_id: string;
  amount: number;
  start_date: string;
  frequency: RecurrenceFrequency;
  end_date: string | null;
  is_active: boolean;
}

export function generateOccurrenceRows(
  template: TemplateForGeneration,
  rangeStart: Date,
  rangeEnd: Date,
): OccurrenceRow[] {
  if (!template.is_active) return [];
  const dates = getOccurrencesBetween(
    template.start_date,
    template.frequency,
    template.end_date,
    rangeStart,
    rangeEnd,
  );
  return dates.map((date) => ({
    template_id: template.id,
    user_id: template.user_id,
    occurrence_date: date,
    expected_amount: template.amount,
  }));
}

export function generateOccurrenceRowsBatch(
  templates: TemplateForGeneration[],
  rangeStart: Date,
  rangeEnd: Date,
): OccurrenceRow[] {
  return templates.flatMap((t) => generateOccurrenceRows(t, rangeStart, rangeEnd));
}
