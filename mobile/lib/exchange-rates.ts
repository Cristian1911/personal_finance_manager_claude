import type { CurrencyCode } from "@zeta/shared";
import { getDatabase } from "./db/database";

/**
 * Exchange rates for the "≈ en COP / ARS" hint under a foreign-currency
 * amount. Same public source the webapp uses (fawazahmed0 currency API on
 * jsDelivr — static JSON, no key). Cached in SQLite for a day so the hint
 * keeps working offline once a pair has been seen, and never blocks a tap:
 * callers render nothing until a rate is available.
 */

// `/currencies/{from}.json` → `{ date, [from]: { [to]: rate } }`. The old
// single-pair `/{from}/{to}.json` path no longer answers with a flat
// `{ [to]: rate }`, which left the hint on a months-old cached rate.
const FAWAZ_URLS = [
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies",
  "https://latest.currency-api.pages.dev/v1/currencies",
];
const FRESH_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

type CachedRate = { rate: number; fetchedAt: number };
const memory = new Map<string, CachedRate>();
const inFlight = new Map<string, Promise<number | null>>();

function pairKey(from: CurrencyCode, to: CurrencyCode): string {
  return `${from}_${to}`;
}

async function readLocal(pair: string): Promise<CachedRate | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ rate: number; fetched_at: string }>(
      `SELECT rate, fetched_at FROM fx_rate_cache WHERE pair = ?`,
      [pair],
    );
    if (!row || !Number.isFinite(Number(row.rate))) return null;
    return { rate: Number(row.rate), fetchedAt: new Date(row.fetched_at).getTime() };
  } catch {
    return null;
  }
}

async function writeLocal(pair: string, rate: number): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO fx_rate_cache (pair, rate, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(pair) DO UPDATE SET rate = excluded.rate, fetched_at = excluded.fetched_at`,
      [pair, rate, new Date().toISOString()],
    );
  } catch {
    // Cache only — a failed write just means one more fetch tomorrow.
  }
}

async function fetchFrom(base: string, from: string, to: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/${from}.json`, { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, Record<string, unknown> | undefined>;
    const rate = data?.[from]?.[to];
    return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRemote(from: CurrencyCode, to: CurrencyCode): Promise<number | null> {
  for (const base of FAWAZ_URLS) {
    const rate = await fetchFrom(base, from.toLowerCase(), to.toLowerCase());
    if (rate) return rate;
  }
  return null;
}

/**
 * Units of `to` per 1 unit of `from`, or null when no rate is available
 * (offline and never cached). A stale cached rate is still returned when the
 * refresh fails — an approximate hint beats none.
 */
export async function getExchangeRate(from: CurrencyCode, to: CurrencyCode): Promise<number | null> {
  if (from === to) return 1;
  const pair = pairKey(from, to);

  const fresh = (entry: CachedRate | null | undefined) =>
    entry && Date.now() - entry.fetchedAt < FRESH_TTL_MS ? entry.rate : null;

  const inMemory = fresh(memory.get(pair));
  if (inMemory) return inMemory;

  const pending = inFlight.get(pair);
  if (pending) return pending;

  const task = (async () => {
    const local = await readLocal(pair);
    const localFresh = fresh(local);
    if (localFresh) {
      memory.set(pair, local!);
      return localFresh;
    }
    const remote = await fetchRemote(from, to);
    if (remote) {
      const entry = { rate: remote, fetchedAt: Date.now() };
      memory.set(pair, entry);
      void writeLocal(pair, remote);
      return remote;
    }
    // Offline: fall back to whatever we last saw, however old.
    if (local) {
      memory.set(pair, local);
      return local.rate;
    }
    return null;
  })().finally(() => {
    inFlight.delete(pair);
  });
  inFlight.set(pair, task);
  return task;
}

/** Rates from one currency to several targets; targets without a rate are omitted. */
export async function getConversionRates(
  from: CurrencyCode,
  targets: CurrencyCode[],
): Promise<Partial<Record<CurrencyCode, number>>> {
  const unique = [...new Set(targets.filter((c) => c !== from))];
  const results = await Promise.all(
    unique.map((to) => getExchangeRate(from, to).then((rate) => [to, rate] as const)),
  );
  const rates: Partial<Record<CurrencyCode, number>> = {};
  for (const [to, rate] of results) {
    if (rate) rates[to] = rate;
  }
  return rates;
}
