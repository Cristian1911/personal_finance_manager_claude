/**
 * Remote FX quote sources, tried in order.
 *
 * 1. Yahoo Finance chart API — intraday spot (what Google shows) plus daily
 *    closes for the last ~3 months in ONE request, so the history behind the
 *    "tasa baja" signal and /deudas/dolares never needs a per-day backfill.
 * 2. fawazahmed0 currency API (jsDelivr, then its Cloudflare mirror) — daily
 *    snapshot, no history. Fallback only: it lags the market by up to a day.
 *
 * Pure fetch + parse — no DB, no cache. Callers own persistence.
 */

export type RatePoint = { date: string; rate: number };

export interface FxQuote {
  rate: number;
  /** Daily closes (Colombia dates, ascending). Empty when the source has none. */
  history: RatePoint[];
  source: "yahoo" | "fawazahmed0";
}

const FETCH_TIMEOUT_MS = 5_000;
// Yahoo rejects requests without a browser-ish UA (429/403).
const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json",
};
const FAWAZ_URLS = [
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies",
  "https://latest.currency-api.pages.dev/v1/currencies",
];

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Parses a Yahoo `v8/finance/chart` payload. Exported for tests. */
export function parseYahooChart(payload: unknown): Omit<FxQuote, "source"> | null {
  const result = (payload as {
    chart?: {
      result?: Array<{
        meta?: { regularMarketPrice?: unknown; gmtoffset?: unknown };
        timestamp?: unknown;
        indicators?: { quote?: Array<{ close?: unknown }> };
      }>;
    };
  })?.chart?.result?.[0];
  if (!result) return null;

  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const closes = result.indicators?.quote?.[0]?.close;
  // FX daily bars are stamped at midnight of the exchange's timezone
  // (London: 23:00 UTC in summer = 18:00 of the PREVIOUS day in Bogotá), so
  // date each bar in the exchange's offset, not Colombia's.
  const offset = typeof result.meta?.gmtoffset === "number" ? result.meta.gmtoffset : 0;
  const byDate = new Map<string, number>();
  if (Array.isArray(closes)) {
    timestamps.forEach((ts, i) => {
      const close = closes[i];
      if (typeof ts !== "number" || !isValidRate(close)) return;
      // Later points of the same day overwrite earlier ones.
      byDate.set(new Date((ts + offset) * 1000).toISOString().slice(0, 10), close);
    });
  }
  const history = [...byDate.entries()]
    .map(([date, rate]) => ({ date, rate }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const live = result.meta?.regularMarketPrice;
  const rate = isValidRate(live) ? live : history.at(-1)?.rate;
  if (!isValidRate(rate)) return null;
  return { rate, history };
}

/** Parses a fawazahmed0 `/currencies/{from}.json` payload. Exported for tests. */
export function parseFawaz(payload: unknown, from: string, to: string): number | null {
  const rate = (payload as Record<string, Record<string, unknown> | undefined>)?.[from]?.[to];
  return isValidRate(rate) ? rate : null;
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

async function fromYahoo(from: string, to: string, range: "5d" | "3mo"): Promise<FxQuote | null> {
  // Yahoo's FX symbol is FROMTO=X (e.g. USDCOP=X). Codes are validated
  // against the currency enum by the caller before they reach this URL.
  const symbol = encodeURIComponent(`${from}${to}=X`);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d`;
  const parsed = parseYahooChart(await fetchJson(url, YAHOO_HEADERS));
  return parsed ? { ...parsed, source: "yahoo" } : null;
}

async function fromFawaz(from: string, to: string): Promise<FxQuote | null> {
  const fromLower = from.toLowerCase();
  const toLower = to.toLowerCase();
  for (const base of FAWAZ_URLS) {
    try {
      const rate = parseFawaz(await fetchJson(`${base}/${fromLower}.json`), fromLower, toLower);
      if (rate != null) return { rate, history: [], source: "fawazahmed0" };
    } catch (error) {
      console.warn("[fx] fawazahmed0 source failed:", error);
    }
  }
  return null;
}

/**
 * Live quote for `from → to`. `withHistory` asks Yahoo for ~3 months of
 * daily closes instead of 5 days (same single request, bigger payload).
 * Null when every source fails.
 */
export async function fetchFxQuote(
  from: string,
  to: string,
  { withHistory = false }: { withHistory?: boolean } = {},
): Promise<FxQuote | null> {
  try {
    const quote = await fromYahoo(from, to, withHistory ? "3mo" : "5d");
    if (quote) return quote;
  } catch (error) {
    console.warn("[fx] Yahoo source failed:", error);
  }
  return fromFawaz(from, to);
}
