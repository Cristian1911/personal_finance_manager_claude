import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // `.+` (not `.*`) intentionally excludes bare `/` — Supabase SSR's chunked
    // `sb-*-auth-token.N` cookies push landing response headers past NPM's
    // `proxy_buffer_size` and return 502. Landing is public, no session needed.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).+)",
  ],
};
