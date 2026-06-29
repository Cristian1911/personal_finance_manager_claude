const STATIC_ALLOWED_HOSTS = ["pfm.sanson1911.cloud", "localhost:3000"];

/**
 * Trusted public base URL for building auth-email redirect links from a Server
 * Action. Behind the proxy, `NEXT_PUBLIC_APP_URL` is inlined at build time and
 * can be empty at runtime (see `app/auth/callback/route.ts`), which would make
 * the reset/confirm link a relative `/auth/callback` and break the recovery
 * flow. So derive the base from the forwarded Host header — validated against an
 * allowlist, because the Host header is client-controllable and an unvalidated
 * value would let an attacker redirect a recovery token off-site (account
 * takeover).
 */
export function derivePublicBaseUrl(
  host: string | null | undefined,
  proto: string | null | undefined
): string {
  let appUrlHost: string | null = null;
  if (process.env.APP_URL) {
    try {
      appUrlHost = new URL(process.env.APP_URL).host.toLowerCase();
    } catch {
      // Ignore a misconfigured APP_URL rather than crash.
    }
  }
  const allowed = new Set(
    [appUrlHost, ...STATIC_ALLOWED_HOSTS].filter((h): h is string => Boolean(h))
  );
  const normalizedHost = host?.toLowerCase();
  if (normalizedHost && allowed.has(normalizedHost)) {
    // Local dev (no proxy) has no x-forwarded-proto and runs on http.
    const defaultProto =
      normalizedHost.startsWith("localhost") ||
      normalizedHost.startsWith("127.0.0.1")
        ? "http"
        : "https";
    return `${proto || defaultProto}://${normalizedHost}`;
  }
  // Allowlist miss (or no Host header) → explicit env, else the canonical host.
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://pfm.sanson1911.cloud"
  );
}
