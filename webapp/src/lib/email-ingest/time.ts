/**
 * Bancolombia emails carry the execution time as "HH:mm" (e.g. "11:20").
 * Postgres TIME wants "HH:mm:ss" — normalise at the write boundary so email
 * imports land with the same precision as the manual form / mobile sync.
 * Returns null for anything that isn't a well-formed time so we never write
 * garbage into the column.
 */
export function normalizeEmailTime(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return null;
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}
