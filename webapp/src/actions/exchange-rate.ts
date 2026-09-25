"use server";

import { cacheLife, cacheTag } from "next/cache";
import type { CurrencyCode } from "@/types/domain";
import { Constants } from "@/types/database";
import type { RatePoint } from "@/lib/fx/rate-sources";
import {
  isStale,
  readStoredRate,
  refreshStoredRate,
  type StoredRate,
} from "@/lib/fx/rate-store";

// Runtime guard for client-supplied codes: the pair becomes a cache key, a
// quote URL and a DB primary key, so anything outside the enum is rejected
// before the cached functions ever see it.
const CURRENCY_CODES: ReadonlySet<string> = new Set(Constants.public.Enums.currency_code);
// ConversionHint asks for at most 2 (profile currency + local currency).
const MAX_CONVERSION_TARGETS = 4;

function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && CURRENCY_CODES.has(value);
}

export interface ExchangeRateResult {
  rate: number;
  avg30d: number | null;
  percentVsAvg: number | null;
  fetchedAt: string;
  pair: string;
}

export interface ExchangeRateTrendResult extends ExchangeRateResult {
  /** Daily closes, ascending, up to HISTORY_DAYS (90) days. */
  history: RatePoint[];
}

// The DB row is refreshed hourly on weekdays by the cron; this cache only
// fronts that read, so keep it short enough that a new quote shows up within
// ~15 minutes. The cron also expires the `exchange-rates` tag on each run.
const FX_CACHE_LIFE = { stale: 300, revalidate: 900, expire: 3600 };

// Inline refreshes sit on render and mutation paths (occurrence matching):
// cap them so slow sources degrade to the stored row instead of blocking.
const INLINE_REFRESH_BUDGET_MS = 4_000;

async function resolveRate(pair: string): Promise<StoredRate | null> {
  try {
    const stored = await readStoredRate(pair);
    if (!isStale(stored)) return stored;
    // Cron missed (or first request for this pair): refresh inline — one
    // request, history only when the stored window is short.
    const refresh = refreshStoredRate(pair, { stored });
    const timeout = new Promise<StoredRate | null>((resolve) =>
      setTimeout(() => resolve(stored), INLINE_REFRESH_BUDGET_MS),
    );
    return await Promise.race([refresh, timeout]);
  } catch (error) {
    console.error("Error resolving exchange rate:", error);
    return null;
  }
}

function toResult(stored: StoredRate): ExchangeRateResult {
  const { rate, avg30d, percentVsAvg, fetchedAt, pair } = stored;
  return { rate, avg30d, percentVsAvg, fetchedAt, pair };
}

/** Validated pair key, or null — runs BEFORE any cache key is built. */
function toPair(from: unknown, to: unknown): string | null {
  if (!isCurrencyCode(from) || !isCurrencyCode(to) || from === to) return null;
  return `${from}_${to}`;
}

async function getCachedRate(pair: string): Promise<ExchangeRateResult | null> {
  "use cache";
  cacheTag("exchange-rates", `exchange-rate:${pair}`);
  cacheLife(FX_CACHE_LIFE);

  const stored = await resolveRate(pair);
  return stored ? toResult(stored) : null;
}

async function getCachedTrend(pair: string): Promise<ExchangeRateTrendResult | null> {
  "use cache";
  cacheTag("exchange-rates", `exchange-rate-trend:${pair}`);
  cacheLife(FX_CACHE_LIFE);

  const stored = await resolveRate(pair);
  return stored ? { ...toResult(stored), history: stored.history } : null;
}

/**
 * Get the exchange rate for a currency pair (e.g., USD → COP).
 * Reads the hourly-refreshed DB row; refreshes inline only when it's stale.
 * Sits on mutation paths (occurrence matching) — at most one remote request.
 */
export async function getExchangeRate(
  from: CurrencyCode,
  to: CurrencyCode
): Promise<ExchangeRateResult | null> {
  const pair = toPair(from, to);
  return pair ? getCachedRate(pair) : null;
}

/**
 * Rate plus its daily history and 30-day average, for the "tasa baja" signal
 * (dashboard strip, /deudas nudge, /deudas/dolares). Render paths only,
 * behind Suspense — never call this from a mutation path.
 */
export async function getExchangeRateTrend(
  from: CurrencyCode,
  to: CurrencyCode
): Promise<ExchangeRateTrendResult | null> {
  const pair = toPair(from, to);
  return pair ? getCachedTrend(pair) : null;
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
