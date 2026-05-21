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
  /** 0 / 1 — opt-in flag for background location tracking on mobile. */
  location_tracking_enabled: number;
  dashboard_config?: string | null;
  mobile_dashboard_config?: string | null;
};

export async function getLocalProfile(): Promise<LocalProfile | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LocalProfile>(
    `SELECT id, full_name, app_purpose, estimated_monthly_income,
            estimated_monthly_expenses, preferred_currency, timezone, locale,
            onboarding_completed, location_tracking_enabled,
            dashboard_config, mobile_dashboard_config
     FROM profiles
     ORDER BY updated_at DESC
     LIMIT 1`
  );
}

/**
 * Toggle the local location-tracking flag and enqueue a sync row so the
 * webapp/Supabase converge. Returns the new value.
 */
export async function setLocationTrackingEnabled(enabled: boolean): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const profile = await getLocalProfile();
  if (!profile) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE profiles SET location_tracking_enabled = ?, updated_at = ? WHERE id = ?`,
      [enabled ? 1 : 0, now, profile.id]
    );
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES ('profiles', ?, 'UPDATE', ?, ?)`,
      [
        profile.id,
        JSON.stringify({ location_tracking_enabled: enabled, updated_at: now }),
        now,
      ]
    );
  });
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
