import type { ScenarioResult, ScenarioMonth } from "./scenario-types";
// Note: DebtAccount and getMinPayment are NOT imported here — they are used
// by consumers (deudas page, planner) that call getCurrentSalaryBreakdown
// with pre-computed debtPayments. This module only needs scenario types.

// ── Types ──────────────────────────────────────────────────────

export interface SalaryBreakdownInput {
  monthlyIncome: number;
  debtPayments: { accountId: string; name: string; amount: number }[];
}

export interface SalarySegment {
  accountId: string | "libre" | "redirected";
  name: string;
  amount: number;
  percentage: number;
  color: string;
  redirectedTo?: string; // only in cascade mode
}

export interface MonthlyBreakdown {
  month: string; // "YYYY-MM" calendar month
  income: number;
  segments: SalarySegment[];
  freePercentage: number;
  paidOffThisMonth?: string[]; // account names that reached zero
}

// ── Color palette ──────────────────────────────────────────────

const DEBT_PALETTE = [
  "#dc2626", // red
  "#ea580c", // orange
  "#d97706", // amber
  "#7c3aed", // purple
  "#6366f1", // indigo
  "#0891b2", // cyan
] as const;

const LIBRE_COLOR = "#22c55e"; // green — always used for "libre"

/**
 * Deterministic color assignment based on account ID.
 * Uses a simple FNV-1a-inspired hash to pick from the palette.
 * Same account always gets the same color regardless of order.
 */
export function getDebtColor(accountId: string): string {
  let hash = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < accountId.length; i++) {
    hash ^= accountId.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep as uint32
  }
  return DEBT_PALETTE[hash % DEBT_PALETTE.length];
}

// ── Single-bar breakdown (deudas page) ─────────────────────────

/**
 * Compute a single-month salary breakdown for the deudas page.
 * Each debt payment amount comes from getMinPayment() (minimum_payment
 * or 5%-of-balance fallback) — the same source the simulation engine uses.
 */
export function getCurrentSalaryBreakdown(
  input: SalaryBreakdownInput
): MonthlyBreakdown {
  const { monthlyIncome, debtPayments } = input;
  if (monthlyIncome <= 0) {
    return {
      month: "",
      income: 0,
      segments: [],
      freePercentage: 0,
    };
  }

  const segments: SalarySegment[] = [];
  let totalDebtPayments = 0;

  for (const dp of debtPayments) {
    const pct = (dp.amount / monthlyIncome) * 100;
    segments.push({
      accountId: dp.accountId,
      name: dp.name,
      amount: dp.amount,
      percentage: Math.min(pct, 100),
      color: getDebtColor(dp.accountId),
    });
    totalDebtPayments += dp.amount;
  }

  const freeAmount = Math.max(monthlyIncome - totalDebtPayments, 0);
  const freePercentage = (freeAmount / monthlyIncome) * 100;

  segments.push({
    accountId: "libre",
    name: "Libre",
    amount: freeAmount,
    percentage: freePercentage,
    color: LIBRE_COLOR,
  });

  return {
    month: "",
    income: monthlyIncome,
    segments,
    freePercentage,
  };
}

// ── Timeline breakdown (scenario planner) ──────────────────────

/**
 * Build monthly salary breakdowns from a completed ScenarioResult.
 *
 * In "simple" mode: when a debt is paid off its segment disappears and
 * the freed amount goes straight to "libre."
 *
 * In "cascade" mode: freed payments are shown as a striped "redirected"
 * segment colored toward the debt they're redirected to (matching the
 * scenario engine's cascade logic).
 */
export function getTimelineSalaryBreakdown(
  income: number,
  scenarioResult: ScenarioResult,
  mode: "simple" | "cascade"
): MonthlyBreakdown[] {
  if (income <= 0 || scenarioResult.timeline.length === 0) return [];

  return scenarioResult.timeline.map((month: ScenarioMonth) => {
    const segments: SalarySegment[] = [];
    let totalPayments = 0;

    // Each active account's total payment this month
    for (const acctMonth of month.accounts) {
      const totalPayment =
        acctMonth.minimumPaymentApplied +
        acctMonth.extraPaymentApplied +
        (mode === "simple" ? acctMonth.cascadePaymentApplied : 0);

      if (totalPayment > 0) {
        segments.push({
          accountId: acctMonth.accountId,
          name: acctMonth.accountId, // resolved by UI from accounts lookup
          amount: totalPayment,
          percentage: (totalPayment / income) * 100,
          color: getDebtColor(acctMonth.accountId),
        });
        totalPayments += totalPayment;
      }

      // In cascade mode, show cascade payments as a separate "redirected" segment
      if (mode === "cascade" && acctMonth.cascadePaymentApplied > 0) {
        segments.push({
          accountId: "redirected",
          name: acctMonth.accountId, // the account receiving the redirect
          amount: acctMonth.cascadePaymentApplied,
          percentage: (acctMonth.cascadePaymentApplied / income) * 100,
          color: getDebtColor(acctMonth.accountId),
          redirectedTo: acctMonth.accountId,
        });
        totalPayments += acctMonth.cascadePaymentApplied;
      }
    }

    // "Libre" segment = income minus all debt payments
    const freeAmount = Math.max(income - totalPayments, 0);
    const freePercentage = (freeAmount / income) * 100;

    segments.push({
      accountId: "libre",
      name: "Libre",
      amount: freeAmount,
      percentage: freePercentage,
      color: LIBRE_COLOR,
    });

    // Detect payoffs this month
    const paidOffThisMonth = month.events
      .filter((e) => e.type === "account_paid_off")
      .map((e) => e.description);

    return {
      month: month.calendarMonth,
      income,
      segments,
      freePercentage,
      paidOffThisMonth: paidOffThisMonth.length > 0 ? paidOffThisMonth : undefined,
    };
  });
}
