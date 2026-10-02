import { supabase } from "../supabase";
import { getV2Database } from "./engine/database";

/** Every v2 table that holds a user's rows on the phone. */
const USER_TABLES = [
  "outbox", "commands", "field_versions", "local_state", "transactions", "accounts", "account_settings",
  "user_cycle_settings", "bill_reservations", "recurring_occurrences", "recurring_transaction_templates",
];

/** This phone forgets the user's v2 data (their account keeps it on the server). */
async function forgetLocally(userId: string): Promise<void> {
  const { driver } = await getV2Database();
  await driver.transaction(async (tx) => {
    for (const t of USER_TABLES) await tx.query(`DELETE FROM ${t} WHERE user_id = ?`, [userId]);
  });
}

/** Cerrar sesión. Data already sent stays in the account; the root layout sends you to login. */
export async function signOutV2(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Borrar mi cuenta (Apple 5.1.1(v)): the server deletes everything (the
 * delete_user_account RPC; v2 tables cascade from auth.users), then this
 * phone forgets it and signs out. Throws a Spanish message on failure.
 */
export async function deleteAccountV2(userId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_user_account");
  if (error) throw new Error("No se pudo borrar la cuenta. Revisa tu conexión e intenta de nuevo.");
  await forgetLocally(userId).catch((e) => console.warn("[v2 account] local wipe failed", e));
  await supabase.auth.signOut().catch(() => undefined);
}
