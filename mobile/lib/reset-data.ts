import * as SecureStore from "expo-secure-store";
import { supabase } from "./supabase";
import { clearDatabase } from "./db/database";
import { getAllAccounts } from "./repositories/accounts";

const PDF_PASSWORD_KEY_PREFIX = "zeta_pdf_password";
const DEFAULT_ACCOUNT_STORAGE_KEY = "zeta.default_capture_account_id";

function pdfPasswordKey(userId: string, accountId: string) {
  const sanitized = `${userId}_${accountId}`.replace(/[^a-zA-Z0-9.,_]/g, "_");
  return `${PDF_PASSWORD_KEY_PREFIX}_${sanitized}`;
}

// Wipes all of the user's data but keeps their account: calls the
// server-side `reset_user_data` RPC (scoped to `auth.uid()`), then clears
// local SQLite and device-bound preferences that only make sense alongside
// real data (saved PDF passwords, default capture account).
//
// Intentionally preserved locally: the Supabase session (user stays signed
// in), biometric credentials, theme, bug-report FAB preference.
export async function resetUserData(userId: string): Promise<void> {
  // Capture account IDs BEFORE the wipe so we know which PDF-password
  // SecureStore keys to clear.
  const accounts = await getAllAccounts().catch(() => []);
  const pdfKeys = accounts.map((a) => pdfPasswordKey(userId, a.id));

  const { error } = await supabase.rpc("reset_user_data");
  if (error) {
    throw new Error(error.message || "No se pudo borrar los datos remotos.");
  }

  await clearDatabase();

  await Promise.all(
    [...pdfKeys, DEFAULT_ACCOUNT_STORAGE_KEY].map((key) =>
      SecureStore.deleteItemAsync(key).catch(() => {}),
    ),
  );
}
