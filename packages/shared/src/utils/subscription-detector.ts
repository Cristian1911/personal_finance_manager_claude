/**
 * Deterministic subscription detector (no ML, per project constraint).
 *
 * Groups OUTFLOW transactions by `destinatario_id` (the reliable, multi-pattern
 * recognition anchor) and flags groups that look like a monthly subscription:
 * a stable amount charged on a roughly-monthly cadence. Annual/quarterly cadences
 * are intentionally NOT detected (too few data points) — those are manual-only.
 */

export interface DetectorTransaction {
  destinatario_id: string | null;
  transaction_date: string; // YYYY-MM-DD
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
}

export interface SubscriptionCandidate {
  destinatario_id: string;
  occurrence_count: number;
  median_amount: number;
  median_gap_days: number;
  currency_code: string;
}

export interface DetectOptions {
  minOccurrences?: number;
  minGapDays?: number;
  maxGapDays?: number;
  amountTolerance?: number;
}

const DEFAULTS: Required<DetectOptions> = {
  minOccurrences: 3,
  minGapDays: 28,
  maxGapDays: 34,
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

export function detectSubscriptions(
  transactions: DetectorTransaction[],
  excludedDestinatarioIds: Set<string>,
  options?: DetectOptions,
): SubscriptionCandidate[] {
  const o = { ...DEFAULTS, ...options };
  const groups = new Map<string, DetectorTransaction[]>();

  for (const t of transactions) {
    if (t.direction !== "OUTFLOW" || !t.destinatario_id) continue;
    if (excludedDestinatarioIds.has(t.destinatario_id)) continue;
    const arr = groups.get(t.destinatario_id) ?? [];
    arr.push(t);
    groups.set(t.destinatario_id, arr);
  }

  const candidates: SubscriptionCandidate[] = [];
  for (const [destinatarioId, txs] of groups) {
    if (txs.length < o.minOccurrences) continue;
    const sorted = [...txs].sort((a, b) =>
      a.transaction_date.localeCompare(b.transaction_date),
    );

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].transaction_date, sorted[i].transaction_date));
    }
    const medGap = median(gaps);
    if (medGap < o.minGapDays || medGap > o.maxGapDays) continue;

    const amounts = sorted.map((t) => t.amount);
    const medAmount = median(amounts);
    const stable = amounts.every(
      (a) => Math.abs(a - medAmount) <= medAmount * o.amountTolerance,
    );
    if (!stable) continue;

    candidates.push({
      destinatario_id: destinatarioId,
      occurrence_count: sorted.length,
      median_amount: medAmount,
      median_gap_days: medGap,
      currency_code: sorted[0].currency_code,
    });
  }
  return candidates;
}
