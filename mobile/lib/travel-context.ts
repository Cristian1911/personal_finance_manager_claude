import { useEffect, useState } from "react";
import * as Location from "expo-location";
import {
  COLOMBIA_TIMEZONE,
  currencyForCountry,
  currencyForTimeZone,
  describeTimeZone,
  formatUtcOffset,
  getDeviceTimeZone,
  getTimeZoneOffsetMinutes,
  type CurrencyCode,
} from "@zeta/shared";
import { reverseGeocode } from "./services/location";

/**
 * Where the phone is right now, for the capture flow.
 *
 * Zeta stores Colombian wall clock and the user's home currency, but the
 * receipt in hand while travelling shows local time in local currency. This
 * module answers "is the user abroad, where, and what do they pay in?" from
 * two signals the phone already has:
 *
 * 1. The device timezone (`Intl`). Phones follow the network/location zone,
 *    so this alone catches almost every trip and needs no permission.
 * 2. The last known GPS fix, only when location permission was already
 *    granted — never prompts. Reverse-geocoded to a country + city so the
 *    hint can say "Buenos Aires, Argentina" and pick ARS even in zones that
 *    span several currencies.
 */
export type TravelContext = {
  /** IANA zone the phone reports, null when unavailable. */
  timeZone: string | null;
  /** True when the phone's offset differs from Colombia's right now. */
  isAbroad: boolean;
  /** "Buenos Aires" / "Buenos Aires, Argentina" */
  placeLabel: string | null;
  /** "UTC-3" */
  offsetLabel: string | null;
  /** Geocoded country when a fix was available, else null. */
  country: string | null;
  /** Currency of the place; null when unknown or when at home. */
  localCurrency: CurrencyCode | null;
  source: "location" | "timezone" | "none";
};

const HOME: TravelContext = {
  timeZone: COLOMBIA_TIMEZONE,
  isAbroad: false,
  placeLabel: null,
  offsetLabel: null,
  country: null,
  localCurrency: null,
  source: "none",
};

// Reverse geocoding is rate-limited and a trip doesn't change by the minute:
// remember the answer for a while and share it across screens.
const CACHE_TTL_MS = 10 * 60 * 1000;
let cached: { at: number; value: TravelContext } | null = null;
let inFlight: Promise<TravelContext> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

async function lastKnownPlace(): Promise<{
  country: string | null;
  locality: string | null;
} | null> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return null;
    // Cached fix first (instant, no radio). Fall back to one low-accuracy
    // sample, bounded so a cold GPS never holds the form hostage.
    let fix = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 });
    if (!fix) {
      fix = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
        4000,
      );
    }
    if (!fix) return null;
    const place = await reverseGeocode(fix.coords.latitude, fix.coords.longitude);
    return { country: place.place_country, locality: place.place_locality };
  } catch {
    return null;
  }
}

async function detect(): Promise<TravelContext> {
  const timeZone = getDeviceTimeZone();
  if (!timeZone) return HOME;

  const now = new Date();
  const deviceOffset = getTimeZoneOffsetMinutes(timeZone, now);
  const isAbroad = deviceOffset !== getTimeZoneOffsetMinutes(COLOMBIA_TIMEZONE, now);
  const offsetLabel = formatUtcOffset(deviceOffset);
  const zoneLabel = describeTimeZone(timeZone);

  // Same offset as Colombia (Lima, Quito, New York in winter…) — the clock
  // needs no correction, but a different country may still mean a different
  // currency, so the geocode still runs when it's free.
  const place = await lastKnownPlace();
  if (place?.country) {
    const country = place.country;
    const localCurrency = currencyForCountry(country) ?? currencyForTimeZone(timeZone);
    const isColombia = localCurrency === "COP" && !isAbroad;
    return {
      timeZone,
      isAbroad,
      placeLabel: isColombia
        ? null
        : [place.locality ?? zoneLabel, country].filter(Boolean).join(", "),
      offsetLabel: isAbroad ? offsetLabel : null,
      country,
      localCurrency: isColombia ? null : localCurrency,
      source: "location",
    };
  }

  if (!isAbroad) return { ...HOME, timeZone };
  return {
    timeZone,
    isAbroad: true,
    placeLabel: zoneLabel,
    offsetLabel,
    country: null,
    localCurrency: currencyForTimeZone(timeZone),
    source: "timezone",
  };
}

/** Resolve (and memoise) the travel context. Never throws. */
export async function detectTravelContext(): Promise<TravelContext> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  if (!inFlight) {
    inFlight = detect()
      .catch(() => HOME)
      .then((value) => {
        cached = { at: Date.now(), value };
        inFlight = null;
        return value;
      });
  }
  return inFlight;
}

/** Drop the memo (e.g. after the user changes location permission). */
export function resetTravelContext(): void {
  cached = null;
}

/**
 * Travel context for a screen. `null` until resolved (usually a few ms from
 * cache; up to ~4s the first time when a GPS sample is needed).
 */
export function useTravelContext(): TravelContext | null {
  const [value, setValue] = useState<TravelContext | null>(() =>
    cached && Date.now() - cached.at < CACHE_TTL_MS ? cached.value : null,
  );
  useEffect(() => {
    let active = true;
    detectTravelContext().then((ctx) => {
      if (active) setValue(ctx);
    });
    return () => {
      active = false;
    };
  }, []);
  return value;
}
