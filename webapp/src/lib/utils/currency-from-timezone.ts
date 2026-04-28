import type { CurrencyCode } from "@/types/domain";

/**
 * Infer a sensible default currency from the browser's IANA timezone.
 *
 * Used during onboarding so we don't force a manual currency pick in the
 * common case. Conservative — only maps countries we explicitly support
 * (mirrors `CURRENCIES` in `lib/constants/currencies.ts`). Anything else
 * falls back to COP (Zeta's primary market is Colombia).
 *
 * Users can still change the currency in Settings → Perfil after onboarding.
 */
const TIMEZONE_TO_CURRENCY: Record<string, CurrencyCode> = {
  // Colombia
  "America/Bogota": "COP",
  // Mexico
  "America/Mexico_City": "MXN",
  "America/Cancun": "MXN",
  "America/Monterrey": "MXN",
  "America/Tijuana": "MXN",
  "America/Mazatlan": "MXN",
  "America/Chihuahua": "MXN",
  "America/Hermosillo": "MXN",
  // Brazil
  "America/Sao_Paulo": "BRL",
  "America/Bahia": "BRL",
  "America/Fortaleza": "BRL",
  "America/Recife": "BRL",
  "America/Manaus": "BRL",
  // Peru
  "America/Lima": "PEN",
  // Chile
  "America/Santiago": "CLP",
  // Argentina
  "America/Argentina/Buenos_Aires": "ARS",
  "America/Argentina/Cordoba": "ARS",
  "America/Argentina/Mendoza": "ARS",
  // United States
  "America/New_York": "USD",
  "America/Chicago": "USD",
  "America/Denver": "USD",
  "America/Los_Angeles": "USD",
  "America/Phoenix": "USD",
  "America/Anchorage": "USD",
  "Pacific/Honolulu": "USD",
  // Eurozone (a small subset — most-used by Spanish speakers)
  "Europe/Madrid": "EUR",
  "Europe/Paris": "EUR",
  "Europe/Berlin": "EUR",
  "Europe/Rome": "EUR",
  "Europe/Lisbon": "EUR",
};

const DEFAULT_CURRENCY: CurrencyCode = "COP";

export function inferCurrencyFromTimezone(timezone: string | undefined | null): CurrencyCode {
  if (!timezone) return DEFAULT_CURRENCY;
  return TIMEZONE_TO_CURRENCY[timezone] ?? DEFAULT_CURRENCY;
}
