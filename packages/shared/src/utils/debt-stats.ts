/**
 * Derived metrics for the debt quick stats grid.
 * Pure function — no side effects, no DB calls.
 */
import type { DebtAccount } from "./debt";
import { estimateMonthlyInterest, calcUtilization, daysUntilPayment } from "./debt";
import { getMinPayment } from "./scenario-engine";

export interface AccountPaymentEntry {
  accountId: string;
  accountName: string;
  amount: number;
}

export interface AccountRateEntry {
  accountId: string;
  accountName: string;
  rate: number;
}

export interface AccountInterestEntry {
  accountId: string;
  accountName: string;
  interest: number;
}

export interface AccountUtilizationEntry {
  accountId: string;
  accountName: string;
  utilization: number;
  used: number;
  limit: number;
}

export interface AccountProgressEntry {
  accountId: string;
  accountName: string;
  percentage: number;
  paid: number;
  original: number;
}

export interface AccountRemainingEntry {
  accountId: string;
  accountName: string;
  months: number;
}

export interface UpcomingPaymentEntry {
  accountId: string;
  accountName: string;
  daysUntil: number;
  paymentDay: number;
}

export interface DebtStats {
  totalMonthlyPayment: number;

  highestPayment: { accountName: string; amount: number };
  mostExpensive: { accountName: string; monthlyCost: number; rate: number } | null;
  nextPayment: UpcomingPaymentEntry | null;

  creditCards: {
    count: number;
    monthlyPayment: number;
    monthlyInterest: number;
    utilization: AccountUtilizationEntry[];
    payments: AccountPaymentEntry[];
    interests: AccountInterestEntry[];
  };

  loans: {
    count: number;
    monthlyPayment: number;
    payments: AccountPaymentEntry[];
    remainingMonths: { months: number; accountName: string } | null;
    progress: { percentage: number; accountName: string } | null;
    remainingList: AccountRemainingEntry[];
    progressList: AccountProgressEntry[];
  };

  allByPayment: AccountPaymentEntry[];
  allByCost: AccountInterestEntry[];
  upcomingPayments: UpcomingPaymentEntry[];
}

export function computeDebtStats(accounts: DebtAccount[]): DebtStats {
  const active = accounts.filter((a) => a.balance > 0);
  const creditCards = active.filter((a) => a.type === "CREDIT_CARD");
  const loans = active.filter((a) => a.type === "LOAN");

  // Per-account payment amounts
  const paymentEntries: AccountPaymentEntry[] = active.map((a) => ({
    accountId: a.id,
    accountName: a.name,
    amount: getMinPayment(a),
  }));

  const totalMonthlyPayment = paymentEntries.reduce((s, e) => s + e.amount, 0);

  // Sorted by payment (descending)
  const allByPayment = [...paymentEntries].sort((a, b) => b.amount - a.amount);

  // Highest payment
  const highestPayment = allByPayment.length > 0
    ? { accountName: allByPayment[0].accountName, amount: allByPayment[0].amount }
    : { accountName: "", amount: 0 };

  // Per-account monthly interest cost (descending) — "most expensive" = highest actual cost
  const allByCost: AccountInterestEntry[] = active
    .filter((a) => a.interestRate != null && a.interestRate > 0)
    .map((a) => ({
      accountId: a.id,
      accountName: a.name,
      interest: estimateMonthlyInterest(a.balance, a.interestRate),
    }))
    .sort((a, b) => b.interest - a.interest);

  const mostExpensiveAccount = allByCost.length > 0
    ? active.find((a) => a.id === allByCost[0].accountId)
    : null;
  const mostExpensive = mostExpensiveAccount
    ? {
        accountName: allByCost[0].accountName,
        monthlyCost: allByCost[0].interest,
        rate: mostExpensiveAccount.interestRate!,
      }
    : null;

  // Upcoming payments
  const upcomingPayments: UpcomingPaymentEntry[] = active
    .filter((a) => a.paymentDay != null)
    .map((a) => ({
      accountId: a.id,
      accountName: a.name,
      daysUntil: daysUntilPayment(a.paymentDay)!,
      paymentDay: a.paymentDay!,
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const nextPayment = upcomingPayments.length > 0 ? upcomingPayments[0] : null;

  // Credit card stats
  const ccPayments: AccountPaymentEntry[] = creditCards.map((a) => ({
    accountId: a.id, accountName: a.name, amount: getMinPayment(a),
  }));
  const ccInterests: AccountInterestEntry[] = creditCards
    .map((a) => ({
      accountId: a.id, accountName: a.name,
      interest: estimateMonthlyInterest(a.balance, a.interestRate),
    }))
    .sort((a, b) => b.interest - a.interest);
  const ccUtilization: AccountUtilizationEntry[] = creditCards
    .filter((a) => a.creditLimit && a.creditLimit > 0)
    .map((a) => ({
      accountId: a.id, accountName: a.name,
      utilization: calcUtilization(a.balance, a.creditLimit),
      used: a.balance,
      limit: a.creditLimit!,
    }));

  // Loan stats
  const loanPayments: AccountPaymentEntry[] = loans.map((a) => ({
    accountId: a.id, accountName: a.name, amount: getMinPayment(a),
  }));

  const loanRemainingList: AccountRemainingEntry[] = loans
    .filter((a) => a.monthlyPayment && a.monthlyPayment > 0)
    .map((a) => ({
      accountId: a.id, accountName: a.name,
      months: Math.ceil(a.balance / a.monthlyPayment!),
    }))
    .sort((a, b) => a.months - b.months);

  const loanProgressList: AccountProgressEntry[] = loans
    .filter((a) => {
      const original = a.loanAmount ?? a.creditLimit;
      return original != null && original > 0;
    })
    .map((a) => {
      const original = (a.loanAmount ?? a.creditLimit)!;
      return {
        accountId: a.id, accountName: a.name,
        percentage: Math.max((1 - a.balance / original) * 100, 0),
        paid: Math.max(original - a.balance, 0),
        original,
      };
    })
    .sort((a, b) => b.percentage - a.percentage);

  const loanRemainingHeadline = loanProgressList.length > 0
    ? (() => {
        const topProgress = loanProgressList[0]; // highest % paid
        const matching = loanRemainingList.find((r) => r.accountName === topProgress.accountName);
        return { months: matching?.months ?? 0, accountName: topProgress.accountName };
      })()
    : null;
  const loanProgressHeadline = loanProgressList.length > 0
    ? { percentage: loanProgressList[0].percentage, accountName: loanProgressList[0].accountName }
    : null;

  return {
    totalMonthlyPayment,
    highestPayment,
    mostExpensive,
    nextPayment,
    creditCards: {
      count: creditCards.length,
      monthlyPayment: ccPayments.reduce((s, e) => s + e.amount, 0),
      monthlyInterest: ccInterests.reduce((s, e) => s + e.interest, 0),
      utilization: ccUtilization,
      payments: ccPayments,
      interests: ccInterests,
    },
    loans: {
      count: loans.length,
      monthlyPayment: loanPayments.reduce((s, e) => s + e.amount, 0),
      payments: loanPayments,
      remainingMonths: loanRemainingHeadline,
      progress: loanProgressHeadline,
      remainingList: loanRemainingList,
      progressList: loanProgressList,
    },
    allByPayment,
    allByCost,
    upcomingPayments,
  };
}
