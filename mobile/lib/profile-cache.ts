/**
 * Session caches for profile-derived values.
 *
 * Lives in its own module (rather than in `profile.ts`) so `db/database.ts`
 * can clear it from `clearDatabase()` without importing `profile.ts`, which
 * imports `db/database.ts` back — a cycle.
 *
 * Why they're cleared on wipe: `clearDatabase()` runs on logout, user switch
 * (`auth.tsx` handleUserBoundary), demo enter/exit, account deletion and
 * "borrar todos mis datos" — 9 call sites. Leaving the values behind meant a
 * second user signing in during the same app session inherited the first
 * user's `nav_focus` and `preferred_currency` until relaunch.
 */
import type { CurrencyCode } from "@zeta/shared";
import type { NavFocus } from "./constants/mobile-nav";

let preferredCurrency: CurrencyCode | null = null;
let navFocus: NavFocus | null = null;

export function getCachedPreferredCurrency(): CurrencyCode | null {
  return preferredCurrency;
}

export function setCachedPreferredCurrency(value: CurrencyCode): void {
  preferredCurrency = value;
}

export function invalidatePreferredCurrency(): void {
  preferredCurrency = null;
}

export function getCachedNavFocus(): NavFocus | null {
  return navFocus;
}

export function setCachedNavFocus(value: NavFocus): void {
  navFocus = value;
}

export function invalidateNavFocus(): void {
  navFocus = null;
}

/** Clear everything derived from the profile row. Called by `clearDatabase()`. */
export function invalidateProfileCaches(): void {
  preferredCurrency = null;
  navFocus = null;
}
