import { headers } from "next/headers";

/**
 * Detect mobile requests from User-Agent header.
 * Used to skip expensive server-side rendering of mobile-only zones on desktop.
 * CSS `lg:hidden` remains as a secondary safeguard.
 */
export async function isMobileRequest(): Promise<boolean> {
  const headersList = await headers();
  const ua = headersList.get("user-agent") ?? "";
  return /mobile|iphone|android|windows phone/i.test(ua);
}
