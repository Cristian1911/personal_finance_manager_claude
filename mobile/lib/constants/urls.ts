/**
 * Canonical webapp URLs. Single source of truth for external links.
 * Update here when the domain rebrand lands.
 */
const FALLBACK_WEBAPP_URL = "https://pfm.sanson1911.cloud";

export const WEBAPP_URL =
  process.env.EXPO_PUBLIC_API_URL ?? FALLBACK_WEBAPP_URL;

export const LEGAL_URLS = {
  privacy: `${WEBAPP_URL}/privacy`,
  terms: `${WEBAPP_URL}/terms`,
};
