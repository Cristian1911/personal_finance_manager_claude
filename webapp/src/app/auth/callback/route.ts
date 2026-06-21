import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const RECOVERY_REDIRECT = "/reset-password";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // ponytail: behind the proxy, request.url resolves to the internal 0.0.0.0:3000
  // bind, so redirects must use the canonical app URL. Falls back to origin in dev.
  const base = process.env.NEXT_PUBLIC_APP_URL || origin;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next");
  // Block protocol-relative ("//host") and backslash ("/\host") forms — both
  // normalize to an off-origin URL via new URL(next, base) → open redirect.
  const safeNext =
    nextParam &&
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    !nextParam.startsWith("/\\")
      ? nextParam
      : null;
  const next = safeNext ?? (type === "recovery" ? RECOVERY_REDIRECT : "/dashboard");

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, base));
    }
    return NextResponse.redirect(
      new URL(`/login?error=auth_callback_failed&reason=${encodeURIComponent(error.message)}`, base)
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, base));
    }
    return NextResponse.redirect(
      new URL(`/login?error=auth_callback_failed&reason=${encodeURIComponent(error.message)}`, base)
    );
  }

  return NextResponse.redirect(new URL(`/login?error=auth_callback_missing_params`, base));
}
