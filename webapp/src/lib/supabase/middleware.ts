import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getUserSafely } from "@/lib/supabase/auth";

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  const authCookieNames = request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith("sb-") && name.includes("-auth-token"));

  for (const name of authCookieNames) {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
    });
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Try cookie-based session first (web). If absent, fall back to
  // Authorization: Bearer (mobile). Both paths populate `user`, so every route —
  // including /api — stays gated centrally. Route handlers still self-auth via
  // getRequestUser() as defense-in-depth.
  let user = await getUserSafely(supabase);

  if (!user) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const { data } = await supabase.auth.getUser(authHeader.slice(7));
      user = data.user ?? null;
    }
  }

  if (!user) {
    clearAuthCookies(request, supabaseResponse);
  }

  // Blacklist pattern: everything is protected unless explicitly listed as public.
  const publicPaths = [
    "/login",
    "/signup",
    "/forgot-password",
    "/onboarding",
    "/auth",
    "/api/webhooks",
  ];
  const pathname = request.nextUrl.pathname;
  const isPublic =
    pathname === "/" ||
    publicPaths.some((p) => pathname.startsWith(p));
  const isProtected = !isPublic;

  if (!user && isProtected) {
    // API requests get JSON 401 instead of a redirect — iOS FileSystem.uploadAsync
    // follows 3xx, so a redirect to /login would cause Next.js to try to parse a
    // multipart POST as a Server Action ("Failed to find Server Action 'x'").
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Auth routes: redirect to dashboard if already logged in
  const authPaths = ["/login", "/signup", "/forgot-password"];
  const isAuthRoute = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Prevent Safari from serving stale HTML after deploys (causes 502s)
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    supabaseResponse.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate"
    );
  }

  return supabaseResponse;
}
