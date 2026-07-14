import { OCCURRENCE_AUTO_LINK_DAY_WINDOW } from "@zeta/shared";

/**
 * Pairing between planner entries and recurring occurrences.
 *
 * The durable link is `planning_entries.occurrence_id` — a direct FK to the
 * `recurring_occurrences` row the entry tracks, written at seed time and
 * backfilled by migration. Display then reads the occurrence's status through
 * the join: no inference, and every mutation of the occurrence (paid via
 * email auto-link, PDF import, manual payment, skip) is visible to Plan
 * automatically.
 *
 * This module is the FALLBACK for rows that don't carry the FK yet: legacy
 * entries beyond the backfill, rows created by an older mobile app, or
 * entries whose occurrence was pruned (FK is ON DELETE SET NULL). It pairs
 * them by date proximity — exact date first, then nearest within the shared
 * auto-link window (±3 days) — so planner pairing can never be more
 * aggressive than transaction↔occurrence auto-linking. Quincenal dates are
 * ≥14 days apart and weekly dates 7 apart, so the window can never
 * cross-match two occurrences of one template.
 *
 * Why entries drift from occurrence dates at all: entries snapshot the
 * schedule at sync time, while `recurring_occurrences` self-heals to the
 * template's current schedule (prune + regenerate). A schedule change between
 * the two materializations (template edit, generator fix — e.g. quincenal
 * 14-day → month-anchored) strands the entry a few days away from its
 * occurrence.
 */

const MS_PER_DAY = 86_400_000;

/** Absolute distance in days between two YYYY-MM-DD dates (UTC arithmetic —
 *  plain calendar dates, no timezone involved). */
function daysBetween(a: string, b: string): number {
  return (
    Math.abs(
      new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()
    ) / MS_PER_DAY
  );
}

export interface PlanReconcilableEntry {
  id: string;
  recurring_template_id: string | null;
  expected_date: string; // YYYY-MM-DD
}

export interface PairableOccurrence {
  id: string;
  template_id: string;
  occurrence_date: string; // YYYY-MM-DD
  /** occurrence_status enum: pending | paid | skipped. */
  status: string;
}

interface ClaimableOccurrence {
  occurrence: PairableOccurrence;
  used: boolean;
}

/**
 * Pair each recurring planner entry with an occurrence of its template.
 * Exact-date matches claim their occurrence first; remaining entries then
 * take the nearest unclaimed occurrence within the ±3-day window. Each
 * occurrence pairs with at most one entry, so one payment can never settle
 * two entries.
 *
 * Callers decide what the pairing means: display reads the paired
 * occurrence's status; the sync self-heal persists it as `occurrence_id` and
 * adopts the occurrence's date.
 *
 * Returns entry id → paired occurrence.
 */
export function pairOccurrencesToEntries(
  entries: PlanReconcilableEntry[],
  occurrences: PairableOccurrence[]
): Map<string, PairableOccurrence> {
  const result = new Map<string, PairableOccurrence>();

  const byTemplate = new Map<string, ClaimableOccurrence[]>();
  for (const occ of occurrences) {
    const list = byTemplate.get(occ.template_id) ?? [];
    list.push({ occurrence: occ, used: false });
    byTemplate.set(occ.template_id, list);
  }
  for (const list of byTemplate.values()) {
    list.sort((a, b) =>
      a.occurrence.occurrence_date.localeCompare(b.occurrence.occurrence_date)
    );
  }

  // Date order keeps the greedy nearest-match pass deterministic regardless of
  // the entries' fetch order.
  const recurringEntries = entries
    .filter((e) => e.recurring_template_id != null)
    .sort((a, b) => a.expected_date.localeCompare(b.expected_date));

  const unmatched: PlanReconcilableEntry[] = [];
  for (const entry of recurringEntries) {
    const list = byTemplate.get(entry.recurring_template_id!);
    const exact = list?.find(
      (o) => !o.used && o.occurrence.occurrence_date === entry.expected_date
    );
    if (exact) {
      exact.used = true;
      result.set(entry.id, exact.occurrence);
    } else {
      unmatched.push(entry);
    }
  }

  for (const entry of unmatched) {
    const list = byTemplate.get(entry.recurring_template_id!);
    if (!list) continue;
    let best: ClaimableOccurrence | null = null;
    let bestDiff = Infinity;
    for (const claimable of list) {
      if (claimable.used) continue;
      const diff = daysBetween(
        claimable.occurrence.occurrence_date,
        entry.expected_date
      );
      if (diff <= OCCURRENCE_AUTO_LINK_DAY_WINDOW && diff < bestDiff) {
        best = claimable;
        bestDiff = diff;
      }
    }
    if (best) {
      best.used = true;
      result.set(entry.id, best.occurrence);
    }
  }

  return result;
}
