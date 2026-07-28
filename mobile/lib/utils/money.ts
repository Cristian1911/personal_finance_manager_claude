import { parseFormattedAmount } from "../amount";

/**
 * Sanitize a user-entered money string into a number. Returns 0 when the
 * input is empty or not finite.
 *
 * Delegates to `parseFormattedAmount` so it agrees with `formatAmountInput`,
 * which now groups the onboarding money fields: the previous implementation
 * did `Number(raw.replace(/[^0-9.-]/g, ""))`, which reads "3.130.871" as NaN
 * (→ 0, silently losing the user's income) and "3.130" as 3.13.
 */
export function parseMoney(raw: string): number {
  if (!raw) return 0;
  // parseFormattedAmount only keeps digits and separators, so carry the sign
  // ourselves — a balance can legitimately be negative.
  const negative = raw.trim().startsWith("-");
  const n = parseFormattedAmount(raw);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}
