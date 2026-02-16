/**
 * Debt calculation utilities for the debt dashboard.
 * Focuses on credit cards and loans.
 */

import type { Account } from "@/types/domain";

export interface DebtAccount {
  id: string;
  name: string;
  type: "CREDIT_CARD" | "LOAN";
  balance: number;
  creditLimit: number | null;
  interestRate: number | null;
  monthlyPayment: number | null;
  paymentDay: number | null;
  cutoffDay: number | null;
  currency: string;
  color: string | null;
  institutionName: string | null;
}

export interface DebtOverview {
  totalDebt: number;
  totalCreditLimit: number;
  overallUtilization: number;
  monthlyInterestEstimate: number;
  accounts: DebtAccount[];
  insights: DebtInsight[];
}

export interface DebtInsight {
  type: "warning" | "info" | "success";
  title: string;
  description: string;
}

/**
 * Compute the debt balance for a debt account.
 *
 * For credit cards: prefers (credit_limit − available_balance) when both are
 * known, because `current_balance` might have been entered as available credit
 * or as a negative number. Falls back to |current_balance|.
 *
 * For loans: uses |current_balance| (debt is always a positive amount).
 */
export function computeDebtBalance(a: Account): number {
  if (
    a.account_type === "CREDIT_CARD" &&
    a.credit_limit != null &&
    a.credit_limit > 0 &&
    a.available_balance != null
  ) {
    return Math.max(a.credit_limit - a.available_balance, 0);
  }
  return Math.abs(a.current_balance);
}

/**
 * Extract debt-relevant accounts from a full account list.
 */
export function extractDebtAccounts(accounts: Account[]): DebtAccount[] {
  return accounts
    .filter(
      (a) =>
        (a.account_type === "CREDIT_CARD" || a.account_type === "LOAN") &&
        a.is_active
    )
    .map((a) => ({
      id: a.id,
      name: a.name,
      type: a.account_type as "CREDIT_CARD" | "LOAN",
      balance: computeDebtBalance(a),
      creditLimit: a.credit_limit,
      interestRate: a.interest_rate,
      monthlyPayment: a.monthly_payment,
      paymentDay: a.payment_day,
      cutoffDay: a.cutoff_day,
      currency: a.currency_code,
      color: a.color,
      institutionName: a.institution_name,
    }));
}

/**
 * Calculate credit utilization percentage (0-100).
 * Uses Math.abs so a negative balance (common when users enter debt as negative)
 * still produces a correct utilization figure.
 */
export function calcUtilization(balance: number, limit: number | null): number {
  if (!limit || limit <= 0) return 0;
  return Math.min((Math.abs(balance) / limit) * 100, 100);
}

/**
 * Estimate monthly interest cost (simple: balance * rate / 12).
 */
export function estimateMonthlyInterest(
  balance: number,
  annualRate: number | null
): number {
  if (!annualRate || annualRate <= 0 || balance <= 0) return 0;
  return (balance * (annualRate / 100)) / 12;
}

/**
 * Convert a peso amount to a relatable equivalent.
 */
export function toAlmuerzos(amount: number): number {
  return Math.round(amount / 20000);
}

export function toHorasMinimo(amount: number): number {
  // Colombian minimum wage hourly rate ~$7,200 COP (based on 2026 estimates)
  return Math.round(amount / 7200);
}

/**
 * Calculate days until next payment.
 */
export function daysUntilPayment(paymentDay: number | null): number | null {
  if (!paymentDay) return null;
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let nextPayment: Date;
  if (currentDay < paymentDay) {
    nextPayment = new Date(currentYear, currentMonth, paymentDay);
  } else {
    nextPayment = new Date(currentYear, currentMonth + 1, paymentDay);
  }

  const diffMs = nextPayment.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Generate insights based on debt accounts.
 */
export function generateInsights(accounts: DebtAccount[]): DebtInsight[] {
  const insights: DebtInsight[] = [];

  // 1. Highest-rate-first recommendation
  const withRates = accounts.filter((a) => a.interestRate && a.balance > 0);
  if (withRates.length > 1) {
    const highest = withRates.sort(
      (a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0)
    )[0];
    insights.push({
      type: "info",
      title: "Prioriza la deuda más cara",
      description: `"${highest.name}" tiene la tasa más alta (${highest.interestRate?.toFixed(1)}% EA). Pagar primero esta deuda te ahorra más en intereses.`,
    });
  }

  // 2. High utilization warning
  for (const acct of accounts) {
    if (acct.type === "CREDIT_CARD" && acct.creditLimit) {
      const util = calcUtilization(acct.balance, acct.creditLimit);
      if (util > 70) {
        insights.push({
          type: "warning",
          title: `Uso alto en ${acct.name}`,
          description: `Estás usando el ${util.toFixed(0)}% de tu cupo. Mantenerlo por debajo del 30% ayuda a tu salud financiera.`,
        });
      }
    }
  }

  // 3. Interest cost awareness
  const totalMonthlyInterest = accounts.reduce(
    (sum, a) => sum + estimateMonthlyInterest(a.balance, a.interestRate),
    0
  );
  if (totalMonthlyInterest > 0) {
    const almuerzos = toAlmuerzos(totalMonthlyInterest);
    insights.push({
      type: "warning",
      title: "Costo mensual en intereses",
      description: `Estás pagando aproximadamente $${Math.round(totalMonthlyInterest).toLocaleString("es-CO")} al mes en intereses. Eso equivale a ~${almuerzos} almuerzos.`,
    });
  }

  // 4. Upcoming payment
  for (const acct of accounts) {
    const days = daysUntilPayment(acct.paymentDay);
    if (days !== null && days <= 5 && days >= 0) {
      insights.push({
        type: "warning",
        title: `Pago próximo: ${acct.name}`,
        description:
          days === 0
            ? "El pago es hoy."
            : `Faltan ${days} día${days === 1 ? "" : "s"} para el pago.`,
      });
    }
  }

  // 5. Celebrate zero balance
  const zeroBalanceAccounts = accounts.filter((a) => a.balance <= 0);
  if (zeroBalanceAccounts.length > 0 && accounts.length > 0) {
    if (zeroBalanceAccounts.length === accounts.length) {
      insights.push({
        type: "success",
        title: "Sin deudas",
        description:
          "Todas tus cuentas de deuda están en cero. Excelente trabajo.",
      });
    }
  }

  return insights;
}
