import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CaptureAuth = {
  userId: string;
  defaultAccountId: string | null;
  tokenId: string;
};

/**
 * Authenticate a request via `Bearer zeta_...` capture token.
 * Returns null if the token is missing, invalid, or revoked.
 */
export async function authenticateCaptureToken(
  request: NextRequest,
): Promise<CaptureAuth | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token.startsWith("zeta_")) return null;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("capture_tokens")
    .select("id, user_id, default_account_id")
    .eq("token", token)
    .is("revoked_at", null)
    .single();

  if (error || !data) return null;

  // Fire-and-forget: update last_used_at
  void admin
    .from("capture_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    userId: data.user_id,
    defaultAccountId: data.default_account_id,
    tokenId: data.id,
  };
}
