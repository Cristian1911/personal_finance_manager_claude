import { supabase } from "../supabase";
import { getDatabase } from "../db/database";
import {
  ARRANGEABLE_TYPES,
  DEFAULT_LAYOUT,
  type DashboardLayout,
  type WidgetInstance,
} from "./widgets";

/**
 * Filters a persisted layout so only arrangeable widget types survive. Older
 * layouts may reference system-widget types (`ritmo`, `where_today`,
 * `attention`) or deprecated catalog entries (`accounts`, `next_bill`, etc.)
 * which now belong in the fixed Herramientas row or are disabled.
 */
export function normalizeLayout(
  raw: Partial<DashboardLayout> | null | undefined
): DashboardLayout {
  if (!raw) return DEFAULT_LAYOUT;
  const widgets = (raw.widgets ?? [])
    .filter(
      (w): w is WidgetInstance =>
        !!w && typeof w.type === "string" && ARRANGEABLE_TYPES.has(w.type)
    )
    .map((w) => ({ id: w.id, type: w.type, size: w.size }));
  if (widgets.length === 0) return DEFAULT_LAYOUT;
  return {
    pulseRange: raw.pulseRange ?? DEFAULT_LAYOUT.pulseRange,
    widgets,
  };
}

/**
 * Reads the layout from local SQLite. Returns DEFAULT_LAYOUT when nothing is
 * persisted locally. Supabase is the source of truth on write; the sync pull
 * mirrors `profiles.mobile_dashboard_config` into SQLite so the next launch
 * hits this path with zero latency.
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
      if (parsed) return normalizeLayout(parsed);
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

