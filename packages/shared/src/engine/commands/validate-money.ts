/** A finite amount with at most two decimals (0.29 * 100 isn't exactly 29 in floating point). */
export function isMoney(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Math.abs(Math.round(v * 100) - v * 100) <= 1e-6;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date as YYYY-MM-DD (2026-02-30 is not). */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
