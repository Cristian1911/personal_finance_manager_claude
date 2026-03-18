"use server";

import { cache } from "react";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { getAccounts } from "@/actions/accounts";
import { compareStrategies } from "@zeta/shared";
import type { DebtAccount } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

export interface DebtCountdownData {
  monthsToFree: number;
  projectedDate: string; // YYYY-MM
  totalDebt: number;
  originalDebt: number; // sum of initial_amounts from snapshots
  progressPercent: number;
  extraPaymentScenario: {
    extraAmount: number;
    monthsToFree: number;
    monthsSaved: number;
    interestSaved: number;
  } | null;
  currency: CurrencyCode;
  incompleteAccounts: string[]; // account names with missing data
}

export const getDebtFreeCountdown = cache(
  async (currency?: CurrencyCode): Promise<DebtCountdownData | null> => {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return null;

    const baseCurrency = currency ?? "COP";

    // 1. Get all active accounts, filter to debt accounts in this currency
    const accountsResult = await getAccounts();
    if (!accountsResult.success || !accountsResult.data) return null;

    const debtAccounts = accountsResult.data.filter(
      (a) =>
        (a.account_type === "CREDIT_CARD" || a.account_type === "LOAN") &&
        a.currency_code === baseCurrency
    );

    if (debtAccounts.length === 0) return null;

    // 2. Get latest snapshot per debt account
    const accountIds = debtAccounts.map((a) => a.id);

    const { data: snapshots, error } = await supabase
      .from("statement_snapshots")
      .select(
        "account_id, interest_rate, minimum_payment, remaining_balance, initial_amount, period_to, created_at"
      )
      .eq("user_id", user.id)
      .in("account_id", accountIds)
      .order("period_to", { ascending: false });

    if (error) throw error;

    // Group snapshots by account_id — take the first (most recent) per account
    const latestSnapshotByAccount = new Map<
      string,
      {
        interest_rate: number | null;
        minimum_payment: number | null;
        remaining_balance: number | null;
        initial_amount: number | null;
      }
    >();
    for (const snap of snapshots ?? []) {
      if (!latestSnapshotByAccount.has(snap.account_id)) {
        latestSnapshotByAccount.set(snap.account_id, snap);
      }
    }

    // 3. Build DebtAccount[] for the simulator, tracking incomplete accounts
    const simulatorAccounts: DebtAccount[] = [];
    const incompleteAccounts: string[] = [];
    let originalDebt = 0;

    for (const account of debtAccounts) {
      const snap = latestSnapshotByAccount.get(account.id);
      const interestRate = snap?.interest_rate ?? null;
      const minimumPayment = snap?.minimum_payment ?? account.monthly_payment ?? null;
      const balance = snap?.remaining_balance ?? Math.abs(account.current_balance);

      if (interestRate === null || minimumPayment === null) {
        incompleteAccounts.push(account.name);
      }

      // Track original debt
      if (snap?.initial_amount != null) {
        originalDebt += snap.initial_amount;
      } else {
        originalDebt += balance;
      }

      simulatorAccounts.push({
        id: account.id,
        name: account.name,
        type: account.account_type as "CREDIT_CARD" | "LOAN",
        balance,
        creditLimit: account.credit_limit ?? null,
        interestRate: interestRate ?? 0,
        monthlyPayment: minimumPayment ?? 0,
        paymentDay: account.payment_day ?? null,
        cutoffDay: account.cutoff_day ?? null,
        currency: baseCurrency,
        color: account.color ?? null,
        institutionName: account.institution_name ?? null,
        currencyBreakdown: null,
      });
    }

    // Filter accounts with sufficient data for simulation
    const simulatableAccounts = simulatorAccounts.filter(
      (a) => a.balance > 0 && (a.interestRate ?? 0) > 0 && (a.monthlyPayment ?? 0) > 0
    );

    if (simulatableAccounts.length === 0) return null;

    // 4. Run baseline simulation (no extra payment)
    const baselineComparison = compareStrategies(simulatableAccounts, 0);
    const baseline = baselineComparison.baseline;

    const totalDebt = simulatableAccounts.reduce((sum, a) => sum + a.balance, 0);
    const monthsToFree = baseline.totalMonths;

    // Projected payoff date
    const now = new Date();
    const projectedDate = new Date(now.getFullYear(), now.getMonth() + monthsToFree, 1);
    const projectedDateStr = `${projectedDate.getFullYear()}-${String(projectedDate.getMonth() + 1).padStart(2, "0")}`;

    // Progress percentage
    const progressPercent =
      originalDebt > 0
        ? Math.min(100, Math.max(0, ((originalDebt - totalDebt) / originalDebt) * 100))
        : 0;

    // 5. Extra payment scenario: 10% of the highest-rate account's minimum payment
    let extraPaymentScenario: DebtCountdownData["extraPaymentScenario"] = null;
    const sortedByRate = [...simulatableAccounts].sort(
      (a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0)
    );
    const highestRateAccount = sortedByRate[0];

    if (highestRateAccount && (highestRateAccount.monthlyPayment ?? 0) > 0) {
      const extraAmount = Math.ceil((highestRateAccount.monthlyPayment ?? 0) * 0.1);
      const extraComparison = compareStrategies(simulatableAccounts, extraAmount);
      const extraBaseline = extraComparison.baseline;

      const monthsSaved = monthsToFree - extraBaseline.totalMonths;
      const interestSaved = baseline.totalInterestPaid - extraBaseline.totalInterestPaid;

      extraPaymentScenario = {
        extraAmount,
        monthsToFree: extraBaseline.totalMonths,
        monthsSaved,
        interestSaved,
      };
    }

    return {
      monthsToFree,
      projectedDate: projectedDateStr,
      totalDebt,
      originalDebt,
      progressPercent,
      extraPaymentScenario,
      currency: baseCurrency,
      incompleteAccounts,
    };
  }
);
