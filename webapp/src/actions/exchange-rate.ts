"use server";

import { createClient } from "@/lib/supabase/server";
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

const FRANKFURTER_BASE = "https://api.frankfurter.app";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get the exchange rate for a currency pair (e.g., USD → COP).
 * Checks cache first; fetches from frankfurter.app if stale (>24h).
 */
export async function getExchangeRate(
  from: CurrencyCode,
  to: CurrencyCode
): Promise<ExchangeRateResult | null> {
  if (from === to) return null;

  const pair = `${from}_${to}`;
  const supabase = await createClient();

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

  // Fetch fresh rate
  try {
    const [latestRes, historyRes] = await Promise.all([
      fetch(`${FRANKFURTER_BASE}/latest?from=${from}&to=${to}`),
      fetch(`${FRANKFURTER_BASE}/${getDateDaysAgo(30)}..?from=${from}&to=${to}`),
    ]);

    if (!latestRes.ok || !historyRes.ok) return cached ? formatCached(cached, pair) : null;

    const latest = await latestRes.json();
    const history = await historyRes.json();

    const rate = latest.rates?.[to];
    if (!rate) return cached ? formatCached(cached, pair) : null;

    // Build 30-day rates array
    const rates30d: { date: string; rate: number }[] = [];
    for (const [date, rates] of Object.entries(history.rates ?? {})) {
      const r = (rates as Record<string, number>)?.[to];
      if (r) rates30d.push({ date, rate: r });
    }

    const avg30d = rates30d.length > 0
      ? rates30d.reduce((s, r) => s + r.rate, 0) / rates30d.length
      : null;

    // Upsert cache
    await supabase.from("exchange_rate_cache").upsert({
      pair,
      rate,
      rates_30d: rates30d,
      avg_30d: avg30d,
      fetched_at: new Date().toISOString(),
    });

    const percentVsAvg = avg30d ? ((rate - avg30d) / avg30d) * 100 : null;

    return { rate, avg30d, percentVsAvg, fetchedAt: new Date().toISOString(), pair };
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return cached ? formatCached(cached, pair) : null;
  }
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
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
