import {
  buildInicio,
  inicioSince,
  pickAutoOpen,
  readInicioData,
  type DisponibleVerdictMemo,
  type InicioLayout,
  type InicioState,
} from "@zeta/shared";
import { toColombiaDateString } from "../../utils/date";
import { getV2Database } from "../engine/database";

const MEMO_KEY = "inicio.verdict_memo";
/** The day a widget last opened by itself (13 §Attention: once per day). */
const AUTO_OPEN_KEY = "inicio.auto_open_day";
/** The user's widget order, sizes and hidden ones (Organizar). */
const LAYOUT_KEY = "inicio.layout";

export interface LoadedInicio {
  state: InicioState;
  /** The widget to open now (most critical, first load of the day), or null. */
  autoOpen: string | null;
  /** Organizar's saved layout, or null for the default. */
  layout: InicioLayout | null;
}

/**
 * The only raw writes on the phone, on purpose: local_state is UI memory,
 * never synced or replayed, so it doesn't go through a command.
 */
async function remember(userId: string, key: string, value: string): Promise<void> {
  const { driver } = await getV2Database();
  await driver.query(
    `INSERT INTO local_state (user_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value`,
    [userId, key, value],
  );
}

export const saveInicioLayout = (userId: string, layout: InicioLayout) =>
  remember(userId, LAYOUT_KEY, JSON.stringify(layout));

function parseLayout(raw: string | undefined): InicioLayout | null {
  if (!raw) return null;
  try {
    const l = JSON.parse(raw) as InicioLayout;
    return Array.isArray(l.items) && Array.isArray(l.hidden) ? l : null;
  } catch {
    return null; // a damaged layout falls back to the default
  }
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
      "SELECT key, value FROM local_state WHERE user_id = ? AND key IN (?, ?, ?)", [userId, MEMO_KEY, AUTO_OPEN_KEY, LAYOUT_KEY],
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
  const layout = parseLayout(local.get(LAYOUT_KEY));
  if (state.status !== "ready") return { state, autoOpen: null, layout };

  const memoJson = JSON.stringify(state.verdict.memo);
  if (memoJson !== local.get(MEMO_KEY)) await remember(userId, MEMO_KEY, memoJson);
  // Only a widget that's on Inicio can open by itself.
  const hidden = new Set(layout?.hidden ?? []);
  const autoOpen = pickAutoOpen(state.widgets.filter((w) => !hidden.has(w.id)), local.get(AUTO_OPEN_KEY) ?? null, today);
  if (autoOpen) await remember(userId, AUTO_OPEN_KEY, today);
  return { state, autoOpen, layout };
}
