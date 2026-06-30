import { addMonths, endOfMonth, format, parseISO, startOfMonth, startOfWeek } from "date-fns";

export type AnalyticsRange = "WTD" | "MTD" | "3M" | "6M" | "12M" | "YTD" | { from: string; to: string };

function monthKeys(from: Date, to: Date): string[] {
  const out: string[] = [];
  let cur = startOfMonth(from);
  const end = startOfMonth(to);
  while (cur <= end) {
    out.push(format(cur, "yyyy-MM"));
    cur = addMonths(cur, 1);
  }
  return out;
}

/** anchorIso defaults to today; passed explicitly in tests for determinism. */
export function rangeToWindow(range: AnalyticsRange, anchorIso?: string): { from: string; to: string; months: string[] } {
  const anchor = anchorIso ? parseISO(anchorIso) : new Date();
  if (typeof range === "object") {
    return { from: range.from, to: range.to, months: monthKeys(parseISO(range.from), parseISO(range.to)) };
  }
  // Calendar-to-date windows end at the anchor (today), not month-end.
  if (range === "WTD" || range === "MTD") {
    const fromDate = range === "WTD" ? startOfWeek(anchor, { weekStartsOn: 1 }) : startOfMonth(anchor);
    return {
      from: format(fromDate, "yyyy-MM-dd"),
      to: format(anchor, "yyyy-MM-dd"),
      months: monthKeys(fromDate, anchor),
    };
  }
  const toDate = endOfMonth(anchor);
  let fromDate: Date;
  if (range === "YTD") {
    fromDate = startOfMonth(parseISO(`${format(anchor, "yyyy")}-01-01`));
  } else {
    const n = range === "3M" ? 2 : range === "6M" ? 5 : 11;
    fromDate = startOfMonth(addMonths(anchor, -n));
  }
  return {
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    months: monthKeys(fromDate, toDate),
  };
}

/** The n month keys following `lastMonth` ("2026-06" → ["2026-07", ...]). Forecast horizon. */
export function nextMonths(lastMonth: string, n: number): string[] {
  const base = parseISO(`${lastMonth}-01`);
  return Array.from({ length: n }, (_, i) => format(addMonths(base, i + 1), "yyyy-MM"));
}
