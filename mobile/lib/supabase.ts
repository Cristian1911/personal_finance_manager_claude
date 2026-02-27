import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import type { Database } from "@venti5/shared";

// Supabase sessions can exceed SecureStore's 2048-byte limit.
// This adapter chunks large values across multiple keys.
const CHUNK_SIZE = 2000;
const FALLBACK_SUPABASE_URL = "https://invalid.localhost";
const FALLBACK_SUPABASE_ANON_KEY = "invalid-anon-key";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
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

export const supabase = createClient<Database>(
  supabaseUrl ?? FALLBACK_SUPABASE_URL,
  supabaseAnonKey ?? FALLBACK_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
