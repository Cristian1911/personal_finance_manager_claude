import type { CurrencyCode } from "../types/domain";
import { formatCurrency } from "./currency";

/**
 * RECONSTRUCTED 2026-06-04 after the original untracked file was lost during a
 * file-move accident. Logic is verified against weekly-digest.test.ts (all
 * cases pass); the exact Spanish copy (title / pushBody / lines) is a
 * best-effort reconstruction — review the wording against intent.
 *
 * Pure rule engine for the weekly spending digest. Channel-agnostic: the same
 * output feeds the in-app surface and the future email/push cron. No I/O — the
 * caller (`webapp/src/actions/weekly-digest.ts`) assembles the inputs from
 * cached chart/recurrence actions.
 */

export interface WeeklyDigestUpcomingPayment {
  label: string;
  amount: number;
  /** YYYY-MM-DD */
  dueDate: string;
}

export interface WeeklyDigestInput {
  currency: CurrencyCode;
  /** OUTFLOW total for the last 7 days (incl. today). */
  thisWeekSpent: number;
  /** OUTFLOW total for the 7 days before that. 0 ⇒ no prior week to compare. */
  lastWeekSpent: number;
  topCategory: { name: string; amount: number } | null;
  monthlyBudget: number;
  monthSpentSoFar: number;
  dayOfMonth: number;
  daysInMonth: number;
  upcomingPayments: WeeklyDigestUpcomingPayment[];
  upcomingTotal: number;
}

export type WeeklyDigestVerdict = "on_track" | "watch" | "over";

export interface WeeklyDigest {
  verdict: WeeklyDigestVerdict;
  emoji: string;
  title: string;
  pushBody: string;
  lines: string[];
  /** Week-over-week % change, rounded. null when there is no prior week. */
  spentDeltaPct: number | null;
}

const VERDICT_EMOJI: Record<WeeklyDigestVerdict, string> = {
  on_track: "🟢",
  watch: "🟡",
  over: "🔴",
};

const VERDICT_TITLE: Record<WeeklyDigestVerdict, string> = {
  on_track: "Vas bien esta semana",
  watch: "Ojo con tu gasto",
  over: "Te pasaste del presupuesto",
};

/** Week-over-week jump (%) that flags a "watch" even when under budget. */
const WOW_JUMP_PCT = 30;
/** Tolerance over the linear daily pace before flagging "watch". */
const PACE_TOLERANCE = 1.1;

export function buildWeeklyDigest(input: WeeklyDigestInput): WeeklyDigest {
  const {
    currency,
    thisWeekSpent,
    lastWeekSpent,
    topCategory,
    monthlyBudget,
    monthSpentSoFar,
    dayOfMonth,
    daysInMonth,
    upcomingPayments,
    upcomingTotal,
  } = input;

  const money = (n: number) => formatCurrency(n, currency);

  const spentDeltaPct =
    lastWeekSpent > 0
      ? Math.round(((thisWeekSpent - lastWeekSpent) / lastWeekSpent) * 100)
      : null;

  const hasBudget = monthlyBudget > 0;
  const pace =
    hasBudget && daysInMonth > 0
      ? monthlyBudget * (dayOfMonth / daysInMonth)
      : 0;
  const aheadOfPace = hasBudget && monthSpentSoFar > pace * PACE_TOLERANCE;
  const wowJump = spentDeltaPct !== null && spentDeltaPct >= WOW_JUMP_PCT;

  let verdict: WeeklyDigestVerdict;
  if (hasBudget && monthSpentSoFar > monthlyBudget) {
    verdict = "over";
  } else if (wowJump || aheadOfPace) {
    verdict = "watch";
  } else {
    verdict = "on_track";
  }

  // Push body — always states the week's spend; appends the WoW comparison
  // only when there is a prior week to compare against ("semana pasada").
  let pushBody = `Gastaste ${money(thisWeekSpent)} esta semana`;
  if (spentDeltaPct !== null) {
    const dir = spentDeltaPct >= 0 ? "más" : "menos";
    pushBody += `, ${Math.abs(spentDeltaPct)}% ${dir} que la semana pasada`;
  }
  pushBody += ".";

  const lines: string[] = [];
  if (hasBudget) {
    lines.push(`Llevas ${money(monthSpentSoFar)} de ${money(monthlyBudget)} este mes.`);
  }
  if (topCategory) {
    lines.push(`Mayor gasto: ${topCategory.name} (${money(topCategory.amount)}).`);
  }
  if (upcomingPayments.length > 0) {
    lines.push(`Pagos próximos: ${money(upcomingTotal)}.`);
  }

  return {
    verdict,
    emoji: VERDICT_EMOJI[verdict],
    title: VERDICT_TITLE[verdict],
    pushBody,
    lines,
    spentDeltaPct,
  };
}
