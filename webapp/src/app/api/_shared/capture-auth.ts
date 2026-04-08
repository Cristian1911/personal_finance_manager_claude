import type { NextRequest } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

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

  // Query _enc table directly — this runs in unauthenticated context (Bearer auth),
  // so the view's zeta_decrypt can't resolve auth.uid(). Use token_hash for lookup.
  const { data, error } = await admin
    .from("capture_tokens_enc" as "capture_tokens")
    .select("id, user_id, default_account_id")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .single();

  if (error || !data) return null;

  // Fire-and-forget: update last_used_at (use view — auth context not needed for admin client update)
  void admin
    .from("capture_tokens_enc" as "capture_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    userId: data.user_id,
    defaultAccountId: data.default_account_id,
    tokenId: data.id,
  };
}
