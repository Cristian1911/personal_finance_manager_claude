"use server";

import { createClient } from "@/lib/supabase/server";
import {
  extractDebtAccounts,
  calcUtilization,
  estimateMonthlyInterest,
  generateInsights,
  type DebtOverview,
} from "@/lib/utils/debt";

export async function getDebtOverview(): Promise<DebtOverview> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      totalDebt: 0,
      totalCreditLimit: 0,
      overallUtilization: 0,
      monthlyInterestEstimate: 0,
      accounts: [],
      insights: [],
    };
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("display_order");

  if (!accounts) {
    return {
      totalDebt: 0,
      totalCreditLimit: 0,
      overallUtilization: 0,
      monthlyInterestEstimate: 0,
      accounts: [],
      insights: [],
    };
  }

  const debtAccounts = extractDebtAccounts(accounts);

  const totalDebt = debtAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalCreditLimit = debtAccounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((sum, a) => sum + (a.creditLimit ?? 0), 0);

  const overallUtilization = calcUtilization(
    debtAccounts
      .filter((a) => a.type === "CREDIT_CARD")
      .reduce((sum, a) => sum + a.balance, 0),
    totalCreditLimit
  );

  const monthlyInterestEstimate = debtAccounts.reduce(
    (sum, a) => sum + estimateMonthlyInterest(a.balance, a.interestRate),
    0
  );

  const insights = generateInsights(debtAccounts);

  return {
    totalDebt,
    totalCreditLimit,
    overallUtilization,
    monthlyInterestEstimate,
    accounts: debtAccounts,
    insights,
  };
}
