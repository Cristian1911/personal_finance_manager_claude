import {
  analyzePurchaseDecision,
  calcUtilization,
  computeDebtBalance,
  estimateMonthlyInterest,
  extractDebtAccounts,
  type Account,
  type DebtAccount,
  type PurchaseDecisionInput,
  type PurchaseDecisionResult,
  type PurchaseFundingType,
  type PurchaseUrgency,
} from "@zeta/shared";
import { getAllAccounts, type AccountRow } from "../repositories/accounts";
import { getTransactions } from "../repositories/transactions";
import { toDomainAccount } from "../domain/account";

export type FinancialSnapshot = {
  accounts: Account[];
  accountRows: AccountRow[];
  liquidCashAvailable: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  upcomingCommittedPayments: number;
  daysToNearestPayment: number | null;
  debtUtilizationPct: number | null;
  monthlyDebtInterestCost: number;
  activeDebtAccounts: DebtAccount[];
};

/**
 * Build the shared financial snapshot used by both purchase-decision (puedo-pagar)
 * and wishlist scoring (deseos). Reads from local SQLite repositories so it works
 * offline and stays in sync with what the user sees on-device.
 */
export async function getFinancialSnapshot(month: string): Promise<FinancialSnapshot> {
  const [accountRows, transactions] = await Promise.all([
    getAllAccounts(),
    getTransactions({ month, limit: 1000 }),
  ]);
  const domainAccounts = accountRows.map(toDomainAccount);
  const debtAccounts = extractDebtAccounts(domainAccounts);
  const debtAccountIds = new Set(debtAccounts.map((a) => a.id));

  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  for (const t of transactions) {
    if (t.is_excluded) continue;
    const amount = Math.abs(t.amount ?? 0);
    if (t.direction === "INFLOW" && !debtAccountIds.has(t.account_id)) {
      monthlyIncome += amount;
    } else if (t.direction === "OUTFLOW") {
      monthlyExpenses += amount;
    }
  }

  const liquidCashAvailable = accountRows
    .filter(
      (a) =>
        a.is_active === 1 &&
        a.account_type !== "CREDIT_CARD" &&
        a.account_type !== "LOAN"
    )
    .reduce((sum, a) => sum + Math.max(a.current_balance ?? 0, 0), 0);

  const today = new Date();
  let upcomingCommittedPayments = 0;
  let daysToNearestPayment: number | null = null;
  for (const account of debtAccounts) {
    if (!account.paymentDay) continue;
    const dueDate = new Date(today.getFullYear(), today.getMonth(), account.paymentDay);
    if (dueDate < today) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) {
      upcomingCommittedPayments += Math.max(account.monthlyPayment ?? 0, 0);
      if (daysToNearestPayment === null || diffDays < daysToNearestPayment) {
        daysToNearestPayment = diffDays;
      }
    }
  }

  const totalCreditLimit = debtAccounts
    .filter((d) => d.type === "CREDIT_CARD" && d.creditLimit)
    .reduce((s, d) => s + (d.creditLimit ?? 0), 0);
  const totalCreditDebt = debtAccounts
    .filter((d) => d.type === "CREDIT_CARD")
    .reduce((s, d) => s + d.balance, 0);
  const debtUtilizationPct =
    totalCreditLimit > 0 ? calcUtilization(totalCreditDebt, totalCreditLimit) : null;

  const monthlyDebtInterestCost = debtAccounts.reduce(
    (sum, d) => sum + estimateMonthlyInterest(d.balance, d.interestRate),
    0
  );

  return {
    accounts: domainAccounts,
    accountRows,
    liquidCashAvailable,
    monthlyIncome,
    monthlyExpenses,
    upcomingCommittedPayments,
    daysToNearestPayment,
    debtUtilizationPct,
    monthlyDebtInterestCost,
    activeDebtAccounts: debtAccounts.filter((d) => d.balance > 0),
  };
}

export function getSelectedAccountAvailable(account: AccountRow): number {
  if (account.account_type === "CREDIT_CARD") {
    // Webapp parity: prefer bank-reported `available_balance` when present —
    // captures pending charges + holds the computed headroom can't see.
    if (account.available_balance != null) {
      return Math.max(account.available_balance, 0);
    }
    return Math.max(
      (account.credit_limit ?? 0) - Math.abs(account.current_balance ?? 0),
      0
    );
  }
  return Math.max(account.current_balance ?? 0, 0);
}

export async function analyzeLocally(params: {
  amount: number;
  accountId: string;
  urgency: PurchaseUrgency;
  fundingType: PurchaseFundingType;
  installments: number | null;
  month: string;
  /** Optional category for budget-impact reasons. */
  categoryId?: string | null;
  /** Optional pre-computed budget remaining (mobile callers may skip). */
  budgetRemaining?: number | null;
}): Promise<PurchaseDecisionResult> {
  const snapshot = await getFinancialSnapshot(params.month);
  const selectedRow = snapshot.accountRows.find((a) => a.id === params.accountId);
  if (!selectedRow) {
    throw new Error("Cuenta no encontrada");
  }

  const input: PurchaseDecisionInput = {
    amount: params.amount,
    urgency: params.urgency,
    fundingType: params.fundingType,
    installments: params.installments,
    liquidCashAvailable: snapshot.liquidCashAvailable,
    selectedAccountAvailable: getSelectedAccountAvailable(selectedRow),
    selectedAccountType: selectedRow.account_type as PurchaseDecisionInput["selectedAccountType"],
    selectedAccountCreditLimit: selectedRow.credit_limit,
    selectedAccountCurrentDebt:
      selectedRow.account_type === "CREDIT_CARD"
        ? Math.abs(selectedRow.current_balance)
        : null,
    monthlyIncome: snapshot.monthlyIncome,
    monthlyExpenses: snapshot.monthlyExpenses,
    upcomingCommittedPayments: snapshot.upcomingCommittedPayments,
    daysToNearestPayment: snapshot.daysToNearestPayment,
    budgetRemaining: params.budgetRemaining ?? null,
    debtUtilizationPct: snapshot.debtUtilizationPct,
    monthlyDebtInterestCost: snapshot.monthlyDebtInterestCost,
    activeDebtAccounts: snapshot.activeDebtAccounts,
  };

  return analyzePurchaseDecision(input);
}

/**
 * Score a single wishlist item against a pre-fetched financial snapshot.
 * Returns null when item is unenriched, missing required fields, or no eligible account.
 * Mirrors webapp `scoreItemWithSnapshot` (actions/wishlist.ts), minus per-item budget
 * lookup (mobile defers category-budget integration to a follow-up).
 */
export function scoreWishlistItemWithSnapshot(params: {
  amount: number;
  urgency: PurchaseUrgency | null;
  fundingType: PurchaseFundingType | null;
  installments: number | null;
  accountId: string | null;
  snapshot: FinancialSnapshot;
}): PurchaseDecisionResult | null {
  if (!params.urgency || !params.fundingType) return null;

  const selectedRow = params.accountId
    ? params.snapshot.accountRows.find((a) => a.id === params.accountId)
    : params.snapshot.accountRows.find(
        (a) =>
          a.is_active === 1 &&
          a.account_type !== "CREDIT_CARD" &&
          a.account_type !== "LOAN"
      );
  if (!selectedRow) return null;

  const selectedAccountCurrentDebt =
    selectedRow.account_type === "CREDIT_CARD"
      ? computeDebtBalance(toDomainAccount(selectedRow))
      : null;

  const input: PurchaseDecisionInput = {
    amount: params.amount,
    urgency: params.urgency,
    fundingType: params.fundingType,
    installments: params.installments,
    liquidCashAvailable: params.snapshot.liquidCashAvailable,
    selectedAccountAvailable: getSelectedAccountAvailable(selectedRow),
    selectedAccountType: selectedRow.account_type as PurchaseDecisionInput["selectedAccountType"],
    selectedAccountCreditLimit: selectedRow.credit_limit,
    selectedAccountCurrentDebt,
    monthlyIncome: params.snapshot.monthlyIncome,
    monthlyExpenses: params.snapshot.monthlyExpenses,
    upcomingCommittedPayments: params.snapshot.upcomingCommittedPayments,
    daysToNearestPayment: params.snapshot.daysToNearestPayment,
    budgetRemaining: null,
    debtUtilizationPct: params.snapshot.debtUtilizationPct,
    monthlyDebtInterestCost: params.snapshot.monthlyDebtInterestCost,
    activeDebtAccounts: params.snapshot.activeDebtAccounts,
  };

  return analyzePurchaseDecision(input);
}
