import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const RECOVERY_REDIRECT = "/reset-password";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // Behind the proxy, request.url resolves to the internal 0.0.0.0:3000 bind and
  // NEXT_PUBLIC_* is inlined at build time (empty at runtime), so derive the
  // public base from the proxy-forwarded Host header. The Host header is
  // client-controllable, so validate it against an allowlist of trusted public
  // hosts to prevent host-header injection (redirecting the OAuth code off-site).
  // APP_URL (non-public → read at runtime) lets other deployments override.
  const allowedHosts = new Set(
    [
      process.env.APP_URL ? new URL(process.env.APP_URL).host : null,
      "pfm.sanson1911.cloud",
      "localhost:3000",
    ].filter((h): h is string => Boolean(h))
  );
  const host = request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ??
    new URL(request.url).protocol.replace(":", "");
  const base = host && allowedHosts.has(host) ? `${proto}://${host}` : origin;
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
