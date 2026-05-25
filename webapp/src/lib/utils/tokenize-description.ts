/**
 * Split a raw transaction description into human-meaningful word chips for the
 * destinatario pattern builder. Strips separators, numeric noise, and very
 * short tokens; preserves first-seen order; case-insensitive de-dupe; caps at 12.
 */
export function tokenizeDescription(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of raw.split(/[^\p{L}\p{N}]+/u)) {
    const t = token.trim();
    if (t.length < 3) continue; // drop short noise ("S", "SA", refs)
    if (/^\d+$/.test(t)) continue; // drop pure numbers
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}
