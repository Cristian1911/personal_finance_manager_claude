import {
  buildInicio,
  inicioSince,
  readInicioData,
  type DisponibleVerdictMemo,
  type InicioState,
} from "@zeta/shared";
import { toColombiaDateString } from "../../utils/date";
import { getV2Database } from "../engine/database";

const MEMO_KEY = "inicio.verdict_memo";

/**
 * Inicio from the phone's own v2 database: read, compute, remember the
 * verdict (so the pill doesn't flicker). Local only, never the network.
 */
export async function loadInicio(userId: string, now: Date = new Date()): Promise<InicioState> {
  const { driver } = await getV2Database();
  const today = toColombiaDateString(now);
  const data = await readInicioData(driver, userId, inicioSince(today));

  const [row] = await driver.query<{ value: string }>(
    "SELECT value FROM local_state WHERE user_id = ? AND key = ?", [userId, MEMO_KEY]);
  let memo: DisponibleVerdictMemo | null = null;
  try {
    memo = row ? (JSON.parse(row.value) as DisponibleVerdictMemo) : null;
  } catch {
    memo = null; // a damaged memo only costs one flicker
  }

  const state = buildInicio({ today, now: now.toISOString(), memo, ...data });
  if (state.status === "ready") {
    // The one raw write on the phone, on purpose: local_state is UI memory,
    // never synced or replayed, so it doesn't go through a command.
    await driver.query(
      `INSERT INTO local_state (user_id, key, value) VALUES (?, ?, ?)
       ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value`,
      [userId, MEMO_KEY, JSON.stringify(state.verdict.memo)],
    );
  }
  return state;
}
