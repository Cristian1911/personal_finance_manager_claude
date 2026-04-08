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
