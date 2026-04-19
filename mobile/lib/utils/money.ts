/**
 * Sanitize a user-entered money string into a number.
 * Strips non-numeric characters, accepts `.` / `-` in any position.
 * Returns 0 when the input is empty or not finite.
 */
export function parseMoney(raw: string): number {
  if (!raw) return 0;
  const n = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
