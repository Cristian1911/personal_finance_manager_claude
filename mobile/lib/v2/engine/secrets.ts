import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// This device only, readable after the first unlock (background sync later).
const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
const DB_KEY = "zeta.v2.dbKey";
const DEVICE_ID = "zeta.v2.deviceId";

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getDbKey(): Promise<string | null> {
  return SecureStore.getItemAsync(DB_KEY, OPTS);
}

export async function createDbKey(): Promise<string> {
  const key = toHex(await Crypto.getRandomBytesAsync(32));
  await SecureStore.setItemAsync(DB_KEY, key, OPTS);
  return key;
}

export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID, OPTS);
  if (existing) return existing;
  const id = Crypto.randomUUID().toLowerCase();
  await SecureStore.setItemAsync(DEVICE_ID, id, OPTS);
  return id;
}
