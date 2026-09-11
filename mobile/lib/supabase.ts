import "react-native-url-polyfill/auto";
import { createClient, type Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import type { Database } from "@zeta/shared";

// Supabase sessions can exceed SecureStore's 2048-byte limit.
// This adapter chunks large values across multiple keys.
const CHUNK_SIZE = 2000;
const FALLBACK_SUPABASE_URL = "https://invalid.localhost";
const FALLBACK_SUPABASE_KEY = "invalid-publishable-key";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.warn(
    "[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or Supabase publishable key. " +
      "App will run in limited mode until environment variables are configured."
  );
}

async function clearChunkedKey(key: string): Promise<void> {
  const chunkCountStr = await SecureStore.getItemAsync(`${key}__chunks`);
  if (chunkCountStr !== null) {
    const chunkCount = parseInt(chunkCountStr, 10);
    if (Number.isFinite(chunkCount) && chunkCount > 0) {
      await Promise.all(
        Array.from({ length: chunkCount }, (_, i) =>
          SecureStore.deleteItemAsync(`${key}__chunk_${i}`)
        )
      );
    }
    await SecureStore.deleteItemAsync(`${key}__chunks`).catch(() => {});
  }
}

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const chunkCountStr = await SecureStore.getItemAsync(`${key}__chunks`);
    if (chunkCountStr === null) {
      return SecureStore.getItemAsync(key);
    }
    const chunkCount = parseInt(chunkCountStr, 10);
    if (!Number.isFinite(chunkCount) || chunkCount <= 0) {
      await clearChunkedKey(key);
      return SecureStore.getItemAsync(key);
    }
    const chunks: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}__chunk_${i}`);
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join("");
  },

  setItem: async (key: string, value: string): Promise<void> => {
    // Always clean previous chunk metadata to avoid reading stale sessions.
    await clearChunkedKey(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}__chunk_${i}`, chunk))
    );
    await SecureStore.setItemAsync(`${key}__chunks`, String(chunks.length));
  },

  removeItem: async (key: string): Promise<void> => {
    await clearChunkedKey(key);
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

/**
 * Where supabase-js persists the session (its default key shape:
 * `sb-<project-ref>-auth-token`). Exposed so the auth provider can read the
 * last good session straight from disk when the SDK can't hand one back —
 * offline with an expired access token, `getSession()` tries to refresh,
 * fails on the network and returns null, which used to bounce the user to
 * the login screen with all their local data one tap away.
 */
const projectRef = (() => {
  try {
    return new URL(supabaseUrl ?? FALLBACK_SUPABASE_URL).hostname.split(".")[0] ?? "invalid";
  } catch {
    return "invalid";
  }
})();
export const SUPABASE_AUTH_STORAGE_KEY = `sb-${projectRef}-auth-token`;

/**
 * The persisted session as stored by supabase-js, or null. The access token
 * may be expired — callers treat this as "who is logged in on this device",
 * not as a credential; the SDK refreshes it once the network is back.
 */
export async function readPersistedSession(): Promise<Session | null> {
  try {
    const raw = await ExpoSecureStoreAdapter.getItem(SUPABASE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session> | null;
    if (
      !parsed ||
      typeof parsed.access_token !== "string" ||
      typeof parsed.refresh_token !== "string" ||
      !parsed.user?.id
    ) {
      return null;
    }
    return parsed as Session;
  } catch {
    return null;
  }
}

export const supabase = createClient<Database>(
  supabaseUrl ?? FALLBACK_SUPABASE_URL,
  supabaseKey ?? FALLBACK_SUPABASE_KEY,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
