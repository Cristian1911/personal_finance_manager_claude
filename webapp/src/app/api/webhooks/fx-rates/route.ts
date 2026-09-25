import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { listStoredPairs, refreshStoredRate } from "@/lib/fx/rate-store";

/**
 * Hourly FX refresh (weekdays), called by `.github/workflows/fx-rates-cron.yml`.
 *
 * Refreshes every pair in `exchange_rate_cache` (plus USD_COP, the one the
 * app always needs) from the live quote source, then expires the
 * `exchange-rates` cache tag so the next render reads the new row.
 *
 * Public path (under /api/webhooks) — auth is the shared `CRON_SECRET` in the
 * `x-cron-secret` header. Missing secret on the server = endpoint disabled.
 */
const ALWAYS_REFRESH = ["USD_COP"];
const PAIR_RE = /^[A-Z]{3}_[A-Z]{3}$/;

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const given = request.headers.get("x-cron-secret");
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pairs = [...new Set([...ALWAYS_REFRESH, ...(await listStoredPairs())])].filter((p) =>
    PAIR_RE.test(p),
  );

  // Sequential: a handful of pairs, and a burst invites 429s from the source.
  const results: { pair: string; ok: boolean; rate: number | null; fetchedAt: string | null }[] = [];
  for (const pair of pairs) {
    const before = Date.now();
    const stored = await refreshStoredRate(pair).catch((error) => {
      console.error(`[fx-cron] ${pair} refresh failed:`, error);
      return null;
    });
    const fresh =
      !!stored && stored.persisted === true && new Date(stored.fetchedAt).getTime() >= before;
    results.push({ pair, ok: fresh, rate: stored?.rate ?? null, fetchedAt: stored?.fetchedAt ?? null });
  }

  // Route Handler: revalidateTag, not updateTag. expire: 0 so the next
  // request recomputes instead of serving the old rate while revalidating.
  revalidateTag("exchange-rates", { expire: 0 });

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json(
    { ok: failed.length === 0, results },
    { status: failed.length === results.length ? 502 : 200 },
  );
}
