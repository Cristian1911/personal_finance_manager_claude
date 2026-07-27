/**
 * One source of truth for "how many recurring payments did I resolve this
 * month". The desktop header, the mobile header and the summary strip each
 * counted this differently — desktop excluded skipped occurrences, the others
 * folded them into `paid` — so the same screen showed "11 de 17" and
 * "14 de 20" at once.
 *
 * Rules: a skipped occurrence was never due and was never paid. It is not
 * pending, not paid, and not part of the denominator.
 */
export interface CountableOccurrence {
  status: string;
  occurrence_date: string;
}

export interface OccurrenceCounts {
  /** Still awaiting confirmation. */
  pending: number;
  /** Confirmed as paid. */
  paid: number;
  /** Deliberately omitted — excluded from `due`. */
  skipped: number;
  /** Denominator for "X de Y pagados": everything that was actually due. */
  due: number;
  /** Pending occurrences dated strictly before `today` — already late. */
  overdue: number;
}

export function countOccurrences(
  occurrences: readonly CountableOccurrence[],
  today: string,
): OccurrenceCounts {
  let pending = 0;
  let paid = 0;
  let skipped = 0;
  let overdue = 0;

  for (const o of occurrences) {
    if (o.status === "skipped") {
      skipped += 1;
    } else if (o.status === "paid") {
      paid += 1;
    } else if (o.status === "pending") {
      pending += 1;
      if (o.occurrence_date < today) overdue += 1;
    }
  }

  return { pending, paid, skipped, due: pending + paid, overdue };
}
