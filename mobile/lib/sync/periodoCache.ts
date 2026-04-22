/**
 * Stale-while-revalidate cache for the `/periodo` screen.
 *
 * Background: planning_* tables aren't in the mobile sync engine yet,
 * so `mobile/app/periodo.tsx` hits Supabase directly on every focus.
 * This cache lets the screen render its last known payload instantly
 * while a fresh fetch runs in the background — avoiding a visible
 * loading spinner on every refocus.
 *
 * Keyed by user_id so concurrent multi-account scenarios don't leak,
 * and wiped on any auth boundary (logout / user switch) via
 * `clearPeriodoCache()` called from `lib/auth.tsx#handleUserBoundary`.
 *
 * Remove this module when planning tables land in SYNC_TABLES +
 * a repository is added under `mobile/lib/repositories/`. At that
 * point the screen should read from SQLite like every other screen
 * and the SWR workaround becomes dead code.
 */

// Opaque type — screens cast through the cache's get/set.
// Keeping it `unknown` here keeps the cache module independent of
// the screen's PeriodoData shape.
const cache = new Map<string, unknown>();

export function getPeriodoCache<T>(userId: string): T | undefined {
  return cache.has(userId) ? (cache.get(userId) as T) : undefined;
}

export function hasPeriodoCache(userId: string): boolean {
  return cache.has(userId);
}

export function setPeriodoCache<T>(userId: string, value: T): void {
  cache.set(userId, value);
}

export function clearPeriodoCache(): void {
  cache.clear();
}
