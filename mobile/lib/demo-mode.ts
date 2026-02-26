import * as SecureStore from "expo-secure-store";

const DEMO_MODE_KEY = "venti5_demo_mode_enabled";

export async function isDemoModeEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(DEMO_MODE_KEY);
  return value === "1";
}

export async function enableDemoMode(): Promise<void> {
  await SecureStore.setItemAsync(DEMO_MODE_KEY, "1");
}

export async function disableDemoMode(): Promise<void> {
  await SecureStore.deleteItemAsync(DEMO_MODE_KEY);
}
