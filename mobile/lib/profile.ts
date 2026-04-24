import type { CurrencyCode } from "@zeta/shared";
import { getDatabase } from "./db/database";

export type LocalProfile = {
  id: string;
  full_name: string | null;
  app_purpose: string | null;
  estimated_monthly_income: number | null;
  estimated_monthly_expenses: number | null;
  preferred_currency: string | null;
  timezone: string | null;
  locale: string | null;
  onboarding_completed: number;
  dashboard_config?: string | null;
  mobile_dashboard_config?: string | null;
};

export async function getLocalProfile(): Promise<LocalProfile | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LocalProfile>(
    `SELECT id, full_name, app_purpose, estimated_monthly_income,
            estimated_monthly_expenses, preferred_currency, timezone, locale,
            onboarding_completed,
            dashboard_config, mobile_dashboard_config
     FROM profiles
     ORDER BY updated_at DESC
     LIMIT 1`
  );
}

/**
 * In-memory cache for the preferred currency. The profile row is effectively
 * immutable during a session (changing it requires a Supabase write via
 * Settings), so there's no reason to re-hit SQLite on every filter change in
 * every Root screen. Call `invalidatePreferredCurrency()` from any path that
 * mutates `profiles.preferred_currency`.
 */
let cachedPreferredCurrency: CurrencyCode | null = null;

export function invalidatePreferredCurrency(): void {
  cachedPreferredCurrency = null;
}

export async function getPreferredCurrency(): Promise<CurrencyCode> {
  if (cachedPreferredCurrency) return cachedPreferredCurrency;
  const profile = await getLocalProfile();
  cachedPreferredCurrency =
    (profile?.preferred_currency as CurrencyCode | null) ?? "COP";
  return cachedPreferredCurrency;
}
