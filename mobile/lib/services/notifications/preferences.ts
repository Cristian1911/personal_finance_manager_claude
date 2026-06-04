import * as SecureStore from "expo-secure-store";

/**
 * Device-local opt-in flag for payment reminders. Stored in SecureStore (not the
 * `profiles` row) because notification preference + OS permission are inherently
 * per-device — there is nothing to sync to Supabase, so no migration is needed.
 */
const KEY = "zeta.payment_reminders_enabled";

export async function isPaymentRemindersEnabled(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setPaymentRemindersEnabled(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, enabled ? "1" : "0");
  } catch {
    /* best-effort; a failed write just leaves the prior value */
  }
}
