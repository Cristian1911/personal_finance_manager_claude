import * as Notifications from "expo-notifications";

/** Read-only check; does not prompt. */
export async function getNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

/** Prompts for notification permission if not already granted. Returns whether granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}
