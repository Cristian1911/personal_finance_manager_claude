"use server";

import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurrencyCode } from "@/types/domain";
import { Constants, type Database } from "@/types/database";
import { toColombiaDateString } from "@/lib/utils/date";
import { addDays } from "date-fns";

// Runtime guard for client-supplied codes: `getExchangeRate` keys its cache on
// its raw arguments and interpolates them into a CDN URL and a DB primary key,
// so anything outside the enum must be rejected before it gets that far.
const CURRENCY_CODES: ReadonlySet<string> = new Set(Constants.public.Enums.currency_code);
// ConversionHint asks for at most 2 (profile currency + local currency).
const MAX_CONVERSION_TARGETS = 4;

function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && CURRENCY_CODES.has(value);
}

type ExchangeRateCacheRow = Database["public"]["Tables"]["exchange_rate_cache"]["Row"];

export interface ExchangeRateResult {
  rate: number;
  avg30d: number | null;
  percentVsAvg: number | null;
  fetchedAt: string;
  pair: string;
}

// fawazahmed0/exchange-api — static JSON on CDN, no key, 200+ currencies including COP
const FAWAZ_BASE = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// Rolling window behind "tasa baja": avg_30d is the mean of the daily rates
// kept in rates_30d. Fewer points than this and the average isn't trusted.
const HISTORY_DAYS = 30;
const MIN_POINTS_FOR_AVG = 7;
// getExchangeRate only appends today's point (it sits on mutation paths —
// occurrence matching — so it must stay one request). getExchangeRateTrend
// backfills the missing days from the CDN's dated snapshots for the
// dashboard/deudas signal, off the hot path.
const FETCH_TIMEOUT_MS = 5_000;

type RatePoint = { date: string; rate: number };

/**
 * Get the exchange rate for a currency pair (e.g., USD → COP).
 * Checks DB cache first; fetches once per day from fawazahmed0 CDN.
 */
export async function getExchangeRate(
  from: CurrencyCode,
  to: CurrencyCode
): Promise<ExchangeRateResult | null> {
  "use cache";
  cacheTag("exchange-rates", `exchange-rate:${from}_${to}`);
  cacheLife({ stale: 3600, revalidate: 3600 * 6, expire: 3600 * 24 });

  if (from === to) return null;
  if (!isCurrencyCode(from) || !isCurrencyCode(to)) return null;
  const pair = `${from}_${to}`;
  const supabase = createAdminClient();

  // Check cache
  const { data: cached } = await supabase
    .from("exchange_rate_cache")
    .select("*")
    .eq("pair", pair)
    .single();

  const now = Date.now();
  const cacheAge = cached?.fetched_at
    ? now - new Date(cached.fetched_at).getTime()
    : Infinity;

  if (cached && cacheAge < CACHE_TTL_MS) {
    return formatCached(cached, pair);
  }

  // Fetch today's rate from fawazahmed0 CDN (single-pair endpoint)
  const fromLower = from.toLowerCase();
  const toLower = to.toLowerCase();
  try {
    const rate = await fetchRate(`${FAWAZ_BASE}/${fromLower}/${toLower}.json`, toLower);
    if (rate == null) return cached ? formatCached(cached, pair) : null;

    const today = toColombiaDateString(new Date());
    const history = withPoint(parseHistory(cached?.rates_30d, today), today, rate);
    return await saveHistory(pair, rate, history, new Date().toISOString());
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return cached ? formatCached(cached, pair) : null;
  }
}

async function fetchRate(url: string, toLower: string): Promise<number | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return null;
  const data = await res.json();
  const rate = data?.[toLower];
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** Stored points inside the window, excluding today (re-added fresh). */
function parseHistory(raw: unknown, today: string): RatePoint[] {
  if (!Array.isArray(raw)) return [];
  const cutoff = toColombiaDateString(addDays(new Date(`${today}T12:00:00`), -HISTORY_DAYS));
  return raw.filter(
    (p): p is RatePoint =>
      !!p &&
      typeof p === "object" &&
      typeof (p as RatePoint).date === "string" &&
      typeof (p as RatePoint).rate === "number" &&
      (p as RatePoint).rate > 0 &&
      (p as RatePoint).date > cutoff &&
      (p as RatePoint).date < today,
  );
}

function withPoint(history: RatePoint[], date: string, rate: number): RatePoint[] {
  return [...history.filter((p) => p.date !== date), { date, rate }].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

async function saveHistory(
  pair: string,
  rate: number,
  history: RatePoint[],
  fetchedAt: string,
): Promise<ExchangeRateResult> {
  const avg30d =
    history.length >= MIN_POINTS_FOR_AVG
      ? history.reduce((sum, p) => sum + p.rate, 0) / history.length
      : null;
  // Cache write — await to ensure it completes before serverless context exits
  await createAdminClient().from("exchange_rate_cache").upsert({
    pair,
    rate,
    rates_30d: history,
    avg_30d: avg30d,
    fetched_at: fetchedAt,
  });
  return {
    rate,
    avg30d,
    percentVsAvg: avg30d ? ((rate - avg30d) / avg30d) * 100 : null,
    fetchedAt,
    pair,
  };
}

/**
 * Rate plus a trustworthy 30-day average, for the "tasa baja" signal
 * (dashboard strip, /deudas nudge). When the stored window is short of
 * MIN_POINTS_FOR_AVG, fills every missing day from the CDN's dated
 * snapshots (daily, so the mean isn't skewed toward recent days). Render
 * paths only, behind Suspense — never call this from a mutation path.
 */
export async function getExchangeRateTrend(
  from: CurrencyCode,
  to: CurrencyCode
): Promise<ExchangeRateResult | null> {
  "use cache";
  cacheTag("exchange-rates", `exchange-rate-trend:${from}_${to}`);
  cacheLife({ stale: 3600, revalidate: 3600 * 6, expire: 3600 * 24 });

  const current = await getExchangeRate(from, to);
  if (!current || current.avg30d != null) return current;

  try {
    const { data: cached } = await createAdminClient()
      .from("exchange_rate_cache")
      .select("*")
      .eq("pair", current.pair)
      .single();
    const today = toColombiaDateString(new Date());
    const byDate = new Map(
      parseHistory(cached?.rates_30d, today).map((p) => [p.date, p.rate]),
    );
    const base = new Date(`${today}T12:00:00`);
    const missing: string[] = [];
    for (let d = 1; d < HISTORY_DAYS; d++) {
      const date = toColombiaDateString(addDays(base, -d));
      if (!byDate.has(date)) missing.push(date);
    }
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();
    const fetched = await Promise.all(
      missing.map((date) =>
        fetchRate(
          `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${fromLower}/${toLower}.json`,
          toLower,
        )
          .then((rate) => [date, rate] as const)
          .catch(() => [date, null] as const),
      ),
    );
    for (const [date, rate] of fetched) if (rate != null) byDate.set(date, rate);
    const history = withPoint(
      [...byDate.entries()].map(([date, rate]) => ({ date, rate })),
      today,
      current.rate,
    );
    return await saveHistory(current.pair, current.rate, history, current.fetchedAt);
  } catch (error) {
    console.error("Error backfilling exchange rate history:", error);
    return current;
  }
}

/**
 * Fetch exchange rates for multiple currencies → base in parallel.
 * Returns a map: map.get("USD") = how many baseCurrency units per 1 USD.
 * Missing or failed rates are omitted from the map.
 */
export async function getRatesForCurrencies(
  currencies: CurrencyCode[],
  baseCurrency: CurrencyCode
): Promise<Map<CurrencyCode, number>> {
  const unique = [...new Set(currencies.filter((c) => c !== baseCurrency))];
  const rates = new Map<CurrencyCode, number>();

  if (unique.length === 0) return rates;

  const results = await Promise.all(
    unique.map((c) => getExchangeRate(c, baseCurrency).then((r) => [c, r] as const))
  );

  for (const [currency, result] of results) {
    if (result?.rate) rates.set(currency, result.rate);
  }

  return rates;
}

/**
 * Rates from one currency to several targets, for the "≈ en COP / ARS" hint
 * under a foreign-currency amount. Each pair is served from the daily cache;
 * targets whose rate can't be resolved are omitted, never zero.
 */
export async function getConversionRates(
  from: CurrencyCode,
  targets: CurrencyCode[]
): Promise<Partial<Record<CurrencyCode, number>>> {
  // Reachable from the browser: bound and validate before fanning out.
  if (!isCurrencyCode(from) || !Array.isArray(targets)) return {};
  const unique = [...new Set(targets)]
    .filter((c): c is CurrencyCode => isCurrencyCode(c) && c !== from)
    .slice(0, MAX_CONVERSION_TARGETS);
  if (unique.length === 0) return {};
  const results = await Promise.all(
    unique.map((to) => getExchangeRate(from, to).then((r) => [to, r] as const))
  );
  const rates: Partial<Record<CurrencyCode, number>> = {};
  for (const [to, result] of results) {
    if (result?.rate != null && Number.isFinite(result.rate) && result.rate > 0) {
      rates[to] = result.rate;
    }
  }
  return rates;
}

function formatCached(cached: ExchangeRateCacheRow, pair: string): ExchangeRateResult {
  const rate = Number(cached.rate);
  const avg30d = cached.avg_30d ? Number(cached.avg_30d) : null;
  return {
    rate,
    avg30d,
    percentVsAvg: avg30d ? ((rate - avg30d) / avg30d) * 100 : null,
    fetchedAt: cached.fetched_at,
    pair,
  };
}
