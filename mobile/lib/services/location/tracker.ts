import * as Location from "expo-location";
import { ZETA_LOCATION_TASK } from "./types";

// Side-effect import: registers the TaskManager task at module load.
// MUST happen before startLocationUpdatesAsync(taskName) is called.
import { persistLocationPings } from "./task";

/**
 * Significant-change strategy: only emits a new ping when the device has
 * moved ~100m. On iOS, expo-location uses Core Location's significant-change
 * monitoring under the hood; on Android, the FusedLocationProvider clamps to
 * Balanced accuracy with the deferred distance below.
 *
 * Battery cost is small because the OS uses cell-tower / wifi triangulation
 * rather than GPS for these events.
 */
const TRACKING_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  activityType: Location.ActivityType.Other,
  distanceInterval: 100, // meters between pings
  deferredUpdatesDistance: 100,
  pausesUpdatesAutomatically: true,
  showsBackgroundLocationIndicator: false,
  foregroundService: {
    notificationTitle: "Zeta",
    notificationBody: "Guardando ubicación con tus movimientos",
    notificationColor: "#9F7B3A",
  },
};

export async function startBackgroundLocationTracking(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(ZETA_LOCATION_TASK);
  if (isRunning) return;
  await Location.startLocationUpdatesAsync(ZETA_LOCATION_TASK, TRACKING_OPTIONS);
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(ZETA_LOCATION_TASK);
  if (!isRunning) return;
  await Location.stopLocationUpdatesAsync(ZETA_LOCATION_TASK);
}

export async function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(ZETA_LOCATION_TASK);
}

/**
 * Force one immediate sample (used right before saving a transaction so we
 * have at least one ping in the window even if the user hasn't moved).
 * Does nothing if foreground permission isn't granted.
 */
export async function captureCurrentLocation(): Promise<void> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await persistLocationPings([loc]);
  } catch (err) {
    if (__DEV__) console.warn("[zeta-location] captureCurrentLocation failed", err);
  }
}
