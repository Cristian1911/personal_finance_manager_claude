import * as SecureStore from "expo-secure-store";
import { supabase } from "./supabase";
import { clearDatabase, getDatabase } from "./db/database";
import { getAllAccounts } from "./repositories/accounts";
import { beginReset, endReset } from "./sync/engine";
import { disableBiometrics, setBackgroundReauth } from "./biometrics";

const PDF_PASSWORD_KEY_PREFIX = "zeta_pdf_password";
const DEFAULT_ACCOUNT_STORAGE_KEY = "zeta.default_capture_account_id";

function pdfPasswordKey(userId: string, accountId: string) {
  const sanitized = `${userId}_${accountId}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${PDF_PASSWORD_KEY_PREFIX}_${sanitized}`;
}

// Permanently deletes the calling user's account and ALL associated data.
// Required by Apple App Store Guideline 5.1.1(v).
//
// Server: `delete_user_account` RPC wipes app tables via reset_user_data()
// then deletes the auth.users row (cascades the rest).
//
// Local cleanup mirrors resetUserData() but additionally:
//   - signs the session out
//   - disables biometrics (Face ID bound to a deleted user is a re-login loop)
export async function deleteUserAccount(userId: string): Promise<void> {
  beginReset();
  try {
    const accounts = await getAllAccounts().catch(() => []);
    const pdfKeys = accounts.map((a) => pdfPasswordKey(userId, a.id));

    const db = await getDatabase();
    await db
      .execAsync("DELETE FROM sync_queue")
      .catch((err) => {
        console.warn("[delete-account] sync_queue drain failed (non-fatal):", err);
      });

    const { error } = await supabase.rpc("delete_user_account");
    if (error) {
      throw new Error(error.message || "No se pudo eliminar la cuenta.");
    }

    await supabase.auth.signOut().catch((err) => {
      console.warn("[delete-account] signOut failed (non-fatal):", err);
    });

    await clearDatabase();

    await Promise.all([
      ...[...pdfKeys, DEFAULT_ACCOUNT_STORAGE_KEY].map((key) =>
        SecureStore.deleteItemAsync(key).catch(() => {}),
      ),
      setBackgroundReauth(false).catch(() => {}),
      disableBiometrics().catch(() => {}),
    ]);
  } finally {
    endReset();
  }
}
