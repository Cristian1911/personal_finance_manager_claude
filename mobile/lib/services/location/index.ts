/**
 * Master kill-switch for the location feature. OFF while the app stabilizes:
 * background location triggers App Store 2.5.4 + Play background-location
 * review, and the only valuable use case (linking pings to email-imported tx)
 * needs background. All service code below stays intact — flip this back to
 * true (and restore the iOS UIBackgroundModes + Android background perms in
 * app.json) to re-enable as a focused effort with a reviewer demo video.
 * ponytail: feature deferred, not deleted — flag + manifest is the upgrade path.
 */
export const LOCATION_FEATURE_ENABLED = false;

/** Public surface of the location pipeline. */
export {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  isTracking,
  captureCurrentLocation,
} from "./tracker";
export {
  requestLocationPermissions,
  getCurrentPermissionLevel,
  type PermissionLevel,
} from "./permissions";
export { findNearestPing, linkNearestPingToTransaction } from "./linker";
export { reverseGeocode } from "./geocode";
export type { LocationPing, TransactionLocationRow } from "./types";
