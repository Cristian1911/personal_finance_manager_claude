/**
 * Helper to determine the demo filter state for data queries.
 * When demo_mode is true, queries should only return demo data.
 * When demo_mode is false, queries should exclude demo data.
 *
 * Cached with "use cache" + cacheTag("profile") so it doesn't
 * add an extra DB query per page render.
 */

import { cacheTag, cacheLife } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Returns the is_demo filter value for a given user.
 * - `true` → user is in demo mode, show only demo data
 * - `false` → user is in normal mode, show only real data
 *
 * Uses adminClient because demo_mode is not an encrypted column —
 * we only SELECT a plain boolean. Invalidated via revalidateTag("profile").
 */
export async function getIsDemoFilter(userId: string): Promise<boolean> {
  "use cache";
  cacheTag("profile");
  cacheLife("zeta");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("demo_mode")
    .eq("id", userId)
    .single();

  return data?.demo_mode ?? false;
}

/**
 * Fetches account IDs matching the demo filter for a user.
 * Returns null if no accounts match (caller should return empty).
 */
export async function getDemoAccountIds(
  supabase: SupabaseClient<Database>,
  userId: string,
  isDemo: boolean
): Promise<string[] | null> {
  const { data } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("is_demo", isDemo);
  const ids = (data ?? []).map((a) => a.id);
  return ids.length > 0 ? ids : null;
}
