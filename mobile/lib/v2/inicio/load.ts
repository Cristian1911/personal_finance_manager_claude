import {
  buildInicio,
  inicioSince,
  pickAutoOpen,
  readInicioData,
  type DisponibleVerdictMemo,
  type InicioState,
} from "@zeta/shared";
import { toColombiaDateString } from "../../utils/date";
import { getV2Database } from "../engine/database";

const MEMO_KEY = "inicio.verdict_memo";
/** The day a widget last opened by itself (13 §Attention: once per day). */
const AUTO_OPEN_KEY = "inicio.auto_open_day";

export interface LoadedInicio {
  state: InicioState;
  /** The widget to open now (most critical, first load of the day), or null. */
  autoOpen: string | null;
}

/**
 * Inicio from the phone's own v2 database: read, compute, remember the
 * verdict (so the pill doesn't flicker). Local only, never the network.
 */
export async function loadInicio(userId: string, now: Date = new Date()): Promise<LoadedInicio> {
  const { driver } = await getV2Database();
  const today = toColombiaDateString(now);
  const data = await readInicioData(driver, userId, inicioSince(today));

  const local = new Map(
    (await driver.query<{ key: string; value: string }>(
      "SELECT key, value FROM local_state WHERE user_id = ? AND key IN (?, ?)", [userId, MEMO_KEY, AUTO_OPEN_KEY],
    )).map((r) => [r.key, r.value]),
  );
  const row = local.has(MEMO_KEY) ? { value: local.get(MEMO_KEY)! } : undefined;
  let memo: DisponibleVerdictMemo | null = null;
  try {
    memo = row ? (JSON.parse(row.value) as DisponibleVerdictMemo) : null;
  } catch {
    memo = null; // a damaged memo only costs one flicker
  }

  const state = buildInicio({ today, now: now.toISOString(), memo, ...data });
  if (state.status !== "ready") return { state, autoOpen: null };

  // The only raw writes on the phone, on purpose: local_state is UI memory,
  // never synced or replayed, so it doesn't go through a command.
  const remember = (key: string, value: string) => driver.query(
    `INSERT INTO local_state (user_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value`,
    [userId, key, value],
  );
  await remember(MEMO_KEY, JSON.stringify(state.verdict.memo));
  const autoOpen = pickAutoOpen(state.widgets, local.get(AUTO_OPEN_KEY) ?? null, today);
  if (autoOpen) await remember(AUTO_OPEN_KEY, today);
  return { state, autoOpen };
}
