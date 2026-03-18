import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createClient } from "./server";

const IGNORABLE_AUTH_ERROR_CODES = new Set([
  "refresh_token_not_found",
  "invalid_refresh_token",
  "refresh_token_already_used",
  "session_not_found",
]);

type SupabaseWithAuth = {
  auth: {
    getUser: () => Promise<{
      data: { user: User | null };
      error: { code?: string; message?: string; status?: number } | null;
    }>;
    getSession: () => Promise<{
      data: { session: { user: User } | null };
      error: { code?: string; message?: string; status?: number } | null;
    }>;
  };
};

export function isIgnorableAuthError(
  error: unknown
): error is { code?: string; message?: string; status?: number } {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string; status?: number };
  const message = candidate.message?.toLowerCase() ?? "";
  return (
    (!!candidate.code && IGNORABLE_AUTH_ERROR_CODES.has(candidate.code)) ||
    message.includes("auth session missing") ||
    message.includes("refresh token not found") ||
    message.includes("invalid refresh token") ||
    message.includes("session not found")
  );
}

/**
 * Fast auth: try getSession() first (~0ms local JWT check), fall back to
 * getUser() (~300ms network call) if getSession() fails for any reason.
 *
 * This keeps the fast path for 99% of requests while being resilient to
 * cookie/JWT edge cases in production (different domain, expired refresh, etc.).
 */
export async function getUserSafely(
  supabase: SupabaseWithAuth
): Promise<User | null> {
  // Fast path: local JWT check — no network call
  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session?.user) {
      return data.session.user;
    }
    if (error && isIgnorableAuthError(error)) return null;
  } catch {
    // getSession() failed — fall through to getUser()
  }

  // Slow path: network round-trip to Supabase Auth
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (isIgnorableAuthError(error)) return null;
      throw error;
    }
    return data.user ?? null;
  } catch (error) {
    if (isIgnorableAuthError(error)) return null;
    throw error;
  }
}

/**
 * Strict auth: calls getUser() which makes a network round-trip to verify
 * the session hasn't been revoked. Use this as a fallback when a query
 * fails with an auth error after using the fast path.
 */
export async function getUserSafelyStrict(
  supabase: SupabaseWithAuth
): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (isIgnorableAuthError(error)) return null;
      throw error;
    }
    return data.user ?? null;
  } catch (error) {
    if (isIgnorableAuthError(error)) return null;
    throw error;
  }
}

/**
 * Request-scoped cached auth. React `cache()` deduplicates within a single
 * server render, so the dashboard (which fires 8+ parallel data fetches)
 * only verifies the JWT once per page load instead of once per function.
 *
 * Uses getSession() (local JWT check, ~0ms) instead of getUser() (~300ms
 * network call to Supabase Auth). If the session is revoked, the admin
 * client queries in cached functions will still work (they bypass auth),
 * and the middleware will catch the revoked token on the next request.
 */
export const getAuthenticatedClient = cache(async (): Promise<{
  supabase: SupabaseClient<Database>;
  user: User | null;
}> => {
  const supabase = await createClient();
  const user = await getUserSafely(supabase);
  return { supabase, user };
});
