import { addDays, type IsoDate } from "./dates";
import type { CycleSettings } from "../types";

/**
 * How real the Disponible is (S10-4): the setup tasks Zeta still needs and
 * the precision they add. Pure — the phone passes what it knows, including
 * its own "No tengo" answers and the fixed payments left without an amount.
 */

export type SetupTaskId = "basics" | "statement" | "bills" | "cards";
export type SetupLevel = "borrador" | "aproximado" | "real";

export interface SetupTask {
  id: SetupTaskId;
  /** Points of precision this task adds when done. */
  weight: number;
  done: boolean;
  /** Short title: "Sube tus extractos". */
  title: string;
  /** One line under it: what it does or what's left. */
  detail: string;
  /** The user may close it by saying they don't have it. */
  canDecline: boolean;
  /** What closing it says: "No tengo", or "Ya no los pago" for names left pending. */
  declineLabel: string;
}

export interface SetupProgress {
  /** 0–100. */
  percent: number;
  level: SetupLevel;
  tasks: SetupTask[];
}

export interface SetupInput {
  settings: CycleSettings | null;
  accounts: { accountType: string }[];
  /** Fixed payments (archived included: only active ones count). */
  templates: { isActive: boolean; direction?: "INFLOW" | "OUTFLOW" }[];
  /** Recent movements: their capture method says if automatic capture works. */
  transactions: { date: IsoDate; captureMethod?: string | null }[];
  /** A statement was imported (a snapshot or a PDF movement exists). */
  hasStatement: boolean;
  /** Fixed payments named in onboarding without an amount or day yet. */
  pendingBills: string[];
  noCards: boolean;
  noBills: boolean;
  /** "No uso extractos": statements are the main path, never mandatory (S10-5). */
  noStatements?: boolean;
  today: IsoDate;
}

/**
 * Automatic capture is not a setup task (owner, 2026-10-03): it's the app's
 * best feature and the hardest to set up, so it has its own guide on Hoy
 * (captureActive) instead of a checklist line, and doesn't weigh on precision.
 */
export const SETUP_WEIGHTS: Record<SetupTaskId, number> = { basics: 20, statement: 40, bills: 20, cards: 20 };
/** Below it the number is a Borrador; from REAL_AT it is Real. */
export const APROXIMADO_AT = 40;
export const REAL_AT = 80;
/** Automatic capture counts while something arrived on its own in this window. */
export const CAPTURE_WINDOW_DAYS = 14;

const AUTOMATIC = new Set(["EMAIL_IMPORT", "NOTIFICATION"]);

export function setupLevel(percent: number): SetupLevel {
  return percent >= REAL_AT ? "real" : percent >= APROXIMADO_AT ? "aproximado" : "borrador";
}

export function setupLevelLabel(level: SetupLevel): string {
  return level === "real" ? "Real" : level === "aproximado" ? "Aproximado" : "Borrador";
}

/** The basics Inicio needs for any number (same gate as buildInicio). */
export function hasSetupBasics(settings: CycleSettings | null): boolean {
  const schedule = settings?.schedule;
  if (!settings || !schedule || !settings.balanceAnchor) return false;
  return schedule.kind === "irregular" || settings.incomePerCycle != null;
}

export function setupProgress(input: SetupInput): SetupProgress {
  const activeBills = input.templates.filter((t) => t.isActive && t.direction !== "INFLOW").length;
  const pending = input.pendingBills.filter((n) => n.trim());

  const billsDone = pending.length === 0 && (activeBills > 0 || input.noBills);
  const cardsDone = input.noCards || input.accounts.some((a) => a.accountType === "CREDIT_CARD");

  const tasks: SetupTask[] = [
    {
      id: "basics", weight: SETUP_WEIGHTS.basics, done: hasSetupBasics(input.settings), canDecline: false, declineLabel: "",
      title: "Cuándo te pagan y cuánto tienes", detail: "Lo mínimo para tu número",
    },
    {
      id: "statement", weight: SETUP_WEIGHTS.statement, done: input.hasStatement || !!input.noStatements, canDecline: true, declineLabel: "No uso extractos",
      title: "Sube tus extractos", detail: "Los últimos 3 meses son gratis: Zeta saca tus pagos y tarjetas",
    },
    {
      // A name tapped by mistake in onboarding must be droppable, or the card never leaves Hoy.
      id: "bills", weight: SETUP_WEIGHTS.bills, done: billsDone, canDecline: true,
      declineLabel: pending.length ? (pending.length === 1 ? "Ya no lo pago" : "Ya no los pago") : "No tengo",
      title: pending.length ? "Completa tus pagos fijos" : "Agrega tus pagos fijos",
      detail: pending.length ? `Falta el monto de ${listNames(pending)}` : "Arriendo, servicios, internet… aproximado sirve",
    },
    {
      id: "cards", weight: SETUP_WEIGHTS.cards, done: cardsDone, canDecline: true, declineLabel: "No tengo",
      title: "Agrega tus tarjetas", detail: "Su factura cuenta por el pago mínimo",
    },
  ];
  const percent = Math.min(100, tasks.reduce((s, t) => s + (t.done ? t.weight : 0), 0));
  return { percent, level: setupLevel(percent), tasks };
}

/** Something arrived on its own (bank email, notification) in the last two weeks. */
export function captureActive(transactions: { date: IsoDate; captureMethod?: string | null }[], today: IsoDate): boolean {
  const since = addDays(today, -CAPTURE_WINDOW_DAYS);
  return transactions.some((t) => t.date >= since && AUTOMATIC.has(t.captureMethod ?? ""));
}

function listNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names[0]}, ${names[1]} y ${names.length - 2} más`;
}
