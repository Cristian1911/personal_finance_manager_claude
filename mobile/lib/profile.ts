import { useEffect, useState } from "react";
import type { CurrencyCode } from "@zeta/shared";
import { getDatabase } from "./db/database";
import type { NavFocus } from "./constants/mobile-nav";
import {
  getCachedNavFocus,
  getCachedPreferredCurrency,
  invalidateNavFocus,
  invalidatePreferredCurrency,
  setCachedNavFocus,
  setCachedPreferredCurrency,
} from "./profile-cache";

export { invalidateNavFocus, invalidatePreferredCurrency };

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
  /** "PLAN" | "DEBT" — drives which screen owns the third tab slot. */
  nav_focus?: string | null;
};

export async function getLocalProfile(): Promise<LocalProfile | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LocalProfile>(
    `SELECT id, full_name, app_purpose, estimated_monthly_income,
            estimated_monthly_expenses, preferred_currency, timezone, locale,
            onboarding_completed, location_tracking_enabled,
            dashboard_config, mobile_dashboard_config, nav_focus
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
 * Update editable profile fields (name + preferred currency), mirroring the
 * webapp `updateProfile` action. Writes locally + enqueues a `profiles` UPDATE.
 * The remote `profiles` view's INSTEAD OF trigger re-encrypts full_name — the
 * same proven push path used by `setLocationTrackingEnabled`.
 */
export async function updateProfile(params: {
  full_name: string;
  preferred_currency: CurrencyCode;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const profile = await getLocalProfile();
  if (!profile) return;
  const fullName = params.full_name.trim();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE profiles SET full_name = ?, preferred_currency = ?, updated_at = ? WHERE id = ?`,
      [fullName, params.preferred_currency, now, profile.id]
    );
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES ('profiles', ?, 'UPDATE', ?, ?)`,
      [
        profile.id,
        JSON.stringify({
          full_name: fullName,
          preferred_currency: params.preferred_currency,
          updated_at: now,
        }),
        now,
      ]
    );
  });

  invalidatePreferredCurrency();
}

/**
 * The profile row is effectively immutable during a session (changing it
 * requires a Supabase write via Settings), so there's no reason to re-hit
 * SQLite on every filter change in every Root screen. The cache itself lives
 * in `profile-cache.ts` so `clearDatabase()` can drop it without an import
 * cycle; call the invalidators from any path that mutates the profile row.
 */
export async function getPreferredCurrency(): Promise<CurrencyCode> {
  const cached = getCachedPreferredCurrency();
  if (cached) return cached;
  const profile = await getLocalProfile();
  const value = (profile?.preferred_currency as CurrencyCode | null) ?? "COP";
  setCachedPreferredCurrency(value);
  return value;
}

/**
 * Which screen owns the third tab slot — mirrors the webapp's
 * `NavFocusProvider`.
 */
export async function getNavFocus(): Promise<NavFocus> {
  const cached = getCachedNavFocus();
  if (cached) return cached;
  const profile = await getLocalProfile();
  const value: NavFocus = profile?.nav_focus === "DEBT" ? "DEBT" : "PLAN";
  setCachedNavFocus(value);
  return value;
}

/**
 * Reads `nav_focus` from local SQLite. Starts at "PLAN" (the DB default) and
 * corrects on the first read — never blocks a tap on a remote round-trip.
 */
export function useNavFocus(): NavFocus {
  const [focus, setFocus] = useState<NavFocus>(getCachedNavFocus() ?? "PLAN");

  useEffect(() => {
    let active = true;
    getNavFocus()
      .then((value) => {
        if (active) setFocus(value);
      })
      .catch(() => {
        // Profile not pulled yet — "PLAN" (the DB default) stays correct.
      });
    return () => {
      active = false;
    };
  }, []);

  return focus;
}
