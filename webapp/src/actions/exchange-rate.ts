"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { CurrencyCode } from "@/types/domain";
import type { Database } from "@/types/database";

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

/**
 * Get the exchange rate for a currency pair (e.g., USD → COP).
 * Checks DB cache first; fetches once per day from fawazahmed0 CDN.
 */
export async function getExchangeRate(
  from: CurrencyCode,
  to: CurrencyCode
): Promise<ExchangeRateResult | null> {
  if (from === to) return null;

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
    const res = await fetch(`${FAWAZ_BASE}/${fromLower}/${toLower}.json`);
    if (!res.ok) return cached ? formatCached(cached, pair) : null;

    const data = await res.json();
    const rate = data?.[toLower];
    if (!rate || typeof rate !== "number") return cached ? formatCached(cached, pair) : null;

    // Best-effort cache write — don't block the response
    void supabase.from("exchange_rate_cache").upsert({
      pair,
      rate,
      rates_30d: [],
      avg_30d: null,
      fetched_at: new Date().toISOString(),
    });

    return { rate, avg30d: null, percentVsAvg: null, fetchedAt: new Date().toISOString(), pair };
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return cached ? formatCached(cached, pair) : null;
  }
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
