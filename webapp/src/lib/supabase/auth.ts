import type { User } from "@supabase/supabase-js";

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
  };
};

export function isIgnorableAuthError(
  error: unknown
): error is { code?: string; message?: string; status?: number } {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string; status?: number };
  return !!candidate.code && IGNORABLE_AUTH_ERROR_CODES.has(candidate.code);
}

export async function getUserSafely(
  supabase: SupabaseWithAuth
): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (isIgnorableAuthError(error)) {
        return null;
      }
      throw error;
    }
    return data.user ?? null;
  } catch (error) {
    if (isIgnorableAuthError(error)) {
      return null;
    }
    throw error;
  }
}
