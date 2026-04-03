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
  highestRate: { accountName: string; rate: number };
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
  allByRate: AccountRateEntry[];
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

  // Per-account rates (descending)
  const allByRate: AccountRateEntry[] = active
    .filter((a) => a.interestRate != null && a.interestRate > 0)
    .map((a) => ({
      accountId: a.id,
      accountName: a.name,
      rate: a.interestRate!,
    }))
    .sort((a, b) => b.rate - a.rate);

  const highestRate = allByRate.length > 0
    ? { accountName: allByRate[0].accountName, rate: allByRate[0].rate }
    : { accountName: "", rate: 0 };

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
  const ccInterests: AccountInterestEntry[] = creditCards.map((a) => ({
    accountId: a.id, accountName: a.name,
    interest: estimateMonthlyInterest(a.balance, a.interestRate),
  }));
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
    }));

  const loanProgressList: AccountProgressEntry[] = loans
    .filter((a) => a.creditLimit && a.creditLimit > 0)
    .map((a) => ({
      accountId: a.id, accountName: a.name,
      percentage: (1 - a.balance / a.creditLimit!) * 100,
      paid: a.creditLimit! - a.balance,
      original: a.creditLimit!,
    }));

  const loanRemainingHeadline = loanRemainingList.length > 0
    ? { months: loanRemainingList[0].months, accountName: loanRemainingList[0].accountName }
    : null;
  const loanProgressHeadline = loanProgressList.length > 0
    ? { percentage: loanProgressList[0].percentage, accountName: loanProgressList[0].accountName }
    : null;

  return {
    totalMonthlyPayment,
    highestPayment,
    highestRate,
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
    allByRate,
    upcomingPayments,
  };
}
