import "server-only";
import { addDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { toColombiaDateString } from "@/lib/utils/date";
import type { Database } from "@/types/database";
import { fetchFxQuote, type RatePoint } from "@/lib/fx/rate-sources";

/**
 * `exchange_rate_cache` read/refresh — the single writer of FX rows.
 *
 * Fed hourly on weekdays by the cron (`/api/webhooks/fx-rates`, GitHub
 * Actions schedule). Readers refresh inline only when the row is older than
 * STALE_AFTER_MS, so a dead cron degrades to "fresh on visit" instead of the
 * rate silently freezing (it sat on an April value for months because the
 * old single-pair CDN endpoint stopped answering and the fallback returned
 * the cached row forever).
 */

type ExchangeRateCacheRow = Database["public"]["Tables"]["exchange_rate_cache"]["Row"];

/** Daily points kept in `rates_30d` (column name predates the longer window). */
export const HISTORY_DAYS = 90;
/** Window behind avg_30d / percentVsAvg. */
export const AVG_WINDOW_DAYS = 30;
const MIN_POINTS_FOR_AVG = 7;
/** Enough stored days that the inline refresh can skip asking for history. */
const MIN_POINTS_FOR_HISTORY = 20;
/** Cron runs hourly on weekdays; readers only refresh past this age. */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

export interface StoredRate {
  pair: string;
  rate: number;
  avg30d: number | null;
  percentVsAvg: number | null;
  fetchedAt: string;
  history: RatePoint[];
  /** False when the last refresh fetched a quote but couldn't store it. */
  persisted?: boolean;
}

export function splitPair(pair: string): [string, string] {
  const [from, to] = pair.split("_");
  return [from, to];
}

function cutoffDate(today: string, days: number): string {
  return toColombiaDateString(addDays(new Date(`${today}T12:00:00`), -days));
}

/** Valid stored points inside the history window, ascending. */
export function parseHistory(raw: unknown, today: string): RatePoint[] {
  if (!Array.isArray(raw)) return [];
  const cutoff = cutoffDate(today, HISTORY_DAYS);
  return raw
    .filter(
      (p): p is RatePoint =>
        !!p &&
        typeof p === "object" &&
        typeof (p as RatePoint).date === "string" &&
        typeof (p as RatePoint).rate === "number" &&
        (p as RatePoint).rate > 0 &&
        (p as RatePoint).date > cutoff &&
        (p as RatePoint).date <= today,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Stored ∪ fetched (fetched wins per date) ∪ today's live rate. */
export function mergeHistory(
  stored: RatePoint[],
  fetched: RatePoint[],
  today: string,
  liveRate: number,
): RatePoint[] {
  const byDate = new Map(stored.map((p) => [p.date, p.rate]));
  for (const p of fetched) byDate.set(p.date, p.rate);
  byDate.set(today, liveRate);
  const cutoff = cutoffDate(today, HISTORY_DAYS);
  return [...byDate.entries()]
    .filter(([date]) => date > cutoff && date <= today)
    .map(([date, rate]) => ({ date, rate }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function averageLastDays(history: RatePoint[], today: string, days: number): number | null {
  const cutoff = cutoffDate(today, days);
  const window = history.filter((p) => p.date > cutoff);
  if (window.length < MIN_POINTS_FOR_AVG) return null;
  return window.reduce((sum, p) => sum + p.rate, 0) / window.length;
}

function toStored(
  pair: string,
  rate: number,
  avg30d: number | null,
  fetchedAt: string,
  history: RatePoint[],
): StoredRate {
  return {
    pair,
    rate,
    avg30d,
    percentVsAvg: avg30d ? ((rate - avg30d) / avg30d) * 100 : null,
    fetchedAt,
    history,
  };
}

function fromRow(row: ExchangeRateCacheRow): StoredRate {
  const today = toColombiaDateString(new Date());
  const history = parseHistory(row.rates_30d, today);
  const rate = Number(row.rate);
  // Recompute from history when possible — the stored avg can predate the
  // current window; fall back to the stored one otherwise.
  const avg =
    averageLastDays(history, today, AVG_WINDOW_DAYS) ??
    (row.avg_30d != null ? Number(row.avg_30d) : null);
  return toStored(row.pair, rate, avg, row.fetched_at, history);
}

export async function readStoredRate(pair: string): Promise<StoredRate | null> {
  const { data, error } = await createAdminClient()
    .from("exchange_rate_cache")
    .select("*")
    .eq("pair", pair)
    .maybeSingle();
  // Throw, never read a failed query as "no row": the refresh would then
  // upsert a history of one point over the stored 90 days.
  if (error) throw error;
  return data ? fromRow(data) : null;
}

export function isStale(stored: StoredRate | null, now = Date.now()): boolean {
  if (!stored) return true;
  const age = now - new Date(stored.fetchedAt).getTime();
  return !Number.isFinite(age) || age >= STALE_AFTER_MS;
}

/**
 * Fetch a live quote and persist it with its merged daily history. Returns
 * the fresh row, or the stored one (possibly stale) when every source fails.
 * `fetched_at` only moves on a successful fetch — it's the staleness clock.
 */
export async function refreshStoredRate(
  pair: string,
  { stored }: { stored?: StoredRate | null } = {},
): Promise<StoredRate | null> {
  const current = stored === undefined ? await readStoredRate(pair) : stored;
  const [from, to] = splitPair(pair);
  const withHistory = (current?.history.length ?? 0) < MIN_POINTS_FOR_HISTORY;

  const quote = await fetchFxQuote(from, to, { withHistory }).catch((error) => {
    console.error(`[fx] quote fetch failed for ${pair}:`, error);
    return null;
  });
  if (!quote) return current;

  const today = toColombiaDateString(new Date());
  const history = mergeHistory(current?.history ?? [], quote.history, today, quote.rate);
  const avg30d = averageLastDays(history, today, AVG_WINDOW_DAYS);
  const fetchedAt = new Date().toISOString();

  // Await: the write must land before a serverless/route context exits.
  const { error } = await createAdminClient().from("exchange_rate_cache").upsert({
    pair,
    rate: quote.rate,
    rates_30d: history,
    avg_30d: avg30d,
    fetched_at: fetchedAt,
  });
  if (error) console.error(`[fx] cache write failed for ${pair}:`, error);

  return { ...toStored(pair, quote.rate, avg30d, fetchedAt, history), persisted: !error };
}

/** Pairs anyone has asked for — the cron refreshes all of them. */
export async function listStoredPairs(): Promise<string[]> {
  const { data } = await createAdminClient().from("exchange_rate_cache").select("pair");
  return (data ?? []).map((r) => r.pair);
}
