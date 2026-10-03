import {
  buildInicio,
  inicioSince,
  pickAutoOpen,
  readInicioData,
  setupProgress,
  type DisponibleVerdictMemo,
  type InicioLayout,
  type InicioState,
  type SetupProgress,
  type SqlDriver,
} from "@zeta/shared";
import { toColombiaDateString } from "../../utils/date";
import { getV2Database } from "../engine/database";
import { ONBOARDING_KEYS, parseLocal, readLocal, remember } from "../local-state";

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
  /** How real the number is and what's left (S10-4). */
  setup: SetupProgress;
  /** The first-time note on Hoy was already shown. */
  guideSeen: boolean;
  /** The onboarding tour was already shown (needs_setup starts after it). */
  tourSeen: boolean;
  /** Fixed payments named in onboarding without amount or day yet. */
  pendingBills: string[];
}

export const saveInicioLayout = (userId: string, layout: InicioLayout) =>
  remember(userId, LAYOUT_KEY, JSON.stringify(layout));

export const markHoyGuideSeen = (userId: string) => remember(userId, ONBOARDING_KEYS.hoyGuideSeen, "1");

/** "No tengo" on a setup task (cards or fixed payments). */
export const declineSetupTask = (userId: string, task: "cards" | "bills") =>
  remember(userId, task === "cards" ? ONBOARDING_KEYS.noCards : ONBOARDING_KEYS.noBills, "1");

function parseLayout(raw: string | undefined): InicioLayout | null {
  const l = parseLocal<InicioLayout | null>(raw, null);
  return l && Array.isArray(l.items) && Array.isArray(l.hidden) ? l : null;
}

/** A statement is on the phone: a snapshot, or a movement a PDF brought. */
export async function hasImportedStatement(driver: SqlDriver, userId: string): Promise<boolean> {
  // EXISTS stops at the first row (this runs on every Inicio load).
  const rows = await driver.query<{ n: number }>(
    `SELECT EXISTS (SELECT 1 FROM statement_snapshots WHERE user_id = ?)
         OR EXISTS (SELECT 1 FROM transactions WHERE user_id = ? AND capture_method IN ('PDF_IMPORT', 'EMAIL_PDF_IMPORT')) AS n`,
    [userId, userId],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

/**
 * Inicio from the phone's own v2 database: read, compute, remember the
 * verdict (so the pill doesn't flicker). Local only, never the network.
 */
export async function loadInicio(userId: string, now: Date = new Date()): Promise<LoadedInicio> {
  const { driver } = await getV2Database();
  const today = toColombiaDateString(now);
  const data = await readInicioData(driver, userId, inicioSince(today));

  const local = await readLocal(userId, [
    MEMO_KEY, AUTO_OPEN_KEY, LAYOUT_KEY,
    ONBOARDING_KEYS.pendingBills, ONBOARDING_KEYS.noCards, ONBOARDING_KEYS.noBills, ONBOARDING_KEYS.hoyGuideSeen, ONBOARDING_KEYS.tourSeen,
  ]);
  // A damaged memo only costs one flicker.
  const memo = parseLocal<DisponibleVerdictMemo | null>(local.get(MEMO_KEY), null);

  const pendingBills = parseLocal<string[]>(local.get(ONBOARDING_KEYS.pendingBills), []);
  const setup = setupProgress({
    settings: data.settings,
    accounts: data.accounts,
    templates: data.templates,
    transactions: data.transactions,
    hasStatement: await hasImportedStatement(driver, userId),
    pendingBills,
    noCards: local.has(ONBOARDING_KEYS.noCards),
    noBills: local.has(ONBOARDING_KEYS.noBills),
    today,
  });
  const guideSeen = local.has(ONBOARDING_KEYS.hoyGuideSeen);
  const tourSeen = local.has(ONBOARDING_KEYS.tourSeen);

  const state = buildInicio({ today, now: now.toISOString(), memo, ...data });
  const layout = parseLayout(local.get(LAYOUT_KEY));
  if (state.status !== "ready") return { state, autoOpen: null, layout, setup, guideSeen, tourSeen, pendingBills };

  const memoJson = JSON.stringify(state.verdict.memo);
  if (memoJson !== local.get(MEMO_KEY)) await remember(userId, MEMO_KEY, memoJson);
  // Only a widget that's on Inicio can open by itself.
  const hidden = new Set(layout?.hidden ?? []);
  const autoOpen = pickAutoOpen(state.widgets.filter((w) => !hidden.has(w.id)), local.get(AUTO_OPEN_KEY) ?? null, today);
  if (autoOpen) await remember(userId, AUTO_OPEN_KEY, today);
  return { state, autoOpen, layout, setup, guideSeen, tourSeen, pendingBills };
}


