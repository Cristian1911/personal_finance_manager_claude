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

/**
 * IDs of existing occurrence rows whose date the template's current schedule
 * no longer produces. Schedule edits and generator-logic changes (e.g. the
 * quincenal 14-day → month-anchored fix) leave orphaned pending rows behind —
 * ON CONFLICT DO NOTHING inserts never remove them, so the user sees duplicate
 * upcoming payments (e.g. Nómina on Jul 29 AND Jul 30).
 *
 * `existing` must already be restricted to prunable rows: status = pending,
 * transaction_id IS NULL, non-MONTHLY templates (MONTHLY keeps one occurrence
 * per month whose day may legitimately drift via statement imports), and dates
 * within the same range `expectedRows` was generated for.
 */
export function computeStaleOccurrenceIds(
  expectedRows: OccurrenceRow[],
  existing: Array<{ id: string; template_id: string; occurrence_date: string }>,
): string[] {
  const expected = new Map<string, Set<string>>();
  for (const row of expectedRows) {
    let dates = expected.get(row.template_id);
    if (!dates) {
      dates = new Set();
      expected.set(row.template_id, dates);
    }
    dates.add(row.occurrence_date);
  }
  return existing
    .filter((o) => !expected.get(o.template_id)?.has(o.occurrence_date))
    .map((o) => o.id);
}
