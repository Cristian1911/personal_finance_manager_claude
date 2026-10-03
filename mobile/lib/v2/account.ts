import { supabase } from "../supabase";
import { getV2Database } from "./engine/database";
import { syncV2 } from "./sync/sync";

/** Every v2 table that holds a user's rows on the phone. */
const USER_TABLES = [
  "outbox", "commands", "field_versions", "local_state", "transactions", "accounts", "account_settings",
  "user_cycle_settings", "bill_reservations", "recurring_occurrences", "recurring_transaction_templates",
  "statement_snapshots", "destinatarios", "destinatario_rules",
];

/**
 * The financial rows "Empezar de nuevo" removes from the phone (mirrors the
 * restart_financial_data RPC): merchants, rules and the command ids stay.
 * The whole outbox goes: a change still queued would bring the data back.
 */
const FINANCIAL_TABLES = [
  "outbox", "transactions", "statement_snapshots", "accounts", "account_settings", "user_cycle_settings",
  "bill_reservations", "recurring_occurrences", "recurring_transaction_templates", "local_state",
];

/** This phone forgets the user's v2 data (their account keeps it on the server). */
async function forgetLocally(userId: string): Promise<void> {
  const { driver } = await getV2Database();
  await driver.transaction(async (tx) => {
    for (const t of USER_TABLES) await tx.query(`DELETE FROM ${t} WHERE user_id = ?`, [userId]);
  });
}

/**
 * Cerrar sesión. Sends what's left first; when everything reached the
 * account, this phone forgets it (a shared phone shouldn't keep someone's
 * finances). Anything still unsent stays here for when the same person
 * signs in again. The root layout sends you to login.
 */
export async function signOutV2(userId: string): Promise<void> {
  await syncV2(userId).catch(() => undefined);
  const { driver } = await getV2Database();
  const [{ n }] = await driver.query<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE user_id = ? AND state = 'pending'", [userId]);
  if (n === 0) await forgetLocally(userId).catch((e) => console.warn("[v2 account] local wipe failed", e));
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

/**
 * Empezar de nuevo (S10-4, owner decision 2026-10-03): the account keeps its
 * user, profile, categories, learned merchants and email forwarding address;
 * movements, accounts, cards, statements, fixed payments, debts and cycle
 * settings are deleted on the server (restart_financial_data RPC) and on this
 * phone, and the onboarding starts again. Needs a connection. Sends what's
 * queued first so nothing half-sent comes back later. Throws a Spanish message.
 */
export async function restartV2(userId: string): Promise<void> {
  await syncV2(userId).catch(() => undefined);
  const { error } = await supabase.rpc("restart_financial_data");
  if (error) throw new Error("No se pudo empezar de nuevo. Revisa tu conexión e intenta de nuevo.");
  const { driver } = await getV2Database();
  await driver.transaction(async (tx) => {
    for (const t of FINANCIAL_TABLES) await tx.query(`DELETE FROM ${t} WHERE user_id = ?`, [userId]);
    // The kept merchants keep their per-field versions (category choices).
    await tx.query("DELETE FROM field_versions WHERE user_id = ? AND entity <> 'destinatario'", [userId]);
  });
}
