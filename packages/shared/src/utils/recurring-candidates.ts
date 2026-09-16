/**
 * Deterministic recurring-charge detector (no ML, per project constraint).
 *
 * Generalizes `subscription-detector.ts` for the first-weeks discovery
 * ("Netflix se cobró el 5 de ago y el 5 de sep"): two charges are enough, rows
 * without a destinatario still group by their cleaned description, and debt
 * payments / self transfers / cash withdrawals are excluded through the
 * persisted `flow_class` instead of description regexes.
 *
 * ponytail: monthly cadence only. Weekly and annual charges never qualify;
 * add a cadence option when a user actually asks for one.
 */

import { cleanDescription } from "./destinatario-matcher";

export interface RecurringCandidateTransaction {
  id: string;
  destinatario_id: string | null;
  clean_description: string | null;
  transaction_date: string; // YYYY-MM-DD
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
  /** `flow_class_effective` from the transactions view. */
  flow_class: string | null;
}

export interface RecurringCandidate {
  /** `dest:<destinatario_id>:<currency>` or `desc:<CLEAN DESCRIPTION>:<currency>`. */
  key: string;
  destinatario_id: string | null;
  clean_description: string | null;
  currency_code: string;
  /** Chronological. */
  transaction_ids: string[];
  /** Chronological, YYYY-MM-DD. */
  dates: string[];
  /** Chronological, parallel to `dates`. */
  amounts: number[];
  median_amount: number;
  /** Day of month of the latest charge. */
  day_of_month: number;
}

export interface RecurringCandidateOptions {
  minOccurrences?: number;
  amountTolerance?: number;
}

/** Flow classes that are money moving, not a merchant charging. */
export const RECURRING_EXCLUDED_FLOW_CLASSES: ReadonlySet<string> = new Set([
  "DEBT_PAYMENT",
  "DEBT_CREDIT",
  "DEBT_DRAWDOWN",
  "SELF_TRANSFER",
  "CASH_WITHDRAWAL",
]);

const DEFAULTS: Required<RecurringCandidateOptions> = {
  minOccurrences: 2,
  amountTolerance: 0.1,
};

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`);
  return Math.round(ms / 86_400_000);
}

function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10));
}

/** Distance between two days of month, wrapping around month end (31 → 1 is 1). */
function domDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 31 - d);
}

/**
 * Consecutive charges look monthly when the gap is 28–34 days, or when they
 * land on the same day of month (±3) and the gap is still one month wide.
 */
function isMonthlyGap(prev: string, next: string): boolean {
  const gap = daysBetween(prev, next);
  if (gap >= 28 && gap <= 34) return true;
  return gap >= 25 && gap <= 37 && domDistance(dayOfMonth(prev), dayOfMonth(next)) <= 3;
}

function groupKey(t: RecurringCandidateTransaction): string | null {
  if (t.destinatario_id) return `dest:${t.destinatario_id}:${t.currency_code}`;
  const desc = t.clean_description ? cleanDescription(t.clean_description) : "";
  return desc ? `desc:${desc}:${t.currency_code}` : null;
}

export function detectRecurringCandidates(
  transactions: RecurringCandidateTransaction[],
  options?: RecurringCandidateOptions,
): RecurringCandidate[] {
  const o = { ...DEFAULTS, ...options };
  const groups = new Map<string, RecurringCandidateTransaction[]>();

  for (const t of transactions) {
    if (t.direction !== "OUTFLOW" || t.amount <= 0) continue;
    if (t.flow_class && RECURRING_EXCLUDED_FLOW_CLASSES.has(t.flow_class)) continue;
    const key = groupKey(t);
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const candidates: RecurringCandidate[] = [];
  for (const [key, txs] of groups) {
    if (txs.length < o.minOccurrences) continue;
    const sorted = [...txs].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

    let monthly = true;
    for (let i = 1; i < sorted.length && monthly; i++) {
      monthly = isMonthlyGap(sorted[i - 1].transaction_date, sorted[i].transaction_date);
    }
    if (!monthly) continue;

    // Stable amount = every charge inside a band `amountTolerance` of the
    // median wide. Per-value distance to the median would let a pair drift
    // ~2x the tolerance apart (the median of two values is their mean).
    const amounts = sorted.map((t) => t.amount);
    const medAmount = median(amounts);
    const spread = Math.max(...amounts) - Math.min(...amounts);
    if (spread > medAmount * o.amountTolerance) continue;

    const last = sorted[sorted.length - 1];
    candidates.push({
      key,
      destinatario_id: last.destinatario_id,
      clean_description: last.clean_description,
      currency_code: last.currency_code,
      transaction_ids: sorted.map((t) => t.id),
      dates: sorted.map((t) => t.transaction_date),
      amounts,
      median_amount: medAmount,
      day_of_month: dayOfMonth(last.transaction_date),
    });
  }
  return candidates;
}
