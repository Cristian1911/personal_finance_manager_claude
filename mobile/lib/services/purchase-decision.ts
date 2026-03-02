import {
  analyzePurchaseDecision,
  calcUtilization,
  estimateMonthlyInterest,
  type Account,
  type DebtAccount,
  type PurchaseDecisionInput,
  type PurchaseDecisionResult,
  type PurchaseFundingType,
  type PurchaseUrgency,
} from "@venti5/shared";
import { getAllAccounts, type AccountRow } from "../repositories/accounts";
import { getTransactions } from "../repositories/transactions";

function toDomainAccount(row: AccountRow): Account {
  return {
    ...row,
    account_type: row.account_type as Account["account_type"],
    currency_code: row.currency_code as Account["currency_code"],
    is_active: row.is_active === 1,
    connection_status: "DISCONNECTED",
    provider: "MANUAL",
    currency_balances: null,
    display_order: 0,
    expected_return_rate: null,
    initial_investment: null,
    last_synced_at: null,
    loan_amount: null,
    loan_end_date: null,
    loan_start_date: null,
    mask: null,
    maturity_date: null,
    monthly_payment: null,
    provider_account_id: null,
  };
}

function buildDebtAccounts(rows: AccountRow[]): DebtAccount[] {
  return rows
    .filter(
      (r) =>
        r.is_active === 1 &&
        (r.account_type === "CREDIT_CARD" || r.account_type === "LOAN")
    )
    .map((r) => {
      const balance =
        r.account_type === "CREDIT_CARD"
          ? Math.abs(r.current_balance)
          : Math.abs(r.current_balance);
      return {
        id: r.id,
        name: r.name,
        type: r.account_type as "CREDIT_CARD" | "LOAN",
        balance,
        creditLimit: r.credit_limit,
        interestRate: r.interest_rate,
        monthlyPayment: null,
        paymentDay: r.payment_day,
        cutoffDay: r.cutoff_day,
        currency: r.currency_code,
        color: r.color,
        institutionName: r.institution_name,
        currencyBreakdown: null,
      };
    });
}

export async function analyzeLocally(params: {
  amount: number;
  accountId: string;
  urgency: PurchaseUrgency;
  fundingType: PurchaseFundingType;
  installments: number | null;
  month: string;
}): Promise<PurchaseDecisionResult> {
  const [accounts, transactions] = await Promise.all([
    getAllAccounts(),
    getTransactions({ month: params.month, limit: 1000 }),
  ]);

  const selectedRow = accounts.find((a) => a.id === params.accountId);
  if (!selectedRow) {
    throw new Error("Cuenta no encontrada");
  }

  // Compute monthly income and expenses from transactions
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  for (const t of transactions) {
    if (t.is_excluded) continue;
    const amount = Math.abs(t.amount ?? 0);
    if (t.direction === "INFLOW") {
      monthlyIncome += amount;
    } else {
      monthlyExpenses += amount;
    }
  }

  // Liquid cash: sum of non-debt account balances
  const liquidCashAvailable = accounts
    .filter(
      (a) =>
        a.is_active === 1 &&
        a.account_type !== "CREDIT_CARD" &&
        a.account_type !== "LOAN"
    )
    .reduce((sum, a) => sum + (a.current_balance ?? 0), 0);

  // Selected account available balance
  let selectedAccountAvailable: number;
  if (selectedRow.account_type === "CREDIT_CARD") {
    selectedAccountAvailable =
      (selectedRow.credit_limit ?? 0) - Math.abs(selectedRow.current_balance);
  } else {
    selectedAccountAvailable = selectedRow.current_balance ?? 0;
  }

  // Upcoming committed payments (debt accounts with payment day within 30 days)
  const today = new Date();
  let upcomingCommittedPayments = 0;
  let daysToNearestPayment: number | null = null;

  for (const a of accounts) {
    if (a.is_active !== 1 || !a.payment_day) continue;
    if (a.account_type !== "CREDIT_CARD" && a.account_type !== "LOAN") continue;

    const dueDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      a.payment_day
    );
    if (dueDate < today) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }
    const diffDays = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays <= 30) {
      upcomingCommittedPayments += Math.abs(a.current_balance ?? 0);
      if (daysToNearestPayment === null || diffDays < daysToNearestPayment) {
        daysToNearestPayment = diffDays;
      }
    }
  }

  // Debt utilization
  const debtAccounts = buildDebtAccounts(accounts);
  const totalDebt = debtAccounts.reduce((s, d) => s + d.balance, 0);
  const totalCreditLimit = debtAccounts
    .filter((d) => d.type === "CREDIT_CARD" && d.creditLimit)
    .reduce((s, d) => s + (d.creditLimit ?? 0), 0);
  const debtUtilizationPct =
    totalCreditLimit > 0 ? calcUtilization(totalDebt, totalCreditLimit) : null;

  // Monthly interest cost
  const monthlyDebtInterestCost = debtAccounts.reduce(
    (sum, d) => sum + estimateMonthlyInterest(d.balance, d.interestRate),
    0
  );

  const input: PurchaseDecisionInput = {
    amount: params.amount,
    urgency: params.urgency,
    fundingType: params.fundingType,
    installments: params.installments,
    liquidCashAvailable,
    selectedAccountAvailable,
    selectedAccountType: selectedRow.account_type as PurchaseDecisionInput["selectedAccountType"],
    selectedAccountCreditLimit: selectedRow.credit_limit,
    selectedAccountCurrentDebt:
      selectedRow.account_type === "CREDIT_CARD"
        ? Math.abs(selectedRow.current_balance)
        : null,
    monthlyIncome,
    monthlyExpenses,
    upcomingCommittedPayments,
    daysToNearestPayment,
    budgetRemaining: null, // No category budget in mobile v1
    debtUtilizationPct,
    monthlyDebtInterestCost,
    activeDebtAccounts: debtAccounts,
  };

  return analyzePurchaseDecision(input);
}
