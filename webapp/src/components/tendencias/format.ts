const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-06" → "jun". TZ-safe string op (no Date parsing). */
export function monthShort(m: string): string {
  const i = Number(m.slice(5, 7)) - 1;
  return MESES[i] ?? m;
}
