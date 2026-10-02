import "server-only";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

/**
 * Zeta v2's backend is its own Supabase project (S9-2): these routes never
 * touch the web app's production database or its auth. Unset → v2 is off.
 */
export function v2Config(): { url: string; publishableKey: string; databaseUrl: string } | null {
  const url = process.env.V2_SUPABASE_URL;
  const publishableKey = process.env.V2_SUPABASE_PUBLISHABLE_KEY;
  const databaseUrl = process.env.V2_DATABASE_URL;
  return url && publishableKey && databaseUrl ? { url, publishableKey, databaseUrl } : null;
}

let pool: Pool | null = null;
export function v2Pool(databaseUrl: string): Pool {
  // ponytail: one small pool per server process; raise max if sync traffic needs it.
  return (pool ??= new Pool({ connectionString: databaseUrl, max: 5 }));
}

/** The v2 user behind `Authorization: Bearer <access token>`, or null. */
export async function v2User(request: Request, cfg: { url: string; publishableKey: string }): Promise<{ id: string } | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const supabase = createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(header.slice(7));
  return error || !data.user ? null : { id: data.user.id };
}
