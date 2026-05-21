import * as Location from "expo-location";

export type PermissionLevel = "denied" | "foreground" | "background";

/**
 * Request location permission in two steps: foreground first, then background.
 * Returns the highest level the OS granted us. Caller decides what to do at
 * each tier.
 *
 * - `denied`     — even foreground was refused.
 * - `foreground` — foreground granted but background refused. Pings will only
 *                  fire while the app is active.
 * - `background` — full opt-in; expo-location can run as a background task.
 */
export async function requestLocationPermissions(): Promise<PermissionLevel> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return "denied";

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") return "foreground";

  return "background";
}

/** Read-only check; does not prompt. */
export async function getCurrentPermissionLevel(): Promise<PermissionLevel> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== "granted") return "denied";

  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== "granted") return "foreground";

  return "background";
}
