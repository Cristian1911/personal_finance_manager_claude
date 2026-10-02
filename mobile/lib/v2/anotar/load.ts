import { inicioSince, readInicioData, type InicioAccount, type anotarPreview } from "@zeta/shared";
import { toColombiaDateString } from "../../utils/date";
import { getV2Database } from "../engine/database";

const LAST_ACCOUNT_KEY = "anotar.last_account";

export interface LoadedAnotar {
  /** What anotarPreview needs (Inicio's own inputs). */
  input: Parameters<typeof anotarPreview>[0];
  /** Active accounts, cards included (a purchase can go on a card). */
  accounts: InicioAccount[];
  /** The account last used in Anotar, if it still exists. */
  lastAccountId: string | null;
}

export async function loadAnotar(userId: string, now: Date = new Date()): Promise<LoadedAnotar> {
  const { driver } = await getV2Database();
  const today = toColombiaDateString(now);
  const data = await readInicioData(driver, userId, inicioSince(today));
  const [row] = await driver.query<{ value: string }>("SELECT value FROM local_state WHERE user_id = ? AND key = ?", [userId, LAST_ACCOUNT_KEY]);
  const last = row && data.accounts.some((a) => a.id === row.value) ? row.value : null;
  return { input: { today, now: now.toISOString(), ...data }, accounts: data.accounts, lastAccountId: last };
}

/** UI memory only (local_state is never synced). */
export async function rememberAnotarAccount(userId: string, accountId: string): Promise<void> {
  const { driver } = await getV2Database();
  await driver.query(
    `INSERT INTO local_state (user_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value`,
    [userId, LAST_ACCOUNT_KEY, accountId],
  );
}
