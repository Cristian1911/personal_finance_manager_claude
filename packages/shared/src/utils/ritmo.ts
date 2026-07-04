/**
 * Canonical "ritmo" (runway) computation for the dashboard hero, shared
 * by webapp + mobile. Pure function over plain inputs:
 *
 *   ┌─ Today's permission = available balance for the period ÷ days remaining
 *   ├─ Period progress    = fraction of the period's available balance already spent
 *   └─ Daily buckets      = per-day spend classified relative to month-avg
 */

/** Calendar-bucket label for the V7 calendar heatmap. */
export type DailyBucket = "none" | "low" | "med" | "high";

/** Spanish UI labels for each bucket (legend + a11y). Both platforms read from this. */
export const BUCKET_LABEL: Record<DailyBucket, string> = {
  none: "Sin gasto",
  low: "Día tranquilo",
  med: "Día normal",
  high: "Día caro",
};

/** Single-letter Spanish weekday header for Monday-start calendars: L M X J V S D. */
export const WEEKDAYS_MONDAY_START = ["L", "M", "X", "J", "V", "S", "D"] as const;

/**
 * Weekday index for a Monday-start grid. `2026-05-04` (Mon) → 0,
 * `2026-05-10` (Sun) → 6. Pure ISO-string math, no locale branch.
 */
export function weekdayMondayStart(iso: string): number {
  const d = new Date(`${iso}T12:00:00`).getDay();
  return d === 0 ? 6 : d - 1;
}

/** Status tone for the runway hero. */
export type RitmoStatusTone = "income" | "alert" | "debt";

/**
 * Closed verdict vocabulary (unification layer T1). Shared by webapp
 * `<Verdict />` and mobile so the four states never drift per platform.
 */
export type VerdictState = "vas-bien" | "cerca" | "te-pasaste" | "atencion";

/**
 * Derives the status pill content. Both platforms read the same logic so
 * the verdict (red/amber/green) stays consistent across web + mobile.
 *
 * Why: overspent today OR negative period balance is always "te-pasaste"
 * (red). Past 75% of the period budget is "cerca" (amber). Otherwise
 * "vas-bien". `tone` + `label` stay for backward compatibility (mobile
 * consumes them); `state` feeds the webapp `<Verdict />` component.
 */
export function deriveRitmoStatus(ritmo: Pick<RitmoResult, "availableTotal" | "spentToday" | "availablePerDay" | "spentFraction">): {
  tone: RitmoStatusTone;
  label: string;
  state: VerdictState;
} {
  const overspentToday = ritmo.spentToday > ritmo.availablePerDay;
  if (ritmo.availableTotal < 0 || overspentToday) {
    return { tone: "debt", label: "Te pasaste", state: "te-pasaste" };
  }
  if (ritmo.spentFraction >= 0.75) {
    return { tone: "alert", label: "Cerca del límite", state: "cerca" };
  }
  return { tone: "income", label: "Vas bien", state: "vas-bien" };
}

export interface RitmoDailyOutflow {
  /** YYYY-MM-DD. */
  date: string;
  /** Sum of OUTFLOW amounts on this day (excluded + reconciled + transfer rows already removed). */
  expense: number;
}

export interface RitmoInput {
  /** Today's date in YYYY-MM-DD format. Caller resolves locale/timezone. */
  today: string;
  /** Last day of the current calendar month, YYYY-MM-DD. */
  endOfMonth: string;
  /** Sum of liquid (CHECKING / SAVINGS / CASH / OTHER) account balances. */
  liquidBalance: number;
  /**
   * Optional next-paycheck-or-income date inside the current month. When
   * present and on/after today, the predictive window ends here (the user
   * gets fresh income then, runway calculations reset). When absent, the
   * window ends at end-of-month.
   */
  nextIncomeDate?: string | null;
  /** Expected amount of the next income event (used by callers to label the period; not directly required for math). */
  nextIncomeAmount?: number | null;
  /**
   * Sum of OUTFLOW obligations (and debt-INFLOW payments) due between
   * today and windowEndDate. Reduces the period's available balance.
   */
  pendingObligations: number;
  /** Per-day OUTFLOW totals across the current calendar month, in order. */
  dailyOutflows: RitmoDailyOutflow[];
}

export interface RitmoResult {
  /** Where the predictive window ends. */
  windowEndDate: string;
  /** Days from today through windowEndDate, inclusive of today. Min 1. */
  daysRemaining: number;
  /** Days from start-of-month through today, inclusive. */
  daysElapsed: number;
  /** Days in the full current month. */
  daysInMonth: number;
  /** Total liquid balance minus pending obligations through the window. */
  availableTotal: number;
  /** availableTotal ÷ daysRemaining, rounded. */
  availablePerDay: number;
  /** spentToday subtracted from availablePerDay; clamped at 0. */
  allowedToday: number;
  /** Sum of OUTFLOWs so far this month. */
  spentMonth: number;
  /** OUTFLOWs on the `today` date. */
  spentToday: number;
  /**
   * Period budget = spentMonth + availableTotal. The denominator for the
   * V7 progress bar. Reflects the user's commitment for the month — what
   * they've already laid out plus what's left to spend before windowEnd.
   */
  periodBudget: number;
  /** spentMonth ÷ periodBudget. Clamped at 0; can exceed 1 when overspent. */
  spentFraction: number;
  /** Predictive verdict: are we on track to not overshoot the period? */
  onTrack: boolean;
  /**
   * Per-day calendar buckets for the V7 secondary view. One entry per
   * date in `dailyOutflows`. "Today's date" gets `isToday: true`.
   * Buckets are relative to the month's running daily average so the
   * heatmap stays useful for both light and heavy spenders.
   */
  calendar: Array<{
    date: string;
    expense: number;
    bucket: DailyBucket;
    isToday: boolean;
    isFuture: boolean;
  }>;
}

function clampPositive(n: number): number {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T12:00:00`).getTime();
  const to = new Date(`${toIso}T12:00:00`).getTime();
  return Math.max(1, Math.ceil((to - from) / 86_400_000) + 1);
}

function bucketFor(expense: number, avg: number): DailyBucket {
  if (expense <= 0) return "none";
  if (avg <= 0) return "med";
  if (expense < 0.5 * avg) return "low";
  if (expense > 1.5 * avg) return "high";
  return "med";
}

export function computeRitmo(input: RitmoInput): RitmoResult {
  const windowEndDate =
    input.nextIncomeDate && input.nextIncomeDate >= input.today
      ? input.nextIncomeDate
      : input.endOfMonth;

  const daysRemaining = daysBetween(input.today, windowEndDate);

  // Days elapsed = today − start of the calendar month + 1. Derive start
  // by replacing the day component with "01".
  const startOfMonth = `${input.today.slice(0, 7)}-01`;
  const daysElapsed = daysBetween(startOfMonth, input.today);
  const daysInMonth = daysBetween(startOfMonth, input.endOfMonth);

  // availableTotal is signed — the UI uses it to surface "you're overspent"
  // (negative Disponible). The daily allowance and progress bar consume
  // the clamped non-negative version so we never tell the user "you can
  // spend -$5,000 per day".
  const availableTotal = input.liquidBalance - input.pendingObligations;
  const availableTotalClamped = clampPositive(availableTotal);
  const availablePerDay = Math.round(availableTotalClamped / daysRemaining);

  let spentMonth = 0;
  let spentToday = 0;
  for (const row of input.dailyOutflows) {
    spentMonth += row.expense;
    if (row.date === input.today) spentToday += row.expense;
  }

  const allowedToday = clampPositive(availablePerDay - spentToday);

  // periodBudget uses the clamped headroom — when availableTotal is
  // negative, the budget IS what's been spent (no headroom left). The
  // progress bar pegs at 100% via Math.min below.
  const periodBudget = spentMonth + availableTotalClamped;
  const spentFraction =
    periodBudget > 0 ? Math.min(1, spentMonth / periodBudget) : availableTotal < 0 ? 1 : 0;

  // On-track = projected spend for the REMAINING window (using last-7-day
  // avg as best-guess pace) fits within `availableTotal` — which already
  // nets out pendingObligations. Comparing remaining-vs-remaining is more
  // precise than projecting the whole month against total cash, and it
  // correctly fails when a big bill is pending.
  const last7Days = input.dailyOutflows.slice(-7);
  const last7Total = last7Days.reduce((s, r) => s + r.expense, 0);
  const avgLast7 = last7Days.length > 0 ? last7Total / last7Days.length : 0;
  const onTrack = avgLast7 * daysRemaining <= availableTotal;

  // Calendar buckets — relative to month-to-date daily average.
  const dailyAvg = daysElapsed > 0 ? spentMonth / daysElapsed : 0;
  const calendar = input.dailyOutflows.map((row) => ({
    date: row.date,
    expense: row.expense,
    bucket: bucketFor(row.expense, dailyAvg),
    isToday: row.date === input.today,
    isFuture: row.date > input.today,
  }));

  return {
    windowEndDate,
    daysRemaining,
    daysElapsed,
    daysInMonth,
    availableTotal,
    availablePerDay,
    allowedToday,
    spentMonth,
    spentToday,
    periodBudget,
    spentFraction,
    onTrack,
    calendar,
  };
}
