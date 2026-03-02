import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BIOMETRICS_ENABLED_KEY = "venti5_biometrics_enabled";
const BIOMETRICS_REAUTH_KEY = "venti5_biometrics_reauth_background";
const BIOMETRICS_PROMPTED_KEY = "venti5_biometrics_prompted";

export async function isBiometricsAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
}

export async function isBiometricsEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY);
  return value === "1";
}

export async function enableBiometrics(): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, "1");
}

export async function disableBiometrics(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRICS_ENABLED_KEY);
}

export async function isBackgroundReauthEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRICS_REAUTH_KEY);
  return value === "1";
}

export async function setBackgroundReauth(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRICS_REAUTH_KEY, "1");
  } else {
    await SecureStore.deleteItemAsync(BIOMETRICS_REAUTH_KEY);
  }
}

export async function hasBeenPromptedForBiometrics(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRICS_PROMPTED_KEY);
  return value === "1";
}

export async function markBiometricsPrompted(): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRICS_PROMPTED_KEY, "1");
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Desbloquear Venti5",
    cancelLabel: "Cancelar",
    disableDeviceFallback: false,
    fallbackLabel: "Usar contraseña del dispositivo",
  });
  return result.success;
}
