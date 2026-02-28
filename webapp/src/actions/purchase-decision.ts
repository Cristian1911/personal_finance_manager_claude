"use server";

import {
  analyzePurchaseDecision,
  calcUtilization,
  computeDebtBalance,
  estimateMonthlyInterest,
  extractDebtAccounts,
  type PurchaseDecisionResult,
  type PurchaseFundingType,
  type PurchaseUrgency,
} from "@venti5/shared";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserSafely } from "@/lib/supabase/auth";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";
import { monthEndStr, monthStartStr, parseMonth } from "@/lib/utils/date";
import { getUpcomingPayments } from "@/actions/payment-reminders";
import { getUpcomingRecurrences } from "@/actions/recurring-templates";
import { trackProductEvent } from "@/actions/product-events";
import type { ActionResult } from "@/types/actions";
import type { Account } from "@/types/domain";

const purchaseDecisionSchema = z.object({
  amount: z.coerce.number().positive(),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  urgency: z.enum(["NECESSARY", "USEFUL", "IMPULSE"]),
  fundingType: z.enum(["ONE_TIME", "INSTALLMENTS"]),
  installments: z.coerce.number().int().min(2).max(36).nullable().optional(),
  month: z.string().optional(),
});

type Input = z.infer<typeof purchaseDecisionSchema>;

type TxRow = {
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  account_id: string;
};

type BudgetTxRow = {
  amount: number;
};

type RawAccount = Account;

function getSelectedAccountAvailable(account: RawAccount): number {
  if (account.account_type === "CREDIT_CARD") {
    if (account.available_balance != null) {
      return Math.max(account.available_balance, 0);
    }
    if (account.credit_limit != null) {
      return Math.max(account.credit_limit - computeDebtBalance(account), 0);
    }
    return 0;
  }

  return Math.max(account.current_balance, 0);
}

function getNearestDays(dates: string[]): number | null {
  if (dates.length === 0) return null;
  const now = new Date();
  const deltas = dates
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    .filter((days) => days >= 0);
  if (deltas.length === 0) return null;
  return Math.min(...deltas);
}

export async function analyzePurchaseDecisionAction(
  rawInput: Input
): Promise<ActionResult<PurchaseDecisionResult>> {
  const parsed = purchaseDecisionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const input = parsed.data;
  const categoryId = input.categoryId ?? null;
  const supabase = await createClient();
  const user = await getUserSafely(supabase);
  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  const targetMonth = parseMonth(input.month);

  const [
    accountsRes,
    monthTxRes,
    categoryBudgetRes,
    categorySpentRes,
    upcomingPayments,
    upcomingRecurrences,
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("is_active", true)
      .order("display_order"),
    executeVisibleTransactionQuery(() =>
      supabase
        .from("transactions")
        .select("amount, direction, account_id")
        .eq("is_excluded", false)
        .gte("transaction_date", monthStartStr(targetMonth))
        .lte("transaction_date", monthEndStr(targetMonth))
    ),
    categoryId
      ? supabase
          .from("budgets")
          .select("amount")
          .eq("category_id", categoryId)
          .eq("period", "monthly")
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    categoryId
      ? executeVisibleTransactionQuery(() =>
          supabase
            .from("transactions")
            .select("amount")
            .eq("direction", "OUTFLOW")
            .eq("is_excluded", false)
            .eq("category_id", categoryId)
            .gte("transaction_date", monthStartStr(targetMonth))
            .lte("transaction_date", monthEndStr(targetMonth))
        )
      : Promise.resolve({ data: null, error: null }),
    getUpcomingPayments(),
    getUpcomingRecurrences(30),
  ]);

  const accounts = (accountsRes.data ?? []) as RawAccount[];
  const selectedAccount = accounts.find((account) => account.id === input.accountId);
  if (!selectedAccount) {
    return { success: false, error: "La cuenta seleccionada no existe o no está activa." };
  }
  if (selectedAccount.account_type === "LOAN") {
    return { success: false, error: "No puedes analizar compras contra una cuenta de préstamo." };
  }

  const debtAccounts = extractDebtAccounts(accounts);
  const totalCreditLimit = debtAccounts
    .filter((account) => account.type === "CREDIT_CARD")
    .reduce((sum, account) => sum + (account.creditLimit ?? 0), 0);
  const totalCreditDebt = debtAccounts
    .filter((account) => account.type === "CREDIT_CARD")
    .reduce((sum, account) => sum + account.balance, 0);
  const monthlyDebtInterestCost = debtAccounts.reduce(
    (sum, account) => sum + estimateMonthlyInterest(account.balance, account.interestRate),
    0
  );

  const monthTransactions = (monthTxRes.data ?? []) as TxRow[];
  const debtAccountIds = new Set(
    debtAccounts.map((account) => account.id)
  );
  const monthlyIncome = monthTransactions
    .filter((tx) => tx.direction === "INFLOW" && !debtAccountIds.has(tx.account_id))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const monthlyExpenses = monthTransactions
    .filter((tx) => tx.direction === "OUTFLOW")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const liquidCashAvailable = accounts
    .filter(
      (account) =>
        account.account_type !== "CREDIT_CARD" &&
        account.account_type !== "LOAN"
    )
    .reduce((sum, account) => sum + Math.max(account.current_balance, 0), 0);

  const recurringCommitments = upcomingRecurrences
    .filter(
      (item) =>
        item.template.direction === "OUTFLOW" &&
        item.template.account.account_type !== "CREDIT_CARD" &&
        item.template.account.account_type !== "LOAN"
    )
    .reduce((sum, item) => sum + item.template.amount, 0);

  const statementCommitments = upcomingPayments.reduce(
    (sum, item) => sum + item.total_payment_due,
    0
  );
  const upcomingCommittedPayments = recurringCommitments + statementCommitments;

  const daysToNearestPayment = getNearestDays([
    ...upcomingPayments.map((item) => item.payment_due_date),
    ...upcomingRecurrences.map((item) => item.next_date),
  ]);

  const selectedDebtAfterPurchase =
    selectedAccount.account_type === "CREDIT_CARD"
      ? computeDebtBalance(selectedAccount)
      : null;

  const budgetTarget = categoryBudgetRes.data?.amount ?? null;
  const budgetSpent = ((categorySpentRes.data ?? []) as BudgetTxRow[]).reduce(
    (sum, tx) => sum + tx.amount,
    0
  );
  const budgetRemaining =
    budgetTarget == null ? null : Number(budgetTarget) - budgetSpent;

  const result = analyzePurchaseDecision({
    amount: input.amount,
    urgency: input.urgency as PurchaseUrgency,
    fundingType: input.fundingType as PurchaseFundingType,
    installments: input.installments ?? null,
    liquidCashAvailable,
    selectedAccountAvailable: getSelectedAccountAvailable(selectedAccount),
    selectedAccountType:
      selectedAccount.account_type === "CREDIT_CARD"
        ? "CREDIT_CARD"
        : selectedAccount.account_type === "SAVINGS"
          ? "SAVINGS"
          : selectedAccount.account_type === "INVESTMENT"
            ? "INVESTMENT"
            : selectedAccount.account_type === "CHECKING"
              ? "CHECKING"
              : "OTHER",
    selectedAccountCreditLimit: selectedAccount.credit_limit,
    selectedAccountCurrentDebt: selectedDebtAfterPurchase,
    monthlyIncome,
    monthlyExpenses,
    upcomingCommittedPayments,
    daysToNearestPayment,
    budgetRemaining,
    debtUtilizationPct:
      totalCreditLimit > 0 ? calcUtilization(totalCreditDebt, totalCreditLimit) : null,
    monthlyDebtInterestCost,
    activeDebtAccounts: debtAccounts.filter((account) => account.balance > 0),
  });

  await trackProductEvent({
    event_name: "purchase_decision_analyzed",
    flow: "dashboard",
    step: "purchase_decision",
    entry_point: "cta",
    success: true,
    metadata: {
      amount: input.amount,
      urgency: input.urgency,
      funding_type: input.fundingType,
      verdict: result.verdict,
      score: result.score,
    },
  });

  return { success: true, data: result };
}
