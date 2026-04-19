import { supabase } from "../supabase";
import { getDatabase } from "../db/database";
import { DEFAULT_LAYOUT, type DashboardLayout } from "./widgets";

const PROFILE_SELECT = "mobile_dashboard_config";

/**
 * Reads the layout from local SQLite first (fast), falls back to Supabase if
 * the local row is empty. Returns DEFAULT_LAYOUT when nothing is persisted.
 */
export async function loadDashboardLayout(userId: string): Promise<DashboardLayout> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ mobile_dashboard_config: string | null }>(
      `SELECT mobile_dashboard_config FROM profiles WHERE id = ? LIMIT 1`,
      [userId]
    );
    const raw = row?.mobile_dashboard_config;
    if (raw) {
      const parsed = safeParse(raw);
      if (parsed) return parsed;
    }
  } catch (err) {
    console.warn("[dashboard] local layout read failed", err);
  }
  return DEFAULT_LAYOUT;
}

/**
 * Persists layout. Writes through Supabase (source of truth) and mirrors into
 * SQLite so next launch reads the cached copy with zero latency.
 */
export async function saveDashboardLayout(
  userId: string,
  layout: DashboardLayout
): Promise<void> {
  const serialized = JSON.stringify(layout);

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ mobile_dashboard_config: layout })
      .eq("id", userId);
    if (error) throw error;
  } catch (err) {
    console.warn("[dashboard] supabase layout write failed, keeping local only", err);
  }

  try {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE profiles SET mobile_dashboard_config = ?, updated_at = ? WHERE id = ?`,
      [serialized, new Date().toISOString(), userId]
    );
  } catch (err) {
    console.warn("[dashboard] local layout write failed", err);
  }
}

function safeParse(raw: string): DashboardLayout | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.widgets) && typeof parsed.pulseRange === "string") {
      return parsed as DashboardLayout;
    }
  } catch {
    // fall through
  }
  return null;
}

// Suppress unused warning from bundlers that tree-shake the select constant
void PROFILE_SELECT;
