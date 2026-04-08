import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Create a Supabase client authenticated with a user's access token.
 * Used inside "use cache" functions where request-scoped cookies are unavailable.
 *
 * The token provides auth.uid() context needed for zeta_decrypt() on encrypted
 * views, while allowing the response to be cached across requests.
 *
 * Cache entries are keyed by (userId, accessToken), so they auto-expire when
 * the JWT rotates (~1h). Mutations invalidate via revalidateTag() immediately.
 */
export function createCachedClient(accessToken: string) {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
