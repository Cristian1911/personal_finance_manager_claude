import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getRequestUser } from "@/app/api/_shared/auth";

/**
 * Mobile onboarding completion hook.
 *
 * Mobile writes `profiles` + `accounts` directly to Supabase (offline-first
 * pattern) and has no way to invalidate the Next.js Route Cache. The webapp
 * layout guard reads `profile.onboarding_completed` through `getProfile()`
 * which is `"use cache"` + `cacheTag("profile")` with `cacheLife("zeta")`
 * (stale 120s). Without this endpoint, a user who onboards on mobile and
 * opens the webapp within that window would get redirected back to
 * `/onboarding` because the cached profile still says `onboarding_completed: false`.
 *
 * Mobile calls this endpoint (fire-and-forget) after `persistOnboarding()`
 * succeeds. Auth is per-user session (Bearer or cookie); the endpoint refuses
 * anonymous requests. Tag invalidation is global per tag name — the extra
 * cost of clearing for all users on this one event is negligible.
 */
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Route Handler context — must use `revalidateTag` (not `updateTag`)
  // so the user's NEXT navigation sees fresh data. `updateTag` is
  // request-scoped read-your-own-writes and doesn't survive past this
  // webhook response. SWR semantics are fine here — eventual
  // consistency on profile/accounts is acceptable for onboarding completion.
  revalidateTag("profile", "zeta");
  revalidateTag("accounts", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  revalidateTag("dashboard:accounts", "zeta");

  return NextResponse.json({ ok: true });
}
