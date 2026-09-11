/**
 * Onboarding default currency from the browser timezone.
 *
 * The map itself lives in `@zeta/shared` (`timezone.ts`) so the mobile app
 * and the webapp agree on which zone maps to which currency; this module is
 * kept so existing imports keep working.
 */
export { inferCurrencyFromTimezone } from "@zeta/shared";
