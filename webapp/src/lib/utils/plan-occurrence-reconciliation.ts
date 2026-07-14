import { OCCURRENCE_AUTO_LINK_DAY_WINDOW } from "@zeta/shared";

/**
 * Reconciliation between planner entries and recurring occurrences.
 *
 * Planner entries snapshot the template schedule at sync time and are never
 * re-dated afterwards, while `recurring_occurrences` self-heals to the
 * template's current schedule (prune + regenerate). A schedule change between
 * the two materializations (template edit, generator fix — e.g. quincenal
 * 14-day → month-anchored) leaves the entry a few days away from the
 * occurrence that actually settled its payment, so an exact-date join misses
 * and the entry shows as Pendiente forever.
 *
 * Both helpers use the shared auto-link window (±3 days) so planner matching
 * can never be more aggressive than transaction↔occurrence auto-linking.
 * Quincenal dates are ≥14 days apart, so the window can never cross-match two
 * different quincenas of one template.
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

export type SettledOccurrenceStatus = "paid" | "skipped";

export interface PlanReconcilableOccurrence {
  template_id: string;
  occurrence_date: string; // YYYY-MM-DD
  /** Full occurrence_status enum — only paid/skipped participate in matching. */
  status: string;
}

interface ClaimableOccurrence {
  occurrence_date: string;
  status: SettledOccurrenceStatus;
  used: boolean;
}

/**
 * Match each recurring planner entry to a settled (paid/skipped) occurrence of
 * its template. Exact-date matches claim their occurrence first; remaining
 * entries then take the nearest unclaimed occurrence within the ±3-day window.
 * Each occurrence settles at most one entry, so a re-sync duplicate can never
 * show two entries as paid off a single payment.
 *
 * Returns entry id → settled status for the entries that found a match.
 */
export function matchSettledOccurrencesToEntries(
  entries: PlanReconcilableEntry[],
  occurrences: PlanReconcilableOccurrence[]
): Map<string, SettledOccurrenceStatus> {
  const result = new Map<string, SettledOccurrenceStatus>();

  const settledByTemplate = new Map<string, ClaimableOccurrence[]>();
  for (const occ of occurrences) {
    if (occ.status !== "paid" && occ.status !== "skipped") continue;
    const list = settledByTemplate.get(occ.template_id) ?? [];
    list.push({
      occurrence_date: occ.occurrence_date,
      status: occ.status,
      used: false,
    });
    settledByTemplate.set(occ.template_id, list);
  }
  for (const list of settledByTemplate.values()) {
    list.sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
  }

  // Date order keeps the greedy nearest-match pass deterministic regardless of
  // the entries' fetch order.
  const recurringEntries = entries
    .filter((e) => e.recurring_template_id != null)
    .sort((a, b) => a.expected_date.localeCompare(b.expected_date));

  const unmatched: PlanReconcilableEntry[] = [];
  for (const entry of recurringEntries) {
    const list = settledByTemplate.get(entry.recurring_template_id!);
    const exact = list?.find(
      (o) => !o.used && o.occurrence_date === entry.expected_date
    );
    if (exact) {
      exact.used = true;
      result.set(entry.id, exact.status);
    } else {
      unmatched.push(entry);
    }
  }

  for (const entry of unmatched) {
    const list = settledByTemplate.get(entry.recurring_template_id!);
    if (!list) continue;
    let best: ClaimableOccurrence | null = null;
    let bestDiff = Infinity;
    for (const occ of list) {
      if (occ.used) continue;
      const diff = daysBetween(occ.occurrence_date, entry.expected_date);
      if (diff <= OCCURRENCE_AUTO_LINK_DAY_WINDOW && diff < bestDiff) {
        best = occ;
        bestDiff = diff;
      }
    }
    if (best) {
      best.used = true;
      result.set(entry.id, best.status);
    }
  }

  return result;
}

export interface RedatableEntry {
  id: string;
  recurring_template_id: string | null;
  expected_date: string; // YYYY-MM-DD
  /** planning_entry_status — only PLANNED entries may be re-dated. */
  status: string;
}

export interface PlanEntryRedate {
  entryId: string;
  templateId: string;
  fromDate: string;
  toDate: string;
}

/**
 * Self-heal for "Sincronizar recurrentes": PLANNED entries sitting on a date
 * the template's current in-period schedule no longer produces are re-dated to
 * the nearest unclaimed schedule date within the ±3-day window, instead of
 * leaving the stale entry pending forever AND inserting a duplicate on the new
 * date. Settled (COMPLETED/SKIPPED) entries are history and never move; stale
 * entries with no nearby unclaimed date are left alone (the display-side
 * matcher still reconciles them if a settled occurrence sits within window).
 *
 * Call-site contract: `scheduleByTemplate` must exclude MONTHLY templates —
 * their occurrences keep the day they materialized on (statement imports
 * drift it on purpose, see ensureOccurrencesForRange's prune exclusion), so
 * re-dating a MONTHLY entry to the template's recomputed day would move it
 * away from the occurrence it already matches.
 */
export function computePlanEntryRedates(
  scheduleByTemplate: Map<string, string[]>,
  existingEntries: RedatableEntry[],
): PlanEntryRedate[] {
  const redates: PlanEntryRedate[] = [];

  for (const [templateId, scheduleDates] of scheduleByTemplate) {
    const templateEntries = existingEntries.filter(
      (e) => e.recurring_template_id === templateId
    );
    if (templateEntries.length === 0) continue;

    const scheduleSet = new Set(scheduleDates);
    const claimedDates = new Set(templateEntries.map((e) => e.expected_date));
    const unclaimed = scheduleDates
      .filter((d) => !claimedDates.has(d))
      .sort((a, b) => a.localeCompare(b));
    if (unclaimed.length === 0) continue;

    const staleEntries = templateEntries
      .filter((e) => e.status === "PLANNED" && !scheduleSet.has(e.expected_date))
      .sort((a, b) => a.expected_date.localeCompare(b.expected_date));

    const usedTargets = new Set<string>();
    for (const entry of staleEntries) {
      let best: string | null = null;
      let bestDiff = Infinity;
      for (const date of unclaimed) {
        if (usedTargets.has(date)) continue;
        const diff = daysBetween(date, entry.expected_date);
        if (diff <= OCCURRENCE_AUTO_LINK_DAY_WINDOW && diff < bestDiff) {
          best = date;
          bestDiff = diff;
        }
      }
      if (best) {
        usedTargets.add(best);
        redates.push({
          entryId: entry.id,
          templateId,
          fromDate: entry.expected_date,
          toDate: best,
        });
      }
    }
  }

  return redates;
}
