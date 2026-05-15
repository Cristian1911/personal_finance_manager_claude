import * as Location from "expo-location";

export type ReverseGeocodeResult = {
  place_name: string | null;
  place_locality: string | null;
  place_country: string | null;
};

/**
 * Tiny in-memory cache keyed by ~110m grid cells (3 decimal places of
 * lat/lng). Reverse geocoding is rate-limited by both Apple and Android, and
 * users tend to revisit the same handful of places.
 */
const cache = new Map<string, ReverseGeocodeResult>();

function gridKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  const key = gridKey(lat, lng);
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const first = results[0];
    if (!first) {
      const empty: ReverseGeocodeResult = {
        place_name: null,
        place_locality: null,
        place_country: null,
      };
      cache.set(key, empty);
      return empty;
    }
    const placeName = [first.name, first.street].filter(Boolean).join(", ") || null;
    const result: ReverseGeocodeResult = {
      place_name: placeName,
      place_locality: first.city ?? first.subregion ?? null,
      place_country: first.country ?? null,
    };
    cache.set(key, result);
    return result;
  } catch {
    const fallback: ReverseGeocodeResult = {
      place_name: null,
      place_locality: null,
      place_country: null,
    };
    cache.set(key, fallback);
    return fallback;
  }
}
