import { getAllAccounts } from "./accounts";
import { DEBT_ACCOUNT_TYPES } from "../constants/accounts";

export interface DebtAccountInfo {
  id: string;
  name: string;
  type: "CREDIT_CARD" | "LOAN";
  balance: number;
  currency: string;
  interestRate: number;
  creditLimit: number;
  monthlyPayment: number;
  paymentDay: number | null;
}

export interface DebtOverviewData {
  totalMonthlyPayment: number;
  monthlyInterest: number;
  overallUtilization: number;
  totalCreditLimit: number;
  totalCreditUsed: number;
  accounts: DebtAccountInfo[];
}

export async function getDebtOverview(): Promise<DebtOverviewData> {
  const allAccounts = await getAllAccounts();
  const debtAccounts = allAccounts.filter(
    (a) => DEBT_ACCOUNT_TYPES.has(a.account_type) && a.is_active === 1
  );

  const accounts: DebtAccountInfo[] = debtAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.account_type as "CREDIT_CARD" | "LOAN",
    balance: Math.abs(a.current_balance),
    currency: a.currency_code,
    interestRate: a.interest_rate ?? 0,
    creditLimit: a.credit_limit ?? 0,
    monthlyPayment: a.monthly_payment ?? 0,
    paymentDay: a.payment_day,
  }));

  const creditCards = accounts.filter((a) => a.type === "CREDIT_CARD");
  const totalCreditUsed = creditCards.reduce((s, a) => s + a.balance, 0);
  const totalCreditLimit = creditCards.reduce((s, a) => s + a.creditLimit, 0);
  const overallUtilization = totalCreditLimit > 0
    ? Math.round((totalCreditUsed / totalCreditLimit) * 100)
    : 0;

  const totalMonthlyPayment = accounts.reduce((s, a) => s + a.monthlyPayment, 0);

  // Rough monthly interest estimate
  const monthlyInterest = accounts.reduce(
    (s, a) => s + (a.balance * (a.interestRate / 100)) / 12,
    0
  );

  return {
    totalMonthlyPayment,
    monthlyInterest,
    overallUtilization,
    totalCreditLimit,
    totalCreditUsed,
    accounts,
  };
}
