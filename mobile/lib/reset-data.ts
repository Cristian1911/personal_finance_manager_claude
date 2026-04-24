import * as SecureStore from "expo-secure-store";
import { supabase } from "./supabase";
import { clearDatabase, getDatabase } from "./db/database";
import { getAllAccounts } from "./repositories/accounts";
import { beginReset, endReset } from "./sync/engine";

const PDF_PASSWORD_KEY_PREFIX = "zeta_pdf_password";
const DEFAULT_ACCOUNT_STORAGE_KEY = "zeta.default_capture_account_id";

function pdfPasswordKey(userId: string, accountId: string) {
  const sanitized = `${userId}_${accountId}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${PDF_PASSWORD_KEY_PREFIX}_${sanitized}`;
}

// Wipes all of the user's data but keeps their account: calls the
// server-side `reset_user_data` RPC (scoped to `auth.uid()`), then clears
// local SQLite and device-bound preferences that only make sense alongside
// real data (saved PDF passwords, default capture account).
//
// Intentionally preserved locally: the Supabase session (user stays signed
// in), biometric credentials, theme, bug-report FAB preference.
//
// Ordering matters. Any concurrent `syncAll()` would either (a) push
// `sync_queue` rows to the just-wiped server, partially resurrecting data,
// or (b) pull a stale pre-wipe snapshot back into SQLite. We therefore:
//   1. Set a global reset flag that `syncAll` checks and bails on.
//   2. Drain `sync_queue` locally BEFORE the RPC — even if the RPC fails
//      we leave no stale mutations behind.
//   3. Call the RPC.
//   4. Wipe local SQLite.
//   5. Clear device-bound SecureStore entries.
//   6. Release the reset flag.
export async function resetUserData(userId: string): Promise<void> {
  beginReset();
  try {
    const accounts = await getAllAccounts().catch(() => []);
    const pdfKeys = accounts.map((a) => pdfPasswordKey(userId, a.id));

    const db = await getDatabase();
    await db
      .execAsync("DELETE FROM sync_queue")
      .catch((err) => {
        console.warn("[reset] sync_queue drain failed (non-fatal):", err);
      });

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
  } finally {
    endReset();
  }
}
