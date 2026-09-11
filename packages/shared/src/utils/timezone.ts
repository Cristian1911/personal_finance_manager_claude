import type { CurrencyCode } from "../types/domain";

/**
 * Timezone helpers shared by the webapp and the mobile app.
 *
 * Zeta stores every `transaction_date` / `transaction_time` as Colombian wall
 * clock (America/Bogota, UTC-5, no DST) — the banks report in that clock and
 * every "today" computation assumes it. When the user travels, the phone's
 * clock (and the receipt in their hand) runs on a different offset, so the
 * app needs to (a) detect the shift from the device timezone and (b) show or
 * apply the conversion between "hora local" and "hora Colombia".
 *
 * Pure functions only — no React, no platform APIs beyond `Intl`, which both
 * V8 and Hermes ship. Everything works on "YYYY-MM-DD" + "HH:mm[:ss]" strings
 * so callers never build a `Date` from a bare date string (midnight-UTC bug).
 */

export const COLOMBIA_TIMEZONE = "America/Bogota";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** True when `Intl` can resolve the IANA name (guards user-supplied strings). */
export function isValidTimeZone(timeZone: string | null | undefined): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

/**
 * The device's IANA timezone, or null when the runtime can't report one.
 * On the web call it on the client only (server renders in the container tz).
 */
export function getDeviceTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isValidTimeZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

type WallParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsFormatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatterCache.set(timeZone, fmt);
  }
  return fmt;
}

/** Wall-clock components of an instant in the given timezone. */
export function getWallParts(instant: Date, timeZone: string): WallParts {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  // Some engines still emit "24" for midnight even with h23 — normalise.
  const hour = read("hour") % 24;
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour,
    minute: read("minute"),
    second: read("second"),
  };
}

/**
 * Offset of `timeZone` from UTC at `instant`, in minutes (Bogotá → -300,
 * Buenos Aires → -180, Madrid in summer → +120).
 */
export function getTimeZoneOffsetMinutes(timeZone: string, instant: Date = new Date()): number {
  const p = getWallParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Drop sub-second noise so the division is exact.
  const instantMs = instant.getTime() - instant.getMilliseconds();
  return Math.round((asUtc - instantMs) / 60_000);
}

/** "UTC-5", "UTC+5:30", "UTC" */
export function formatUtcOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "UTC";
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${pad2(m)}`;
}

/** Format an instant as { date: "YYYY-MM-DD", time: "HH:mm" } in a timezone. */
export function formatWallTime(instant: Date, timeZone: string): { date: string; time: string } {
  const p = getWallParts(instant, timeZone);
  return {
    date: `${p.year}-${pad2(p.month)}-${pad2(p.day)}`,
    time: `${pad2(p.hour)}:${pad2(p.minute)}`,
  };
}

/**
 * The instant at which `date` + `time` is the wall clock in `timeZone`.
 * Two-pass so DST boundaries resolve to the right offset. Returns null on
 * malformed input.
 */
export function zonedWallTimeToInstant(
  date: string,
  time: string,
  timeZone: string,
): Date | null {
  const d = DATE_RE.exec(date);
  const t = TIME_RE.exec(time);
  if (!d || !t) return null;
  const naiveUtc = Date.UTC(
    Number(d[1]),
    Number(d[2]) - 1,
    Number(d[3]),
    Number(t[1]),
    Number(t[2]),
    Number(t[3] ?? "0"),
  );
  if (!Number.isFinite(naiveUtc)) return null;
  const firstGuess = new Date(naiveUtc - getTimeZoneOffsetMinutes(timeZone, new Date(naiveUtc)) * 60_000);
  const secondOffset = getTimeZoneOffsetMinutes(timeZone, firstGuess);
  return new Date(naiveUtc - secondOffset * 60_000);
}

/**
 * Re-express a wall clock from one timezone in another. Rolls the date when
 * the shift crosses midnight ("23:30 en Madrid" → "16:30 del mismo día en
 * Bogotá"; "01:00 en Buenos Aires" → "23:00 del día anterior").
 */
export function convertWallTime(input: {
  date: string;
  time: string;
  fromTimeZone: string;
  toTimeZone: string;
}): { date: string; time: string } | null {
  const instant = zonedWallTimeToInstant(input.date, input.time, input.fromTimeZone);
  if (!instant) return null;
  return formatWallTime(instant, input.toTimeZone);
}

/** Human labels for the zones Zeta users actually travel between. */
const TIMEZONE_LABELS_ES: Record<string, string> = {
  "America/Bogota": "Bogotá",
  "America/Argentina/Buenos_Aires": "Buenos Aires",
  "America/Argentina/Cordoba": "Córdoba",
  "America/Argentina/Mendoza": "Mendoza",
  "America/Sao_Paulo": "São Paulo",
  "America/Mexico_City": "Ciudad de México",
  "America/Cancun": "Cancún",
  "America/Lima": "Lima",
  "America/Santiago": "Santiago",
  "America/Panama": "Panamá",
  "America/Guayaquil": "Quito",
  "America/Caracas": "Caracas",
  "America/Montevideo": "Montevideo",
  "America/La_Paz": "La Paz",
  "America/Asuncion": "Asunción",
  "America/Costa_Rica": "San José",
  "America/Santo_Domingo": "Santo Domingo",
  "America/New_York": "Nueva York",
  "America/Chicago": "Chicago",
  "America/Denver": "Denver",
  "America/Los_Angeles": "Los Ángeles",
  "America/Toronto": "Toronto",
  "Europe/Madrid": "Madrid",
  "Europe/London": "Londres",
  "Europe/Paris": "París",
  "Europe/Berlin": "Berlín",
  "Europe/Rome": "Roma",
  "Europe/Lisbon": "Lisboa",
};

/** "America/Argentina/Buenos_Aires" → "Buenos Aires" */
export function describeTimeZone(timeZone: string): string {
  const known = TIMEZONE_LABELS_ES[timeZone];
  if (known) return known;
  const last = timeZone.split("/").pop() ?? timeZone;
  return last.replace(/_/g, " ");
}

export interface TimeShiftHint {
  /** IANA zone the device reported. */
  deviceTimeZone: string;
  /** "Buenos Aires" */
  deviceLabel: string;
  /** "UTC-3" */
  deviceOffsetLabel: string;
  /** Device offset minus reference offset, in minutes (+120 when 2h ahead). */
  diffMinutes: number;
  /** "+2 h", "-1 h", "+5:30 h" */
  diffLabel: string;
  /** Input wall clock in the reference zone ("HH:mm"). */
  referenceTime: string;
  /** Same instant expressed in the device zone. */
  localTime: string;
  localDate: string;
  /** True when the device-zone date differs from the reference date. */
  dateShifted: boolean;
}

function formatDiff(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${sign}${h} h` : `${sign}${h}:${pad2(m)} h`;
}

/**
 * Describe how a Colombian wall clock reads in the device timezone. Returns
 * null when the device is on the same offset (nothing to hint), or when the
 * inputs are unusable — callers can render nothing in either case.
 */
export function buildTimeShiftHint(input: {
  date: string;
  time: string | null | undefined;
  deviceTimeZone: string | null | undefined;
  referenceTimeZone?: string;
}): TimeShiftHint | null {
  const reference = input.referenceTimeZone ?? COLOMBIA_TIMEZONE;
  const { date, time, deviceTimeZone } = input;
  if (!deviceTimeZone || !time || !DATE_RE.test(date) || !TIME_RE.test(time)) return null;
  if (deviceTimeZone === reference) return null;
  if (!isValidTimeZone(deviceTimeZone) || !isValidTimeZone(reference)) return null;

  const instant = zonedWallTimeToInstant(date, time, reference);
  if (!instant) return null;
  const deviceOffset = getTimeZoneOffsetMinutes(deviceTimeZone, instant);
  const referenceOffset = getTimeZoneOffsetMinutes(reference, instant);
  const diffMinutes = deviceOffset - referenceOffset;
  if (diffMinutes === 0) return null;

  const local = formatWallTime(instant, deviceTimeZone);
  return {
    deviceTimeZone,
    deviceLabel: describeTimeZone(deviceTimeZone),
    deviceOffsetLabel: formatUtcOffset(deviceOffset),
    diffMinutes,
    diffLabel: formatDiff(diffMinutes),
    referenceTime: time.slice(0, 5),
    localTime: local.time,
    localDate: local.date,
    dateShifted: local.date !== date,
  };
}

/**
 * Convert a wall clock typed in the device zone into the Colombian clock we
 * store. Convenience over `convertWallTime` for the "Usar hora local" action.
 */
export function localWallTimeToColombia(
  date: string,
  time: string,
  deviceTimeZone: string,
): { date: string; time: string } | null {
  return convertWallTime({
    date,
    time,
    fromTimeZone: deviceTimeZone,
    toTimeZone: COLOMBIA_TIMEZONE,
  });
}

/* ─── Currency inference ────────────────────────────────────────────────── */

/**
 * Conservative IANA timezone → currency map. Only the currencies Zeta
 * supports; anything else returns null so callers can fall back.
 */
const TIMEZONE_TO_CURRENCY: Record<string, CurrencyCode> = {
  "America/Bogota": "COP",
  "America/Mexico_City": "MXN",
  "America/Cancun": "MXN",
  "America/Monterrey": "MXN",
  "America/Tijuana": "MXN",
  "America/Mazatlan": "MXN",
  "America/Chihuahua": "MXN",
  "America/Hermosillo": "MXN",
  "America/Merida": "MXN",
  "America/Sao_Paulo": "BRL",
  "America/Bahia": "BRL",
  "America/Fortaleza": "BRL",
  "America/Recife": "BRL",
  "America/Manaus": "BRL",
  "America/Belem": "BRL",
  "America/Lima": "PEN",
  "America/Santiago": "CLP",
  "America/Punta_Arenas": "CLP",
  "America/Argentina/Buenos_Aires": "ARS",
  "America/Argentina/Cordoba": "ARS",
  "America/Argentina/Mendoza": "ARS",
  "America/Argentina/Salta": "ARS",
  "America/Argentina/Ushuaia": "ARS",
  "America/New_York": "USD",
  "America/Chicago": "USD",
  "America/Denver": "USD",
  "America/Los_Angeles": "USD",
  "America/Phoenix": "USD",
  "America/Anchorage": "USD",
  "Pacific/Honolulu": "USD",
  "America/Detroit": "USD",
  "America/Panama": "USD",
  "America/Guayaquil": "USD",
  "America/El_Salvador": "USD",
  "Europe/Madrid": "EUR",
  "Europe/Paris": "EUR",
  "Europe/Berlin": "EUR",
  "Europe/Rome": "EUR",
  "Europe/Lisbon": "EUR",
  "Europe/Amsterdam": "EUR",
  "Europe/Brussels": "EUR",
  "Europe/Vienna": "EUR",
  "Europe/Dublin": "EUR",
  "Europe/Athens": "EUR",
  "Atlantic/Canary": "EUR",
};

/** Currency of the country the device timezone belongs to, or null. */
export function currencyForTimeZone(timeZone: string | null | undefined): CurrencyCode | null {
  if (!timeZone) return null;
  const direct = TIMEZONE_TO_CURRENCY[timeZone];
  if (direct) return direct;
  if (timeZone.startsWith("America/Argentina/")) return "ARS";
  if (timeZone.startsWith("Europe/")) return null; // not every European zone is EUR
  return null;
}

/**
 * Country → currency, tolerant to how reverse geocoders name countries:
 * ISO-3166 alpha-2 codes, English names, Spanish names, local spellings.
 */
const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  co: "COP",
  colombia: "COP",
  ar: "ARS",
  argentina: "ARS",
  br: "BRL",
  brasil: "BRL",
  brazil: "BRL",
  mx: "MXN",
  mexico: "MXN",
  méxico: "MXN",
  pe: "PEN",
  peru: "PEN",
  perú: "PEN",
  cl: "CLP",
  chile: "CLP",
  us: "USD",
  usa: "USD",
  "united states": "USD",
  "united states of america": "USD",
  "estados unidos": "USD",
  "estados unidos de américa": "USD",
  ec: "USD",
  ecuador: "USD",
  pa: "USD",
  panama: "USD",
  panamá: "USD",
  sv: "USD",
  "el salvador": "USD",
  es: "EUR",
  españa: "EUR",
  spain: "EUR",
  fr: "EUR",
  francia: "EUR",
  france: "EUR",
  de: "EUR",
  alemania: "EUR",
  germany: "EUR",
  deutschland: "EUR",
  it: "EUR",
  italia: "EUR",
  italy: "EUR",
  pt: "EUR",
  portugal: "EUR",
  nl: "EUR",
  "países bajos": "EUR",
  netherlands: "EUR",
  nederland: "EUR",
  be: "EUR",
  bélgica: "EUR",
  belgium: "EUR",
  at: "EUR",
  austria: "EUR",
  ie: "EUR",
  irlanda: "EUR",
  ireland: "EUR",
  gr: "EUR",
  grecia: "EUR",
  greece: "EUR",
};

/** Currency for a geocoded country name / ISO code, or null when unknown. */
export function currencyForCountry(country: string | null | undefined): CurrencyCode | null {
  if (!country) return null;
  const key = country.trim().toLowerCase();
  if (!key) return null;
  return COUNTRY_TO_CURRENCY[key] ?? null;
}

/**
 * Onboarding default: best-guess currency from the browser timezone, falling
 * back to COP (Zeta's primary market).
 */
export function inferCurrencyFromTimezone(timezone: string | undefined | null): CurrencyCode {
  return currencyForTimeZone(timezone) ?? "COP";
}
